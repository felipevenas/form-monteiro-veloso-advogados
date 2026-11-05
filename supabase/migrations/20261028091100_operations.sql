-- Comunicação, tarefas humanas, auditoria, timeline, consentimento, alertas,
-- rate limit e parâmetros de integração.
create table public.message_logs (
  id uuid primary key default gen_random_uuid(),
  contract_process_id uuid references public.contract_processes(id) on delete cascade,
  provider text not null,
  message_type text not null,
  recipient text not null,
  template_id text,
  external_message_id text,
  status text not null default 'PLANNED'
    check (status in ('PLANNED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);

create index idx_message_logs_process on public.message_logs(contract_process_id, created_at desc);
create index idx_message_logs_status on public.message_logs(status, scheduled_at);
create index idx_message_logs_external
  on public.message_logs(external_message_id)
  where external_message_id is not null;

alter table public.message_logs enable row level security;
-- Sem policies: acesso exclusivo por Edge Functions com service role.

create table public.human_tasks (
  id uuid primary key default gen_random_uuid(),
  contract_process_id uuid references public.contract_processes(id) on delete cascade,
  task_type text not null,
  description text not null default '',
  assigned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_human_tasks_status on public.human_tasks(status, priority desc, created_at);
create index idx_human_tasks_assigned_to on public.human_tasks(assigned_to)
  where status in ('OPEN', 'IN_PROGRESS');
create index idx_human_tasks_process on public.human_tasks(contract_process_id);

alter table public.human_tasks enable row level security;

create policy "human_tasks_select_staff"
  on public.human_tasks for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('ADMIN', 'CLIENT', 'SYSTEM')),
  actor_id text,
  contract_process_id uuid references public.contract_processes(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_process_created
  on public.audit_logs(contract_process_id, created_at desc);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_staff"
  on public.audit_logs for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

-- Timeline visível para o cliente e para a equipe.
create table public.process_events (
  id uuid primary key default gen_random_uuid(),
  contract_process_id uuid not null references public.contract_processes(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text not null default '',
  payload jsonb not null default '{}'::jsonb,
  actor_type text not null default 'SYSTEM'
    check (actor_type in ('ADMIN', 'CLIENT', 'SYSTEM')),
  actor_id text,
  created_at timestamptz not null default now()
);

create index idx_process_events_process_created
  on public.process_events(contract_process_id, created_at desc);

alter table public.process_events enable row level security;

create policy "process_events_select_staff"
  on public.process_events for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  contract_process_id uuid not null references public.contract_processes(id) on delete cascade,
  consent_type text not null,
  version text not null,
  accepted boolean not null default false,
  accepted_at timestamptz,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_consent_records_process on public.consent_records(contract_process_id, consent_type);

alter table public.consent_records enable row level security;
-- Sem policies: prova de consentimento é lida por Edge Function/relatórios internos.

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  severity text not null default 'WARNING'
    check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  title text not null,
  description text not null default '',
  contract_process_id uuid references public.contract_processes(id) on delete set null,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Um alerta aberto por chave; reabrir cria nova linha só depois de resolver.
create unique index idx_alerts_open_key
  on public.alerts(alert_key)
  where status = 'OPEN';

create index idx_alerts_status on public.alerts(status, severity, created_at desc);
create index idx_alerts_process on public.alerts(contract_process_id)
  where contract_process_id is not null;

alter table public.alerts enable row level security;

create policy "alerts_select_staff"
  on public.alerts for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (key, window_start)
);

create index idx_rate_limits_window_start on public.rate_limits(window_start);

alter table public.rate_limits enable row level security;
-- Sem policies: consumido apenas por consume_rate_limit() como service role.

-- Apenas parâmetros não secretos (ex.: IDs de pasta, prazos, flags). Segredos
-- ficam em variáveis de ambiente das Edge Functions.
create table public.integration_configurations (
  id uuid primary key default gen_random_uuid(),
  integration_name text not null unique,
  configuration jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_configurations_is_object check (jsonb_typeof(configuration) = 'object')
);

create trigger trg_integration_configurations_updated_at
  before update on public.integration_configurations
  for each row execute function public.touch_updated_at();

alter table public.integration_configurations enable row level security;
-- Sem policies: leitura via Edge Function com service role.
