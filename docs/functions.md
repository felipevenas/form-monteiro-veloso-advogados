# Edge Functions

## O que está implementado

| Função | Rotas | Estado |
| --- | --- | --- |
| `api-public` | `POST /session/start`, `POST /session/resume`, `GET /process`, `PUT /process/steps/:step`, `PUT /process/steps/:step/draft`, `PUT /process/plan`, `POST /process/signature/start`, `POST /process/payment/checkout`, `POST /process/submit` (alias), `POST /process/documents/upload-url`, `POST /process/documents/complete`, `DELETE /process/documents/:requirementId` | Funcional contra o banco cloud |
| `api-admin` | `GET /processes`, `GET /processes/:id`, `POST /processes/:id/actions`, `GET /jobs`, `POST /jobs/:id/retry`, `GET /alerts` | Funcional; exige JWT + profile ativo |
| `webhooks` | `POST /asaas`, `POST /zapsign`, `POST /vertisell` | Persiste e processa assinatura/pagamento na mesma chamada |
| `jobs` | `POST /run` | **Pendente** (Fase 4) |

O worker `jobs` ainda não existe. A liberação de assinatura e pagamento não depende dele: os webhooks atualizam o processo de forma síncrona e idempotente. Jobs de Drive e mensageria continuam em `PENDING` até os adaptadores serem implementados.

## Como rodar local

```bash
npx supabase start
npx supabase db reset
npx supabase functions serve --no-verify-jwt
```

A API fica em `http://127.0.0.1:54321/functions/v1`.

O frontend usa o backend real quando `.env.local` tem:

```env
VITE_API_MODE=http
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key do supabase status>
```

Sem essas variáveis, o frontend roda em `mock` e não chama as funções.

Na Vercel, além dessas, cadastre `VITE_APP_URL` e `VITE_TURNSTILE_SITE_KEY` (site key pública do Cloudflare Turnstile). O `.env.example` está organizado por bloco do Supabase; as chaves privadas ficam nas Secrets das Edge Functions.

## Variáveis de ambiente das funções

As três primeiras são injetadas pelo runtime local:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

Configuráveis via `supabase secrets set` (produção) ou `--env-file` (local):

- `APP_URL` — origem permitida no CORS (lista separada por vírgula) e base do retorno do checkout
- `TURNSTILE_SECRET` — ausente = Turnstile desativado (só use assim em desenvolvimento)
- `CRON_SECRET` — protege `jobs/run`
- `ASAAS_WEBHOOK_TOKEN` — header `asaas-access-token`
- `ASAAS_API_KEY`, `ASAAS_BASE_URL` — checkout (`https://api.asaas.com/v3` ou sandbox)
- `ZAPSIGN_WEBHOOK_SECRET` — `Authorization: Bearer ...`
- `ZAPSIGN_API_TOKEN`, `ZAPSIGN_BASE_URL` — criação do contrato via template
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHARED_DRIVE_ID`, `GOOGLE_ROOT_FOLDER_ID`
- `INFINITUM_MODE`, `INFINITUM_API_KEY`, `INFINITUM_BASE_URL`
- `VERTISEL_MODE`, `VERTISEL_API_KEY`, `VERTISEL_BASE_URL`, `VERTISEL_WEBHOOK_SECRET`
- `IP_HASH_SALT` — salt do hash de IP
- `RESEND_API_KEY` — chave da API do Resend (e-mails transacionais)
- `EMAIL_FROM` — remetente verificado (ex.: `Monteiro Veloso Advogados <contato@monteiroveloso.com>`)
- `EMAIL_REPLY_TO` — endereço de resposta (padrão `roberta@monteiroveloso.com`)
- `EMAIL_MODE` — `off`, `test` ou `live`; sem a variável, `live` quando há chave
- `EMAIL_TEST_RECIPIENT` — destinatário único no modo `test`
- `EMAIL_TEAM_RECIPIENTS` — lista separada por vírgula para o aviso interno

### E-mails transacionais (Resend)

Três e-mails saem do fluxo, sempre em background e sem derrubar o formulário:

| Momento | Destino |
| --- | --- |
| Dados + contrato enviados (`startSignature`) | cliente e equipe |
| Documentos completos (`CONCLUIDO`) | cliente |
| Pedido de retomada (`/session/resume`) | cliente |

A deduplicação fica em `message_logs.idempotency_key`; falhas geram alerta
`email-failed:<processId>:<tipo>`. Detalhes em `docs/integrations/resend.md`.


O contrato só é gerado quando existir `ZAPSIGN_API_TOKEN` **e** o `external_template_id` real (substituindo `PREENCHER_CONTRATO`). O checkout só abre com `ASAAS_API_KEY`. Sem essas chaves, o processo fica em `CONTRATO_EM_GERACAO`/pagamento pendente e gera alerta para a equipe.

Nunca coloque esses valores no frontend (`VITE_*`).

## Exemplo de fluxo público

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/api-public/session/start \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -d '{"productSlug":"defesa-busca-apreensao"}'
```

A resposta traz `token` (`mv_...`) e o processo. Use o token nas chamadas seguintes:

```bash
curl http://127.0.0.1:54321/functions/v1/api-public/process \
  -H "X-Process-Token: mv_..."
```

## Regras de segurança implementadas

- Token opaco de 24 bytes, hash SHA-256 em `sessions`; expiração de 30 dias.
- Rate limit em Postgres por IP/processo (autosave: 120/min por processo).
- Validação de campos no servidor independente do frontend; o endpoint de rascunho só faz merge, sem validar obrigatórios nem avançar etapa.
- CPF normalizado e validado; cliente existente reaproveitado por CPF.
- Snapshot financeiro calculado no servidor; divergência bloqueia o submit.
- Idempotência de webhooks por `(provider, event_hash)`; evento duplicado retorna 200 sem reprocessar.
- Upload com URL assinada, validação de MIME/tamanho e magic bytes.
- Admin com JWT + profile ativo; CPF completo só para papéis sensíveis.
- Ações administrativas gravam `audit_logs` e `process_events`.

## O que falta antes de produção

1. Configurar `ZAPSIGN_API_TOKEN` e substituir `PREENCHER_CONTRATO` pelo token real do template DOCX; validar o envio automático de WhatsApp no plano do ZapSign.
2. Configurar `ASAAS_API_KEY` e cadastrar o webhook do Asaas apontando para `/webhooks/asaas` com o `authToken` igual a `ASAAS_WEBHOOK_TOKEN`.
3. Worker `jobs` com claim, retry/backoff, dead-letter e reaper de `RUNNING` (Drive e mensageria).
4. Adaptador Google Drive (shared drive, pastas por ID, upload e hash).
5. Verificar o domínio `monteiroveloso.com` no Resend (DKIM/SPF) e trocar `EMAIL_MODE` de `test` para `live`.
6. Sessão com cookie `HttpOnly` same-site (hoje o token vai no header).
7. Testes de integração automatizados das Edge Functions (hoje há smoke manual e E2E do formulário).
