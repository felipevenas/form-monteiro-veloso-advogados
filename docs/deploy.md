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
- Assinatura interna: `ZAPSIGN_INTERNAL_USER_TOKEN` (token pessoal da Dra. Roberta),
  `ZAPSIGN_INTERNAL_SIGNER_NAME`, `ZAPSIGN_INTERNAL_SIGNER_EMAIL`,
  `ZAPSIGN_INTERNAL_SIGNER_CPF`, `ZAPSIGN_INTERNAL_SIGNER_PHONE` e
  `ZAPSIGN_INTERNAL_SIGNER_PHONE_COUNTRY`. O e-mail precisa ser de uma usuária da conta
  ZapSign e o plano precisa do add-on de assinatura em lote.
- Atualizar `contract_templates.external_template_id` dos 24 templates da v2 (hoje
  `PREENCHER_*`) e marcar `approval_status = APPROVED` com `approved_at`.
- Webhook: `https://lsmfqcqocrwgtfttcliq.supabase.co/functions/v1/webhooks/zapsign`
  com `Authorization: Bearer <ZAPSIGN_WEBHOOK_SECRET>`.
- O envio automático usa `send_automatic_whatsapp: true`; confirmar que o plano do ZapSign
  da cliente inclui WhatsApp.

### Asaas

- Secrets: `ASAAS_API_KEY` e `ASAAS_BASE_URL` (`https://api.asaas.com/v3` em produção,
  `https://api-sandbox.asaas.com/v3` em sandbox).
- Webhook: `https://lsmfqcqocrwgtfttcliq.supabase.co/functions/v1/webhooks/asaas`
  com `authToken` igual a `ASAAS_WEBHOOK_TOKEN` (header `asaas-access-token`).
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_RECEIVED_IN_CASH`,
  `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED` e os eventos de checkout legados.
- Ordem: cliente no Asaas na etapa 2; sinal/entrada só após a assinatura completa; parcelas
  restantes quando o sinal/entrada é pago. A confirmação sempre vem do webhook, nunca do redirect.

### Google Drive

- `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON da service account ou base64) e
  `GOOGLE_DRIVE_ROOT_FOLDER_ID` (pasta do Drive Compartilhado).
- A service account precisa de acesso de editor à pasta raiz. O PDF assinado é copiado para o
  Storage privado e, quando o Drive está configurado, para uma subpasta com o `public_code`.

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

- `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`
- `ZAPSIGN_API_TOKEN`, `ZAPSIGN_WEBHOOK_SECRET`, `ZAPSIGN_INTERNAL_USER_TOKEN`,
  `ZAPSIGN_INTERNAL_SIGNER_NAME`, `ZAPSIGN_INTERNAL_SIGNER_EMAIL`,
  `ZAPSIGN_INTERNAL_SIGNER_CPF`, `ZAPSIGN_INTERNAL_SIGNER_PHONE`,
  `ZAPSIGN_INTERNAL_SIGNER_PHONE_COUNTRY`
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`
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

O worker `jobs` ainda não existe. A geração do contrato e a cobrança inicial são feitas
sincronamente pelo `webhooks`/`api-public` (com idempotência); jobs pendentes continuam
servindo de fallback para reenvio manual.

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
