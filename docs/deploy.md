# Deploy

## Estado atual

| Item | Valor |
| --- | --- |
| Projeto Vercel | `felipevenas-projects/form-monteiro-veloso-advogados` |
| Domínio público | `https://form.monteiroveloso.com` — **ativo, HTTPS/SSL OK** |
| Alias Vercel | `https://form-monteiro-veloso-advogados.vercel.app` — protegido por Vercel Authentication |
| Projeto Supabase | `lsmfqcqocrwgtfttcliq` (conta da cliente) |
| Functions | `https://lsmfqcqocrwgtfttcliq.supabase.co/functions/v1` |
| Banco | migrations + seed aplicados |
| Acesso interno | `roberta@monteiroveloso.com` com profile `owner` ativo (operação via Supabase) |
| Cliente no ar | formulário público ativo; contrato/pagamento aguardam credenciais ZapSign/Asaas |

### Testes executados no domínio

- `POST /api-public/session/start` → **201**
- `GET /api-public/process` → **200**
- `PUT /api-public/process/steps/dados` → **200**
- `POST /api-public/process/signature/start` → **200** (contrato em geração sem ZapSign configurado)
- Webhooks ZapSign/Asaas testados com payloads simulados: assinatura libera pagamento; `CHECKOUT_PAID` libera documentos.
- `POST /api-public/process/payment/checkout` sem `ASAAS_API_KEY` → **503** `PROVIDER_UNAVAILABLE`
- `POST /api-public/session/start` sem token Turnstile → **422** `TURNSTILE_REQUIRED`
- `POST /api-public/session/start` com token Turnstile → **201**
- Formulário abre direto na etapa 1, sem landing.
- CORS entre `form.monteiroveloso.com` e `*.supabase.co` validado no navegador.
- Processo de teste removido do banco depois da validação.

> **Limpeza:** nunca apague `contract_processes` em massa em produção. A exclusão em cascata remove `sessions` e invalida imediatamente qualquer link aberto (401). Para testes, remova apenas IDs específicos e avise antes.

## Integrações que faltam configurar

O fluxo já chama os provedores e processa os webhooks, mas produção fica em
`CONTRATO_EM_GERACAO`/pagamento pendente até as credenciais entrarem.

### ZapSign

- Secrets: `ZAPSIGN_API_TOKEN` e, se necessário, `ZAPSIGN_BASE_URL`.
- Atualizar `contract_templates.external_template_id` dos 4 templates (hoje `PREENCHER_*`)
  e marcar `approval_status = APPROVED` com `approved_at`.
- Webhook: `https://lsmfqcqocrwgtfttcliq.supabase.co/functions/v1/webhooks/zapsign`
  com `Authorization: Bearer <ZAPSIGN_WEBHOOK_SECRET>`.
- O envio automático usa `send_automatic_whatsapp: true`; confirmar que o plano do ZapSign
  da cliente inclui WhatsApp.

### Asaas

- Secrets: `ASAAS_API_KEY` e `ASAAS_BASE_URL` (`https://api.asaas.com/v3` em produção,
  `https://api-sandbox.asaas.com/v3` em sandbox).
- Webhook: `https://lsmfqcqocrwgtfttcliq.supabase.co/functions/v1/webhooks/asaas`
  com `authToken` igual a `ASAAS_WEBHOOK_TOKEN` (header `asaas-access-token`).
- Eventos: `CHECKOUT_CREATED`, `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`
  e os eventos de cobrança necessários.
- O retorno do checkout usa `APP_URL` + `/processo/:token?pagamento=retorno`; a confirmação
  sempre vem do webhook, nunca do redirect.

## E-mails transacionais (Resend)

Estado em 02/11: migration aplicada, secrets cadastrados em modo **test** e as três
funções republicadas. Falta apenas publicar os registros DNS na Squarespace.

O domínio `monteiroveloso.com` está no Resend e os e-mails já estão implementados.
Publique estes três registros:

| Tipo | Host (prefixo) | Valor |
| --- | --- | --- |
| `TXT` | `resend._domainkey` | chave DKIM completa exibida no painel do Resend |
| `CNAME` | `rsend` | `rsend-sae1.forge.rmta.net` |
| `CNAME` | `send` | `send.forge.rmta.net` |

Não alterar o MX/SPF do Google Workspace. Passo a passo (com o valor completo do
DKIM) em `docs/integrations/resend.md`.

- Secrets: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_MODE`,
  `EMAIL_TEST_RECIPIENT`, `EMAIL_TEAM_RECIPIENTS`.
- Antes da verificação do domínio: `EMAIL_MODE=test` e
  `EMAIL_FROM="Monteiro Veloso Advogados <onboarding@resend.dev>"`.
- Depois de verificado: `EMAIL_FROM="Monteiro Veloso Advogados <contato@monteiroveloso.com>"`
  e `EMAIL_MODE=live`.

## DNS

Registro aplicado na Squarespace:

| Tipo | Host | Valor |
| --- | --- | --- |
| `CNAME` | `form` | `2d10ede04d4b7b42.vercel-dns-017.com` |

O CNAME atual foi confirmado e a Vercel emitiu o SSL. Não alterar nameservers, MX, SPF, DKIM ou DMARC.

Para revalidar:

```bash
vercel domains verify form.monteiroveloso.com --scope felipevenas-projects
```

## Variáveis na Vercel (Production)

- `VITE_API_MODE=http`
- `VITE_SUPABASE_URL=https://lsmfqcqocrwgtfttcliq.supabase.co`
- `VITE_SUPABASE_ANON_KEY` (publishable key)
- `VITE_APP_URL=https://form.monteiroveloso.com`
- `VITE_TURNSTILE_SITE_KEY=0x4AAAAAAFr4EuwFr1isuRYH` (site key pública)

## Secrets no Supabase

- `APP_URL=https://form.monteiroveloso.com,https://form-monteiro-veloso-advogados.vercel.app,https://form-monteiro-veloso-advogados-ihlzzpxpp-felipevenas-projects.vercel.app`
- `IP_HASH_SALT` (aleatório)
- `TURNSTILE_SECRET` (secret key da Cloudflare)
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_MODE`,
  `EMAIL_TEST_RECIPIENT`, `EMAIL_TEAM_RECIPIENTS` (ver `docs/integrations/resend.md`)

Ainda faltam, quando as integrações forem habilitadas:

- `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`
- `ZAPSIGN_API_TOKEN`, `ZAPSIGN_WEBHOOK_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHARED_DRIVE_ID`, `GOOGLE_ROOT_FOLDER_ID`
- `INFINITUM_*`, `VERTISEL_*`
- `CRON_SECRET`

## Auth (interno)

- Site URL: `https://form.monteiroveloso.com`
- Signup público: desativado
- Acesso interno: perfil `owner` para operação no dashboard do Supabase
- Não há interface administrativa no app.

Se o convite não chegar, verificar spam ou reenviar pelo dashboard do Supabase em **Authentication → Users**. Para redefinir a senha, usar o dashboard do Supabase. Um fluxo self-service de “esqueci minha senha” ainda não foi implementado.

## Funções publicadas

- `api-public` (`verify_jwt=false`)
- `api-admin` (JWT do Supabase)
- `webhooks` (`verify_jwt=false`)

Ao republicar, preserve as flags: `npx supabase functions deploy api-public --no-verify-jwt`
e `npx supabase functions deploy webhooks --no-verify-jwt`.

O worker `jobs` ainda não existe. Submits criam `GENERATE_CONTRACT` e `CREATE_PAYMENTS` em `PENDING`; portanto, **não há geração de contrato nem cobrança automática** até a Fase 2/3.

## Deploy do frontend

```bash
npm run build
vercel --prod --yes --scope felipevenas-projects
```

## Pendências para o fluxo completo

1. Worker `jobs` com claim, retry/backoff e dead-letter.
2. Adaptadores ZapSign, Asaas, Google Drive, Infinitum e Vertisell.
3. Fluxo de redefinição de senha do admin.
4. Atualizar CTAs da landing para `https://form.monteiroveloso.com`.
5. Revisão jurídica/LGPD e política de retenção.
6. Migrar o projeto Vercel para um Team com acesso da cliente, se desejado.

## Observações importantes

- O projeto Supabase está na conta da cliente. O CLI local pode estar autenticado em outra conta; use o `SUPABASE_ACCESS_TOKEN` do `.env` (conta da cliente) em todos os comandos.
- O `Vercel Authentication` está em `all_except_custom_domains`: o domínio customizado é público; os links `*.vercel.app` continuam protegidos.
- Não commitar `.env`, `.env.local` ou `.vercel`.
- **Não divulgar o formulário para clientes reais** até o worker/assinatura/pagamento estarem prontos.
