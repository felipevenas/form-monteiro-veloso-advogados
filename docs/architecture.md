# Arquitetura

## Visão geral

```text
Vercel (SPA React)
   │  X-Process-Token / Supabase JWT
   ▼
Supabase Edge Functions
   ├── api-public   → sessão, formulário, upload, status
   ├── api-admin    → listas, detalhe, ações auditadas
   ├── webhooks     → Asaas, ZapSign, Vertisell
   ├── jobs         → outbox + régua de follow-up
   └── files        → URL assinada + confirmação de upload
   │
   ├── Postgres (fonte da verdade, RLS, RPCs)
   ├── Storage (staging privado de arquivos)
   └── pg_cron → pg_net → jobs (recorrência sem navegador)
```

Integrações externas ficam atrás de adaptadores: ZapSign, Asaas, Google Drive, Infinitum, Vertisell e e-mail. Nenhuma delas é fonte de verdade do processo.

## Organização do frontend

| Pasta | Responsabilidade | Pode importar |
| --- | --- | --- |
| `pages` | Telas roteadas | `components`, `hooks`, `services`, `types`, `shared` |
| `components` | Componentes de UI da feature | `hooks`, `services`, `types`, `shared/ui` |
| `hooks` | Estado e efeitos reutilizáveis | `services`, `types`, `shared` |
| `services` | Casos de uso, validação de entrada e adaptadores HTTP/mock | `domain`, `types`, `shared` |
| `domain` | Regras puras e máquina de estados (quando a feature tiver) | `types`, `shared/utils` |
| `types` | Tipos e contratos da feature | `domain`, `shared/types` |
| `utils` | Funções puras de apoio à UI/feature | `types`, `shared/utils` |

`components` e `pages` nunca chamam `fetch` diretamente; usam o repositório da feature. `domain` não conhece React, Supabase, `window` nem `fetch`. Cada feature expõe sua API pública por `index.ts`.

## Sessão pública

O processo é identificado por um **token opaco** (`mv_` + 24 bytes aleatórios). O token:

- não é um ID sequencial;
- é enviado no path `/processo/:token` e no header `X-Process-Token`;
- nunca é gravado em `localStorage`;
- é trocado por um cookie `HttpOnly` quando a API estiver no mesmo site (proxy/custom domain);
- expira e pode ser revogado no banco (`sessions.token_hash`).

O cliente pode retomar por magic link/OTP enviado ao e-mail da contratação. A resposta da API não revela se um e-mail existe.

**Evolução:** o adaptador HTTP já aceita cookie (`credentials: include`); falta o proxy same-site para o público. Ver `docs/decisions/ADR-002-sessao-publica.md`.

## Formulário público

O fluxo tem 5 etapas: **Seus dados → Contrato e pagamento → Assinatura → Pagamento → Documentos**.

- As etapas e os campos vêm do `form_schema` do produto; o frontend não conhece regras fixas de contrato.
- Cada alteração nas etapas editáveis (`dados`, `contrato`) é salva em `PUT /process/steps/:step/draft` com debounce de ~900 ms, sem validar obrigatórios e sem avançar `current_step`. O avanço continua em `PUT /process/steps/:step`.
- `dados` junta identificação, dados pessoais e endereço (CEP via ViaCEP no browser, com fallback manual).
- `contrato` junta os dados do financiamento e a escolha do plano. Ao continuar, a API congela o financeiro, registra o consentimento e chama o ZapSign.
- **Assinatura** é um checkpoint: o ZapSign cria os documentos a partir do template e envia o link por e-mail/WhatsApp ao cliente. Depois da assinatura do cliente, a Edge Function assina em lote pela Dra. Roberta (`POST /sign/`). O botão “Prosseguir” só habilita com `ASSINADA_COMPLETA`.
- **Pagamento** segue a ordem do Asaas: cliente no Asaas na etapa 2; sinal/entrada criado só após a assinatura completa; parcelas restantes criadas quando o sinal/entrada é pago. A confirmação vem do webhook do Asaas, nunca do redirect.
- **Documentos** só é liberado após assinatura + pagamento e conclui o processo quando os obrigatórios são enviados.
- O status do autosave e os estados de assinatura/pagamento são anunciados com `aria-live`; a página faz polling de 5 s enquanto aguarda webhook.
- O tema claro/escuro é persistido em `mv:theme` e aplicado em `html[data-theme]`; o formulário abre **sempre no claro** e o escuro é uma escolha do visitante (o botão do cabeçalho alterna). O escuro é escopado a `.public-shell`. A logo é o ícone real da LP aplicado como máscara CSS com `currentColor`.
- Desktop usa o fluxograma rotulado; mobile usa um stepper de pontos com “Etapa X de Y”, sem scroll horizontal.
- Erros de validação aparecem em um resumo focável que linka para o campo; ao trocar de etapa, o foco vai para o título.
- Depois dos documentos, a página vira a confirmação com resumo e próximos passos.

## Estados

Quatro trilhos independentes:

```text
general_status      etapa percebida pelo cliente
signature_status    NAO_GERADA → PENDENTE → ASSINADA_CLIENTE → ASSINADA_COMPLETA
payment_status      NAO_CRIADO → PENDENTE → PARCIAL → PAGO | VENCIDO | CANCELADO | ESTORNADO
documents_status    NAO_INICIADA → PENDENTE → EM_ENVIO → PARCIAL → COMPLETA | ERRO
```

`deriveNextAction(process)` calcula o próximo passo da UI a partir dos trilhos. Nenhuma tela “conclui” uma etapa: ela apenas reflete o evento confirmado pelo provedor.

## Execução assíncrona

1. A API valida e grava o estado.
2. Grava um job em `outbox_jobs` com `idempotency_key` única.
3. Responde 200/202.
4. `pg_cron` chama `jobs` a cada minuto via `pg_net`.
5. O worker reivindica jobs com `claim_outbox_jobs` (`FOR UPDATE SKIP LOCKED`).
6. Sucesso → `DONE`; falha recuperável → backoff; falha definitiva → `DEAD_LETTER` + `human_task` + alerta.

Nada depende de aba aberta. Antes de repetir uma chamada externa, o worker reconcilia pelo ID externo para não duplicar contrato, cobrança ou arquivo.

## Dinheiro e datas

- Centavos inteiros (`bigint`), nunca `float`.
- Vencimentos como `date` (`YYYY-MM-DD`) para não deslocar o dia por fuso.
- Cálculo de dia útil com calendário de feriados versionado.
- Dia fixo 1–28 → parcelamento nativo do Asaas; outras modalidades → cobranças individuais.
- `financial_snapshot` guarda entradas e resultado calculado; mudanças de catálogo não alteram processos antigos.

## Integrações

| Provedor | Papel | Falha | Fallback |
| --- | --- | --- | --- |
| ZapSign | gerar/assinar documentos | job re-tentado; reconciliação por `external_id` | link manual pela operação |
| Asaas | cliente, cobranças, webhooks | job re-tentado; nunca confirma por redirect | cobrança manual registrada |
| Google Drive | arquivo final | retry com backoff | documento permanece no Storage privado |
| Infinitum | mover card | tarefa humana | modo `manual` |
| Vertisell | mensagens | fila de mensagens | e-mail transacional / Meta Cloud API |
| Resend | e-mails transacionais (cadastro, conclusão, link) | `FAILED` + alerta; processo segue | modo `off/test/live` |
| Turnstile | antiabuso | bloqueia submit | rate limit continua ativo |

Cada adaptador classifica erros em `RETRYABLE`, `PERMANENT` ou `MANUAL`. Feature flags (`INFINITUM_MODE`, `VERTISELL_MODE`) permitem desligar um provedor sem deploy de código.

## Arquivos

```text
navegador → URL assinada do Storage (privado)
          → Edge Function valida tipo/tamanho/hash
          → job DRIVE_UPLOAD
          → worker baixa e envia ao Drive
          → grava drive_file_id + remove staging
```

- A service account do Google precisa de **Drive Compartilhado**; service accounts não têm cota no “Meu Drive”.
- Pastas são referenciadas por ID, nunca por caminho textual.
- O navegador nunca recebe credencial do Google.

## Segurança

- `anon` sem policies; público somente via Edge Function.
- Acesso interno via Supabase Auth + `profiles.role` + RLS; escrita via `api-admin`.
- CPF e documentos restritos a `owner/admin/juridico/financeiro`.
- Webhooks com segredo no header e dedupe por `event_hash`.
- Rate limit em Postgres (`consume_rate_limit`).
- CSP, HSTS, `frame-ancestors 'none'` na Vercel.
- Logs sem PII; payload de webhook com retenção curta.

## Deploy

- **Vercel:** build `npm run build`, rewrite SPA, headers de `vercel.json`.
- **Supabase:** migrations via CLI; secrets via `supabase secrets set`.
- **Ambientes:** local (Docker), staging (projeto Supabase separado) e produção.
- **Domínio:** `form.monteiroveloso.com`.
- O projeto Supabase já está no e-mail da cliente; na Vercel, usar Team e convidar a cliente para evitar lock-in.
