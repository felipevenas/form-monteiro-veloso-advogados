# Contrato da API

Base local: `http://127.0.0.1:54321/functions/v1`
Base de produção: `https://<project-ref>.supabase.co/functions/v1` (ou proxy same-site).

## Convenções

### Autenticação

| Superfície | Como autentica |
| --- | --- |
| Pública | `X-Process-Token: mv_...` (token opaco do processo) |

A sessão pública dura 30 dias e é **renovada a cada uso** (expiração deslizante). Token ausente, revogado, expirado ou de processo removido retorna **401**; o frontend interrompe o autosave e mostra a tela “Sessão expirada” com as opções de começar novamente ou solicitar novo link.
| Admin | `Authorization: Bearer <supabase-jwt>` |
| Webhooks Asaas | header configurado no painel do Asaas (`asaas-access-token`) |
| Webhooks ZapSign | `Authorization: Bearer <ZAPSIGN_WEBHOOK_SECRET>` |
| Jobs | `X-Cron-Secret: <CRON_SECRET>` |

### Headers

| Header | Uso |
| --- | --- |
| `Content-Type: application/json` | todas as escritas |
| `X-Process-Token` | APIs públicas |
| `Idempotency-Key` | writes sujeitos a retry |
| `X-Cron-Secret` | worker |
| `X-Request-Id` | correlação (gerado se ausente) |

### Envelope de erro

```json
{
  "error": {
    "code": "FINANCIAL_VALIDATION",
    "message": "A soma de sinal, entrada e parcelas não fecha com o valor total.",
    "details": { "expected": 350000, "received": 349999 }
  }
}
```

Códigos estáveis (não traduzir): `INVALID_INPUT`, `INVALID_STEP`, `STEP_OUT_OF_ORDER`, `CONSENT_REQUIRED`, `INCOMPLETE_STEPS`, `PLAN_NOT_FOUND`, `SIGNATURE_REQUIRED`, `FINANCIAL_VALIDATION`, `PROCESS_NOT_FOUND`, `DOCUMENTS_LOCKED`, `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `INTERNAL_ERROR`.

`message` é exibível ao cliente e não contém detalhe interno. `details` nunca contém PII.

## API pública

### `POST /api-public/session/start`

Cria processo + sessão. Não exige conta.

```json
{
  "productSlug": "defesa-busca-apreensao",
  "attribution": { "utm_source": "google", "utm_campaign": "busca-apreensao" }
}
```

**201**

```json
{
  "token": "mv_7f3c...",
  "process": { "...": "ContractProcess" }
}
```

Regras: Turnstile obrigatório; rate limit por IP; `public_code` aleatório; nenhum dado pessoal no token.

### `POST /api-public/session/resume`

```json
{ "email": "cliente@email.com" }
```

Sempre **202**, com a mesma resposta, exista ou não o e-mail. Envia magic link/OTP se houver processo ativo.

### `GET /api-public/process`

**200** → `ContractProcess` (ver DTO). **404** se o token expirou/foi revogado.

### `PUT /api-public/process/steps/:step`

`step` ∈ `dados | contrato` (etapas editáveis). `assinatura`, `pagamento` e `documentos` são checkpoints controlados por status, não por campos.

```json
{ "values": { "fullName": "Ana Souza", "cpf": "529.982.247-25" } }
```

Validação Zod no servidor, independente do frontend. Salva rascunho e avança `current_step`.

- `dados` → junta identificação, dados pessoais e endereço; cria/atualiza o cliente e o endereço.
- `contrato` → salva os dados do financiamento; o plano é escolhido na mesma tela e enviado em `PUT /process/plan`.

### `PUT /api-public/process/steps/:step/draft`

Autosave do formulário. Não valida campos obrigatórios e **não** avança `current_step`.

```json
{ "values": { "fullName": "Ana" } }
```

**200**

```json
{ "savedAt": "2026-10-29T12:34:56.000Z" }
```

Regras: merge profundo em `form_data`; etapa inválida retorna `422 INVALID_STEP`; rate limit de 120 requisições por minuto por processo. O frontend envia com debounce (~900 ms) e faz flush ao trocar de etapa.

### CEP

O CEP é consultado no browser pelo ViaCEP (`https://viacep.com.br/ws/:cep/json/`). O preenchimento automático é conveniência: em caso de indisponibilidade ou CEP inexistente, o cliente preenche o endereço manualmente e o submit continua normalmente.

### `PUT /api-public/process/plan`

```json
{ "planId": "parcelado-pix-6x" }
```

Seleciona o plano e avança para `assinatura`. O snapshot financeiro é congelado em `POST /process/signature/start`.

### `POST /api-public/process/signature/start`

Fecha os dados, congela o financeiro, cria as linhas de assinatura/pagamento, registra o consentimento e dispara o contrato para o ZapSign. O ZapSign envia o link por e-mail e WhatsApp automaticamente.

```json
{
  "planId": "parcelado-pix-6x",
  "consentVersion": "2026-01",
  "consentAccepted": true
}
```

**200** → processo com `general_status = CONTRATO_EM_GERACAO` enquanto os documentos são criados; depois `AGUARDANDO_ASSINATURA_CLIENTE`.

Regras: exige `dados` e `contrato` concluídos e plano válido; cria 4 assinaturas do kit; é idempotente (pode ser chamado de novo para reenviar). Sem `ZAPSIGN_API_TOKEN` ou com template `PREENCHER_CONTRATO`, o processo fica em `CONTRATO_EM_GERACAO` e gera alerta para a equipe.

### `POST /api-public/process/payment/checkout`

Cria (ou reaproveita) um checkout hospedado no Asaas e devolve o link.

```json
{ "checkoutUrl": "https://sandbox.asaas.com/checkoutSession/show/..." }
```

Regras: exige assinatura (`ASSINADA_CLIENTE` ou `ASSINADA_COMPLETA`); `callback.successUrl` volta para `/processo/:token?pagamento=retorno`; a confirmação **não** vem do redirect, e sim do webhook `CHECKOUT_PAID`. Sem `ASAAS_API_KEY`, retorna **503** `PROVIDER_UNAVAILABLE` e gera alerta.

### `POST /api-public/process/submit`

Alias antigo de `POST /process/signature/start`, mantido para abas abertas antes do deploy.

### `POST /api-public/process/documents/upload-url`

```json
{
  "requirementId": "rg-cnh",
  "filename": "rg.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 845000
}
```

**200**

```json
{
  "uploadUrl": "https://<project>.supabase.co/storage/v1/object/upload/sign/...",
  "path": "<process_id>/<uuid>.pdf",
  "expiresAt": "2026-10-28T12:10:00.000Z"
}
```

O browser faz `PUT` direto no Storage. A URL é de uso único e curta.

### `POST /api-public/process/documents/complete`

```json
{
  "requirementId": "rg-cnh",
  "path": "<process_id>/<uuid>.pdf",
  "filename": "rg.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 845000
}
```

Valida magic bytes, tamanho e hash; grava `documents`; enfileira `DRIVE_UPLOAD`. **409** se os documentos ainda não estiverem liberados.

### `DELETE /api-public/process/documents/:requirementId`

Marca como pendente (soft delete do metadado; o arquivo no Drive é tratado pela política de retenção).

## API administrativa

Todas exigem JWT + papel ativo.

| Método | Rota | Papéis |
| --- | --- | --- |
| GET | `/api-admin/processes?status=&q=&cursor=` | todos |
| GET | `/api-admin/processes/:id` | todos (CPF completo só owner/admin/juridico/financeiro) |
| POST | `/api-admin/processes/:id/actions` | owner/admin/juridico/financeiro |
| GET/PUT | `/api-admin/products` | owner/admin |
| GET/PUT | `/api-admin/templates` | owner/admin/juridico |
| GET | `/api-admin/jobs?status=` | owner/admin |
| POST | `/api-admin/jobs/:id/retry` | owner/admin |
| GET | `/api-admin/alerts` | owner/admin |

### Ações

```json
{
  "action": "RETRY_JOB",
  "payload": { "jobId": "..." },
  "reason": "Asaas retornou 502"
}
```

Ações permitidas: `RETRY_JOB`, `PAUSE_AUTOMATION`, `RESUME_AUTOMATION`, `RESEND_SIGNATURE`, `RESEND_PAYMENT`, `CORRECT_DATA`, `CANCEL_PROCESS`, `MOVE_CARD`, `MARK_MANUAL_PAYMENT`.

Toda ação grava `audit_logs` com ator, motivo e diff. `MARK_MANUAL_PAYMENT` exige papel financeiro e confirmação dupla.

## Webhooks

Os webhooks persistem o evento em `integration_events` e processam o estado da assinatura/pagamento na mesma chamada. A outbox continua disponível para integrações lentas (Drive, mensageria), mas não é necessária para liberar etapas do formulário. Eventos repetidos são idempotentes porque o estado é recalculado a partir das linhas atuais.

### `POST /webhooks/asaas`

- Valida o token configurado no Asaas (`asaas-access-token`).
- Persiste o payload usando `event.id` como `event_hash`.
- Processa eventos de checkout (`CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`) e de cobrança (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`).
- `CHECKOUT_PAID` marca todas as parcelas como pagas, libera `documentos` e atualiza `current_step`.
- Responde **200** depois de persistir/processar.

### `POST /webhooks/zapsign`

- Valida o header secreto.
- Como o payload não traz um ID de evento estável, o `event_hash` é `sha256(event_type + doc_token + signer_token + signed_at)`.
- Processa `doc_signed`, `doc_refused` e `doc_deleted` na mesma chamada.
- Quando todos os documentos do kit estão assinados, atualiza `signature_status = ASSINADA_COMPLETA`, `current_step = pagamento` e libera o checkout.
- Responde 200 depois de persistir/processar.

Eventos: `doc_created`, `doc_signed`, `doc_refused`, `doc_deleted`, `email_bounce`.

### `POST /webhooks/vertisell`

Opcional e dependente da API contratada. Usado para pausar a régua quando o cliente responde. Sem esse endpoint, a pausa automática por resposta não existe — apenas por assinatura/pagamento e pausa manual.

## Jobs

### `POST /jobs/run`

Chamado pelo `pg_cron` a cada minuto.

```http
X-Cron-Secret: <CRON_SECRET>
```

Processa lote pequeno de `outbox_jobs` e retorna:

```json
{ "claimed": 10, "done": 9, "retried": 1, "deadLetter": 0 }
```

Se houver backlog, o worker se reagenda via `pg_net` em vez de extrapolar o tempo da função.

## Rate limits sugeridos

| Chave | Limite |
| --- | --- |
| IP / início de sessão | 10 / hora |
| Sessão / leitura | 120 / minuto |
| Processo / autosave | 120 / minuto |
| Processo / assinatura (início/reenvio) | 10 / hora |
| Processo / checkout | 20 / hora |
| Processo / upload | 20 / hora |
| Processo / contrato | 3 / dia |
| Provedor ZapSign | 60 / minuto |
| Provedor Asaas | 100 / minuto |

Ao estourar: **429** + `RATE_LIMITED` + evento em `rate_limits`. Turnstile não substitui esse controle.

## DTO `ContractProcess`

```ts
interface ContractProcess {
  id: string
  publicCode: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  product: {
    id: string
    slug: string
    name: string
    shortName: string
    description: string
    version: number
    contractLabel: string
    unlockCondition: 'IMMEDIATE' | 'AFTER_SIGNATURE' | 'AFTER_PAYMENT' | 'AFTER_BOTH'
    formSchema: FormStep[]
    paymentPlans: PaymentPlan[]
  }
  client: Partial<ClientData>
  generalStatus: GeneralStatus
  signatureStatus: SignatureStatus
  paymentStatus: PaymentStatus
  documentsStatus: DocumentsStatus
  financial: FinancialSnapshot | null
  selectedPlanId: string | null
  currentStep: WizardStepId
  completedSteps: WizardStepId[]
  signature: { status: SignatureStatus; documents: SignatureDocumentState[] } | null
  payment: { status: PaymentStatus; charges: PaymentCharge[]; checkoutUrl: string | null } | null
  documents: DocumentState[]
  consent: { version: string; acceptedAt: string } | null
  attribution: Record<string, string>
  events: ProcessEvent[]
}
```

O payload público **não** inclui IDs internos de banco, CPF completo de terceiros, segredos ou URLs permanentes de arquivo.
