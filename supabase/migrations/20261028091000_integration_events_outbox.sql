-- Idempotência de webhooks: todo evento recebido é registrado antes de ser
-- processado. O hash do corpo + provider evita reprocessar a mesma entrega.
create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text,
  event_hash text not null,
  event_type text,
  contract_process_id uuid references public.contract_processes(id) on delete set null,
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED')),
  raw_payload jsonb not null default '{}'::jsonb,
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint integration_events_provider_event_hash_key unique (provider, event_hash)
);

create index idx_integration_events_status
  on public.integration_events(status, received_at);
create index idx_integration_events_process
  on public.integration_events(contract_process_id)
  where contract_process_id is not null;
create index idx_integration_events_external_event
  on public.integration_events(provider, external_event_id)
  where external_event_id is not null;

alter table public.integration_events enable row level security;
-- Sem policies: acesso exclusivo por Edge Functions com service role.

-- Fila transacional de trabalhos (e-mails, geração de contrato, sync Infinitum).
create table public.outbox_jobs (
  id uuid primary key default gen_random_uuid(),
  contract_process_id uuid references public.contract_processes(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'DEAD_LETTER', 'CANCELLED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 8 check (max_attempts > 0),
  run_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbox_jobs_idempotency_key_key unique (idempotency_key)
);

-- Usado pelo claim_outbox_jobs: só a fatia pendente/falha precisa ser varrida.
create index idx_outbox_jobs_claimable
  on public.outbox_jobs(status, run_at)
  where status in ('PENDING', 'FAILED');

create index idx_outbox_jobs_process on public.outbox_jobs(contract_process_id)
  where contract_process_id is not null;
create index idx_outbox_jobs_locked
  on public.outbox_jobs(locked_at)
  where status = 'RUNNING';

create trigger trg_outbox_jobs_updated_at
  before update on public.outbox_jobs
  for each row execute function public.touch_updated_at();

alter table public.outbox_jobs enable row level security;
-- Sem policies: acesso exclusivo por Edge Functions com service role.
