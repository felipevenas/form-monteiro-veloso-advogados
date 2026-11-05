# Resend — e-mails transacionais

## Papel

O Resend envia os e-mails de jornada do formulário. Ele **não é fonte de verdade**:
o processo continua no Postgres e o envio é registrado em `message_logs`.

| E-mail | Gatilho | Destino | Chave de idempotência |
| --- | --- | --- | --- |
| Recebemos seu cadastro | fim de `startSignature` | cliente | `submission-client:<processId>` |
| Novo processo (interno) | fim de `startSignature` | equipe | `submission-team:<processId>` |
| Processo concluído | `refreshDocumentsStatus` → `CONCLUIDO` | cliente | `completion-client:<processId>` |
| Link de acesso | `POST /session/resume` | cliente | `access-link:<processId>:<token>` |

O e-mail de recebimento é **diferente** do e-mail do ZapSign: o ZapSign envia o
contrato para assinatura; o Resend confirma o cadastro e explica os próximos
passos. Por isso o assunto não menciona “assine”.

## Código

- `supabase/functions/_shared/services/resend-client.ts` — `POST /emails`, timeout de 10 s,
  `Idempotency-Key` e classificação `RETRYABLE`/`PERMANENT`.
- `supabase/functions/_shared/services/email-templates.ts` — HTML + texto puro.
- `supabase/functions/_shared/services/email-service.ts` — modo, destinatário, dedupe,
  registro em `message_logs` e alerta em caso de falha.
- `supabase/functions/_shared/http/background.ts` — `EdgeRuntime.waitUntil`.
- `supabase/migrations/20261102120000_email_delivery.sql` — `message_logs.idempotency_key`.

Falha de envio **nunca** interrompe o formulário. O processo segue normal; a
equipe recebe um alerta com a chave `email-failed:<processId>:<tipo>` e a linha
fica `FAILED` em `message_logs` para reenvio.

## Secrets

Secrets (uma linha só — funciona em PowerShell e bash):

```bash
npx supabase secrets set RESEND_API_KEY=re_... "EMAIL_FROM=Monteiro Veloso Advogados <contato@monteiroveloso.com>" EMAIL_REPLY_TO=roberta@monteiroveloso.com EMAIL_MODE=test EMAIL_TEST_RECIPIENT=roberta@monteiroveloso.com EMAIL_TEAM_RECIPIENTS=roberta@monteiroveloso.com
```

A CLI precisa estar autenticada na conta que é dona do projeto
(`lsmfqcqocrwgtfttcliq`). Se `supabase projects list` não mostrar o projeto,
rode `npx supabase login` com a conta da cliente ou use `SUPABASE_ACCESS_TOKEN`.

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `RESEND_API_KEY` | sim | sem ela, o envio fica desligado |
| `EMAIL_FROM` | recomendada | precisa ser de um domínio verificado |
| `EMAIL_REPLY_TO` | não | padrão `roberta@monteiroveloso.com` |
| `EMAIL_MODE` | não | `off`, `test` ou `live`; sem a variável, `live` quando há chave |
| `EMAIL_TEST_RECIPIENT` | no modo `test` | único destinatário permitido no modo de teste |
| `EMAIL_TEAM_RECIPIENTS` | não | lista separada por vírgula; padrão `EMAIL_REPLY_TO` |
| `VITE_EMAIL_CONFIRMATION` (Vercel) | não | `true` mostra “Enviamos uma confirmação…” na tela final |

## Domínio e DNS

O domínio `monteiroveloso.com` já está no Resend. Estes são os registros **reais**
do painel (02/11), para publicar no DNS da Squarespace:

| Tipo | Host (prefixo no Squarespace) | Valor | TTL |
| --- | --- | --- | --- |
| `TXT` | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCrktyfTfyGqI0WMthl69UpgUcKlCCsJTDJdXd5orqqIFtUOIg7p1utBknoXDrfw1rBk/ZJA2+H9OH6iCNgEYer0liCK5QMo09Q+zl3yb5kDPCwM7+BhnW5E+3fmIQEFFasp9jk7obrQJU9MH0Z+KXDm7HChPLF4mRZyztyWPqv7QIDAQAB` | Auto |
| `CNAME` | `rsend` | `rsend-sae1.forge.rmta.net` | Auto |
| `CNAME` | `send` | `send.forge.rmta.net` | Auto |

No Squarespace, use só o prefixo no campo **Host** (`resend._domainkey`, `rsend`,
`send`) e cole o valor inteiro do TXT — ele é longo e não pode ser quebrado.

**Não altere** o MX, o SPF nem o DKIM do Google Workspace. O Resend usa CNAMEs em
`send`/`rsend` e um seletor próprio de DKIM; o e-mail `@monteiroveloso.com`
continua no Google. Depois de publicar, aguarde a propagação e clique em
**Verify** no painel do Resend.

DMARC hoje não existe. Sugestão (depois de confirmar que Google e Resend passam):

| Tipo | Host | Valor |
| --- | --- | --- |
| `TXT` | `_dmarc.monteiroveloso.com` | `v=DMARC1; p=none; rua=mailto:roberta@monteiroveloso.com;` |

Só endureça para `quarantine`/`reject` após alguns dias de relatórios.

## Modos

- `off` — nenhum envio, nenhum registro novo em `message_logs`.
- `test` — envia **tudo** para `EMAIL_TEST_RECIPIENT` e mostra uma faixa
  “Modo de teste” no topo do HTML. Antes do domínio estar verificado, use
  `EMAIL_FROM="Monteiro Veloso Advogados <onboarding@resend.dev>"`; o Resend só
  entrega, nesse estado, para o e-mail dono da conta.
- `live` — envia ao cliente. Só ative depois do domínio verificado.

## Deploy

O código novo vive em `_shared`, então as três funções precisam ser republicadas.
Use as flags para não mudar a autenticação das rotas públicas:

```bash
npx supabase functions deploy api-public --no-verify-jwt
npx supabase functions deploy webhooks --no-verify-jwt
npx supabase functions deploy api-admin
```

## Verificação

1. `GET https://api.resend.com/domains` deve mostrar `status: verified`.
2. Com `EMAIL_MODE=test`, conclua um cadastro no formulário.
3. Confira em `message_logs`:

```sql
select message_type, recipient, status, error_code, external_message_id, created_at
from public.message_logs
order by created_at desc
limit 10;
```

4. Confira a entrega no painel do Resend (Emails → último envio).
5. Troque `EMAIL_MODE=live` e remova `EMAIL_TEST_RECIPIENT`.

## Troubleshooting

| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| `status = FAILED`, `error_code = validation_error` | domínio ainda não verificado / `EMAIL_FROM` inválido | revisar DNS e `EMAIL_FROM` |
| `RESEND_NOT_CONFIGURED` | secret ausente na função | `supabase secrets set RESEND_API_KEY=...` |
| e-mail não aparece | modo `off` ou cliente sem e-mail | conferir `EMAIL_MODE` e `clients.email` |
| caiu em spam | domínio novo sem histórico/DMARC | publicar DMARC, pedir resposta, evitar anexos |
| duplicado | chave de idempotência apagada | `message_logs.idempotency_key` é a proteção |

## Definition of Done

- [x] Funciona no sandbox do provedor (Resend com domínio de teste).
- [x] Duplo envio/replay não gera duplicidade (`message_logs.idempotency_key`).
- [x] Falha não quebra o fluxo e gera alerta.
- [x] Segredo apenas em Supabase Secrets.
- [x] Runbook neste arquivo.
- [ ] Domínio verificado e `EMAIL_MODE=live` em produção.

## Histórico de validação

02/11/2026 — processo de teste `MVTEST01` criado e removido depois da validação:

- `CLIENT_SUBMISSION` e `TEAM_SUBMISSION` entregues (`last_event = delivered`).
- Segunda chamada ao endpoint não criou novo envio (mesmos `external_message_id`).
- Falha inicial por domínio não verificado foi registrada como `FAILED` com a
  mensagem do Resend, gerou alerta e foi resolvida automaticamente no retry.
- Processo, cliente, sessões, jobs e mensagens de teste removidos; os 5
  processos existentes não foram tocados.
