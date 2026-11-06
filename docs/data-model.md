# Modelo de dados — Monteiro Veloso Advogados

Documento de referência do schema `public` no Supabase (Postgres 17). O Supabase é a
**fonte oficial do estado** de cada processo de contratação; o Infinitum (CRM) apenas
reflete o status em cards e nunca escreve no banco.

## Como rodar local

```bash
npx supabase start          # sobe Postgres, Auth, Storage, Studio e Edge Runtime (Docker)
npx supabase db reset       # aplica supabase/migrations/*.sql e depois supabase/seed.sql
npx supabase gen types typescript --local > src/shared/api/database.types.ts
```

- API: http://127.0.0.1:54321
- Studio: http://127.0.0.1:54323
- Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `npx supabase db lint` valida o SQL (inclui checagens de `security definer` sem `search_path`).

Para validar as policies como um usuário real, use o SQL editor do Studio:

```sql
-- Simula um admin com papel 'juridico'
select set_config('request.jwt.claims', '{"sub":"<uuid-do-profile>","role":"authenticated"}', true);
set local role authenticated;
select * from public.clients_safe limit 5;
reset role;
```

## Diagrama

```mermaid
erDiagram
  profiles ||--o{ human_tasks : "assigned_to"
  products ||--o{ product_versions : "versiona"
  product_versions ||--o{ product_services : "oferece"
  product_services ||--o{ payment_plans : "plano"
  product_services ||--o{ kit_items : "kit"
  product_versions ||--o{ kit_items : "assinatura"
  contract_templates ||--o{ kit_items : "compõe"
  product_versions ||--o{ document_requirements : "exige"
  product_versions ||--o{ payment_plans : "oferta"
  product_versions ||--o{ contract_processes : "instancia"
  products ||--o{ contract_processes : "produto"
  clients ||--o{ contract_processes : "titular"
  contract_processes ||--o{ sessions : "acesso público"
  contract_processes ||--o{ otp_codes : "verificação"
  contract_processes ||--o{ signatures : "assinaturas"
  contract_templates ||--o{ signatures : "template"
  contract_processes ||--o{ payments : "cobranças"
  contract_processes ||--o{ documents : "uploads"
  document_requirements ||--o{ documents : "requisito"
  contract_processes ||--o{ process_events : "timeline"
  contract_processes ||--o{ consent_records : "consentimento"
  contract_processes ||--o{ human_tasks : "tarefas"
  contract_processes ||--o{ message_logs : "mensagens"
  contract_processes ||--o{ alerts : "alertas"
  contract_processes ||--o{ audit_logs : "auditoria"
  contract_processes ||--o{ integration_events : "webhooks"
  contract_processes ||--o{ outbox_jobs : "fila"
  holidays }o--o{ payment_plans : "cálculo de vencimento"
```

Fluxo resumido:

```
produto → versão (form_schema + unlock_condition + kit + requisitos + planos)
        ↓
processo (form_data, status por trilha, snapshot financeiro)
        ├── sessão do cliente (token opaco em cookie HttpOnly)
        ├── assinaturas (ZapSign)
        ├── cobranças (Asaas)
        ├── documentos (Storage → Drive)
        └── eventos / tarefas / alertas / auditoria
```

## Convenções

| Tema | Regra |
| --- | --- |
| Chaves | `uuid` com `gen_random_uuid()`; `public_code` legível para o cliente (8–10 chars `[A-Z0-9]`) |
| Dinheiro | `bigint` em **centavos** (`total_cents`, `amount_cents`) |
| Datas de vencimento | `date` (sem hora), calculadas com `holidays` |
| Timestamps | `timestamptz`, sempre `default now()` |
| Status | `text` + `CHECK` (não `enum` nativo) para permitir novos valores via migration simples |
| JSONB | `form_data`, `payload`, `metadata`, `address`, `attribution`; `jsonb_typeof` validado nas colunas que precisam ser objeto/array |
| Segredos | nunca em tabela. `integration_configurations` guarda só parâmetros não secretos (ids de pasta, prazos); chaves vivem em env das Edge Functions |
| `updated_at` | trigger `public.touch_updated_at()` em todas as tabelas que possuem a coluna |

## Tabelas por domínio

### Equipe

- **profiles** — 1:1 com `auth.users` (`id` FK, `on delete cascade`). `role` ∈
  `owner | admin | juridico | financeiro | atendimento`, `active` controla o acesso.
  Um trigger em `auth.users` cria o profile com `active = false`; o owner ativa e define o papel.

### Catálogo

- **products** — identidade comercial (`slug`, `name`, `short_name`).
- **product_versions** — versão imutável do produto: `form_schema` (jsonb), `unlock_condition`,
  `contract_label`, `status` (DRAFT/APPROVED/RETIRED). O processo aponta para a versão, então
  editar o catálogo nunca altera processos em andamento.
- **contract_templates** — documentos assináveis e suas `required_variables`.
  `external_template_id` é o id no provedor (ZapSign); placeholder `PREENCHER_*` no seed.
- **product_services** — serviços vendidos por versão (`code` único na versão, `total_cents`,
  `active`, `sort_order`). Desde o formulário v2 cada serviço carrega `group_number` (1–4),
  `object_type` (`BANK` | `PUBLIC_ENTITY` | `NONE`), `success_mode`
  (`REDUCAO` | `CLAUSULA_BRANCA` | `CLAUSULA_ADMINISTRATIVA`), `kit_code` (código lógico do kit,
  ex. `ZAPSIGN_CONTRATO_01`) e `requires_vehicle_data`. A configuração de êxito fica no próprio
  serviço (`success_percent`, `success_months`, `success_conditions`, `success_clause`) e é
  definida pela equipe, nunca pelo cliente.
- **kit_items** — quais templates compõem a assinatura de cada versão, com `sort_order` e `signer_role`.
  `service_id` nulo = documento compartilhado por toda a versão (kit v1, 4 documentos). Com
  `service_id`, o item só entra no processo daquele serviço (kit v2: contrato + procuração).
- **document_requirements** — requisitos de upload por versão (`code` único na versão), MIME aceitos e tamanho máximo.
- **payment_plans** — planos por versão (opcionalmente por `service_id`). `due_date_rule` no mesmo
  formato do frontend (`{"type":"FIXED_DAY","day":10}`, `LAST_DAY_OF_MONTH`, `FIRST_BUSINESS_DAY`,
  `LAST_BUSINESS_DAY`) e `discount_percent` para a cláusula de quitação antecipada (0 = em branco).
- **holidays** — feriados usados no cálculo de dias úteis (`scope`: NATIONAL/STATE/CITY).

### Cliente e processo

- **clients** — titular (`full_name`, `cpf` normalizado com 11 dígitos e `unique`, `email`,
  `phone_e164` no formato `+55...`, `address` jsonb, ids externos Asaas/Infinitum).
  `address` usa as chaves do formulário: `cep`, `logradouro`, `numero`, `complemento`,
  `bairro`, `cidade`, `uf` (o frontend mantém camelCase no domínio e converte na borda).
  A qualificação civil fica em colunas próprias: `marital_status`, `profession` e
  `nationality` (padrão `Brasileira`), gravadas a partir da etapa `dados`.
- **contract_processes** — estado oficial. Quatro status independentes
  (`general_status`, `signature_status`, `payment_status`, `documents_status`), `current_step`,
  `completed_steps[]`, `form_data`, `financial_snapshot` (congelado no momento do aceite),
  `unlock_condition` (copiada da versão), `attribution` (UTMs/origem), `version` (otimista).
  `selected_plan_id` guarda o plano; `selected_service_id` guarda o serviço escolhido, que
  define o kit assinado e precisa casar com o `service_id` do plano.
  `public_code` é o identificador exposto ao cliente, nunca o `id`.

### Acesso público

- **sessions** — `token_hash` (SHA-256 hex do token do cookie HttpOnly), `expires_at`,
  `last_seen_at`, `revoked_at`, `user_agent`, `ip_hash` (hash do IP, não o IP).
- **otp_codes** — `code_hash`, `expires_at`, `attempts`, `consumed_at`.

### Assinatura, pagamento e documentos

- **signatures** — um documento por linha (`external_document_id` do ZapSign), `status`,
  `signature_url`, `signed_at`, `last_event_at`. `external_signer_id` guarda o token do cliente e
  `external_internal_signer_id` o da Dra. Roberta (assinatura em lote). O PDF final fica em
  `signed_file_url` e, depois do arquivamento, em `drive_file_id`/`drive_folder_id`.
- **payments** — uma cobrança por linha (`installment_number`, `amount_cents`, `due_date`, `status`),
  com `external_charge_id` único e URLs de fatura/boleto/PIX.
- **documents** — metadados do arquivo (`original_filename`, `mime_type`, `size_bytes`, `sha256`,
  `storage_path`, `storage_status`), `drive_file_id`/`drive_folder_id` após transferência.

### Operação e confiabilidade

- **integration_events** — inbox de webhooks; `unique(provider, event_hash)` garante idempotência.
- **outbox_jobs** — fila transacional com `idempotency_key` único, backoff (`next_attempt_at`),
  `max_attempts` e `DEAD_LETTER`.
- **message_logs** — e-mails/WhatsApp planejados e enviados.
- **human_tasks** — intervenção humana (dados inválidos, erro de integração).
- **audit_logs** — quem fez o quê (`actor_type` ADMIN/CLIENT/SYSTEM), com `metadata`.
- **process_events** — timeline exibida no acompanhamento.
- **consent_records** — prova de aceite (LGPD) com `version`, `ip_hash`, `user_agent`.
- **alerts** — alertas operacionais; no máximo um `OPEN` por `alert_key`.
- **rate_limits** — contadores de janela fixa (`PK (key, window_start)`).
- **integration_configurations** — parâmetros públicos de integração por nome único.

## Índices relevantes

| Índice | Motivo |
| --- | --- |
| `contract_processes(public_code)` unique | lookup público por código |
| `contract_processes(general_status, created_at desc)` | kanban/fila do admin |
| `contract_processes(product_id)`, `(client_id)`, `(product_version_id)`, `(created_at desc)` | filtros e relatórios |
| `clients(cpf)` unique, `idx_clients_full_name_trgm` (GIN pg_trgm) | identidade e busca por nome |
| `sessions(token_hash)` unique, `(process_id, expires_at) where revoked_at is null` | validação de cookie e sessões ativas |
| `payments(contract_process_id, installment_number)` unique, `(status, due_date)` | parcelas e cobranças em atraso |
| `documents(contract_process_id, sha256) where sha256 is not null` | reenvio idempotente |
| `integration_events(provider, event_hash)` unique | deduplicação de webhook |
| `outbox_jobs(idempotency_key)` unique, `(status, run_at) where status in ('PENDING','FAILED')` | claim eficiente |
| `process_events(contract_process_id, created_at desc)`, `audit_logs(contract_process_id, created_at desc)` | timeline/auditoria |
| `alerts(alert_key) where status = 'OPEN'` unique | evita alerta duplicado |
| `holidays(date)` PK | cálculo de dias úteis |

## RLS e privilégios

Regras gerais:

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em **todas** as tabelas de `public`.
2. `anon` não tem **nenhuma** policy e nenhum grant: todo acesso público passa por Edge Functions
   com service role (que ignora RLS).
3. `authenticated` só lê. **Nenhuma policy de INSERT/UPDATE/DELETE** existe para `authenticated`;
   escrever é sempre via Edge Function.
4. `service_role` não tem policy (bypass por padrão) e recebe `ALL` nas tabelas.

Matriz de leitura para `authenticated` (todas as policies exigem `active = true` via `has_role`):

| Tabela | owner/admin | juridico | financeiro | atendimento |
| --- | :-: | :-: | :-: | :-: |
| `profiles` | todos | próprio | próprio | próprio |
| `products`, `product_versions`, `contract_templates`, `kit_items`, `document_requirements`, `payment_plans`, `holidays` | ✓ | ✓ | ✓ | ✓ |
| `contract_processes`, `signatures`, `payments`, `process_events`, `human_tasks`, `audit_logs`, `alerts` | ✓ | ✓ | ✓ | ✓ |
| `clients` (colunas não sensíveis) | ✓ | ✓ | ✓ | ✓ |
| `clients_safe.cpf` / `.address` | ✓ | ✓ | ✓ | — (nulo) |
| `clients_safe.marital_status` / `.profession` / `.nationality` | ✓ | ✓ | ✓ | ✓ |
| `documents` | ✓ | ✓ | ✓ | — (sem policy) |
| `sessions`, `otp_codes`, `integration_events`, `outbox_jobs`, `message_logs`, `consent_records`, `rate_limits`, `integration_configurations` | — | — | — | — |

### Por que `clients_safe`

No Postgres o privilégio de coluna é por *role* (`authenticated`), não por `profile.role`, então
não dá para esconder `cpf` de `atendimento` com `GRANT`/RLS. A solução:

- a tabela `clients` só concede `select (id, full_name, email, phone_e164, created_at, updated_at)`;
- a view `public.clients_safe` (SECURITY DEFINER, `security_barrier`) devolve o registro completo
  e mascara `cpf`/`address` com `case when public.has_sensitive_access() then ... end`;
- a view **não** herda RLS (é definer), por isso filtra explicitamente
  `where public.has_role(array['owner','admin','juridico','financeiro','atendimento'])`.

A policy `clients_select_staff` continua existindo como defesa em profundidade caso um grant
de tabela seja adicionado no futuro.

### Helpers

- `public.has_role(roles text[])` — `exists` em `profiles` para `auth.uid()` com `active`.
- `public.has_sensitive_access()` — `has_role(['owner','admin','juridico','financeiro'])`.
- `public.is_admin()` — `has_role(['owner','admin'])`.
- `public.current_role_name()` — papel do usuário logado.

Todas são `security definer` com `search_path = public, pg_temp` (evitam recursão de RLS) e têm
`EXECUTE` revogado de `anon`/`PUBLIC`.

## RPCs

### `claim_outbox_jobs(p_limit int default 10, p_worker_id text default 'worker') → setof outbox_jobs`

Seleciona `PENDING`/`FAILED` com `run_at <= now()` e `coalesce(next_attempt_at, run_at) <= now()`,
limita entre 1 e 100, usa `FOR UPDATE SKIP LOCKED`, marca `RUNNING` com `locked_at`/`locked_by`
e incrementa `attempt_count`. Só `service_role` pode executar.

```ts
const { data: jobs } = await supabase.rpc('claim_outbox_jobs', { p_limit: 20, p_worker_id: 'outbox-1' })
// ... processa ...
// sucesso:  update status='DONE'
// falha:    status='FAILED', next_attempt_at=now()+backoff  (ou DEAD_LETTER se attempt_count >= max_attempts)
```

### `consume_rate_limit(p_key text, p_limit int, p_window_seconds int) → (allowed, remaining, reset_at)`

Janela fixa alinhada ao epoch, incremento via `insert ... on conflict do update` (atômico sob
concorrência). Faz limpeza oportunista (`~1%` das chamadas remove janelas com mais de 2 dias).
Só `service_role` pode executar.

```ts
const { data } = await supabase.rpc('consume_rate_limit', {
  p_key: `otp:${processId}`,
  p_limit: 5,
  p_window_seconds: 600,
})
```

## Fluxo de assinatura e cobrança

1. **Etapa 2 (contrato e pagamento):** a API cria apenas o cliente no Asaas
   (`clients.external_asaas_customer_id`) e gera o kit do serviço no ZapSign. O cliente é o
   primeiro signatário; a Dra. Roberta é adicionada como signatária interna.
2. **Cliente assina (`doc_signed`):** quando todos os documentos têm a assinatura do cliente, a
   Edge Function chama `POST /sign/` do ZapSign com o `user_token` e os `signer_tokens` da
   advogada. O processo fica em `AGUARDANDO_ASSINATURA_INTERNA`.
3. **Advogada assina:** o PDF final é copiado para o Storage privado e para o Google Drive. Só
   então a cobrança de **sinal/entrada** é criada no Asaas (`POST /payments`).
4. **Sinal/entrada pago:** o webhook do Asaas marca somente a cobrança correspondente como paga,
   cria as **parcelas restantes** e libera a etapa de documentos.

O `financial_snapshot` continua sendo a fonte dos valores; `payments.payment_type` distingue
`SIGNAL`, `ENTRY` e `INSTALLMENT`. Nenhum evento marca todas as cobranças como pagas.

## Seed do produto piloto

- Produto `defesa-busca-apreensao` — "Defesa em Busca e Apreensão", versão 1 `APPROVED`,
  `unlock_condition = AFTER_BOTH`.
- `form_schema` com 5 passos: `dados`, `contrato`, `assinatura`, `pagamento`, `documentos`.
  `dados` usa os nomes de campo (`nome_completo`, `cpf`, `email`, `telefone`, `estado_civil`,
  `profissao`, `nacionalidade`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`);
  `contrato` usa `banco_instituicao_financeira` e `numero_contrato`. Os campos de veículo foram
  removidos: os contratos da esteira não usam placa/modelo.
  O plano é escolhido na mesma tela de `contrato`, a partir de `payment_plans` da versão.
  `assinatura`, `pagamento` e `documentos` são checkpoints sem campos, controlados por status/webhook.
- 4 templates (`PREENCHER_CONTRATO`, `PREENCHER_PROCURACAO`, `PREENCHER_DECLARACAO_HIPOSSUFICIENCIA`,
  `PREENCHER_DECLARACAO_RESIDENCIA`) em `DRAFT`, ligados ao kit na ordem contrato → procuração →
  hipossuficiência → residência. Preencha `external_template_id` e `approved_at` antes de gerar documentos.
- Documentos: `RG_CNH`, `COMPROVANTE_RESIDENCIA`, `CONTRATO_FINANCIAMENTO` (obrigatórios) e
  `DOCUMENTO_VEICULO` (opcional), PDF/JPEG/PNG até 10 MB.
- Planos: `À vista no PIX` (350000 = 50000 de sinal + 1× 300000) e `6x no PIX`
  (350000 = 50000 + 6× 50000), ambos `FIXED_DAY 10`.
- Feriados nacionais de 2026 e 2027 (incluindo 20/11 e Corpus Christi). Carnaval **não** foi
  incluído como `NATIONAL` — se o escritório adotar, cadastrar depois com `scope` apropriado.

### Formulário v2 (DRAFT)

> Criado pela migration `20261105120000_service_kits_form_v2.sql` (não pelo `seed.sql`).

- Versão 2 do mesmo produto (`22222222-2222-4222-8222-222222222223`), `status = DRAFT`,
  mesmo `unlock_condition` (`AFTER_BOTH`) e `contract_label`. Como `findProductContext` só
  aceita `APPROVED`, a v1 publicada continua sendo a única atendida pelo formulário.
- `form_schema` v2: `dados` reúne qualificação, contato e endereço; `contrato` traz o objeto
  (`banco_instituicao_financeira` com `visibleWhen.objectType = BANK`,
  `ente_federativo_e_lei_aplicavel` com `PUBLIC_ENTITY`, ambos ocultos em `NONE`) e
  `descricao_adicional_do_objeto`. `visibleWhen` é resolvido no servidor (`isFieldVisible`);
  campo oculto não é exigido nem normalizado.
- 12 `product_services` (grupos 1–4, `kit_code` `ZAPSIGN_CONTRATO_01`..`12`), todos
  `active = false` e `total_cents = 100000` provisório. O êxito da redução já nasce com 30%
  (`success_percent`); meses/condições e a cláusula administrativa ficam para a equipe.
- 1 `payment_plans` provisório por serviço (`À vista no Pix (configurar)`, 100000 com sinal de
  10000, `active = false`). O `seed.sql` ativa a v2 apenas no ambiente local e varia as quatro
  regras de vencimento para teste; **produção permanece DRAFT/inativa** até a definição dos valores.
- 24 `contract_templates` placeholder: contrato + procuração por serviço
  (`PREENCHER_CONTRATO_01`..`12`, `PREENCHER_PROCURACAO_01`..`12`), `DRAFT`, sem `approved_at`.
  `required_variables` variam com o objeto (`banco_instituicao_financeira`,
  `ente_federativo_e_lei_aplicavel` ou nada no serviço 06) e com o modo de êxito.
- 24 `kit_items` (2 por serviço, `service_id` preenchido; sort 10 = contrato, 20 = procuração).

## Decisões e desvios do spec

1. **`clients` + `clients_safe`** — o spec pedia RLS restringindo CPF a quatro papéis; como RLS não
   opera por coluna, o CPF sai da tabela e é servido pela view mascarada (ver acima). O caminho
   canônico para dados completos continua sendo a Edge Function com service role.
2. **`unlock_condition` também em `product_versions`** — o processo copia o valor no início, para que
   mudar o produto não altere processos em andamento.
3. **`unique(provider, event_hash)` em vez de `external_event_id`** — alguns provedores repetem ou
   omitem o id do evento; o hash do corpo é a chave confiável. `external_event_id` fica indexado.
4. **Índices únicos parciais** em `signatures(contract_process_id, external_document_id)` e
   `documents(contract_process_id, sha256)`: linhas ainda sem id externo/hash não colidem.
5. **`payment_plans_amount_split`** — `CHECK` garante que `total - sinal - entrada` é divisível pelo
   nº de parcelas (evita centavo perdido na geração das cobranças).
6. **`alerts(alert_key) where status='OPEN'` único** — evita alerta duplicado; resolver e reabrir cria nova linha.
7. **Trigger em `auth.users`** cria o profile com `active = false` e papel `atendimento`, exigindo
   ativação por um owner. Sem isso, qualquer signup teria leitura de dados.
8. **Sem Realtime** nesta etapa. Se o dashboard precisar, adicione `contract_processes` e
   `process_events` à publicação `supabase_realtime` — a RLS já limita o que cada admin vê.
9. **`anon` sem grants** e `ALTER DEFAULT PRIVILEGES` removendo o grant automático do Supabase para
   tabelas/sequences/funções novas: qualquer acesso público novo precisa ser explícito.
10. **Kit por serviço** — `kit_items.service_id` nulo mantém o kit v1 compartilhado pela versão;
    com `service_id`, cada serviço assina só o próprio contrato e procuração
    (`ensureSignatureRows` filtra por `selected_service_id`). `product_services` ganhou objeto e
    modo de êxito para que o mesmo schema sirva aos 12 serviços sem duplicar formulário.
11. **Campo condicional no servidor** — `visibleWhen.objectType` é avaliado por
    `isFieldVisible`; sem contexto (serviço ainda não escolhido) o campo fica oculto, então
    `validateStep`/`normalizeStepValues` não exigem nem gravam o objeto antes da hora.

## Validação executada (local)

| Comando | Resultado |
| --- | --- |
| `npx supabase start` | stack completo no Docker, migrations + seed aplicados |
| `npx supabase db reset` | 14 migrations + seed sem erro (repetido 3×, sempre limpo) |
| `npx supabase db lint --level warning` | `No schema errors found` |
| `npx supabase gen types typescript --local` | `src/shared/api/database.types.ts` (708+ linhas) |

Testes manuais de RLS/RPC (feitos via `psql` com `set role` + `request.jwt.claims`):

- `atendimento` → vê processos e clientes, `clients_safe.cpf/address` nulos, `documents` = 0 linhas,
  e tentar `select cpf from clients` falha com `insufficient_privilege`.
- `juridico` → `clients_safe` devolve CPF; `documents` visível.
- `anon` → sem privilégio em `clients_safe` e nas tabelas internas.
- `authenticated` → INSERT em `process_events` bloqueado.
- `consume_rate_limit('k', 2, 60)` → `t/t/f` com `reset_at` fixo na janela.
- `claim_outbox_jobs(1, 'worker')` → 1 job `RUNNING`, `attempt_count = 1`, outro segue `PENDING`.
- `touch_updated_at()` avança `updated_at` no UPDATE.

## Pendências conhecidas

- Preencher `contract_templates.external_template_id` e aprovar (`approval_status = 'APPROVED'`).
- Definir `integration_configurations` (pastas do Drive, remetentes, prazos) — segredos ficam em env.
- Cadastrar feriados estaduais/municipais quando o escritório operar fora de âmbito nacional.
- Definir política de retenção/expurgo de `sessions`, `otp_codes`, `integration_events` e `rate_limits`.
- Job de reaper para `outbox_jobs` em `RUNNING` com `locked_at` antigo (worker morto) — hoje o
  `claim_outbox_jobs` só considera `PENDING`/`FAILED`.
