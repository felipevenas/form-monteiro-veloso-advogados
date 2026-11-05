-- Requisitos de documentos, planos de pagamento e calendário de feriados.
create table public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references public.product_versions(id) on delete cascade,
  code text not null,
  label text not null,
  description text not null default '',
  required boolean not null default true,
  accepted_mime_types text[] not null default array['application/pdf', 'image/jpeg', 'image/png'],
  max_size_bytes bigint not null default 10485760 check (max_size_bytes > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint document_requirements_product_version_code_key unique (product_version_id, code)
);

create index idx_document_requirements_product_version
  on public.document_requirements(product_version_id, sort_order);

create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references public.product_versions(id) on delete cascade,
  label text not null,
  description text not null default '',
  method text not null check (method in ('PIX', 'BOLETO', 'CARD')),
  mode text not null check (mode in ('AVISTA', 'PARCELADO')),
  total_cents bigint not null check (total_cents > 0),
  signal_cents bigint not null default 0 check (signal_cents >= 0),
  entry_cents bigint not null default 0 check (entry_cents >= 0),
  installment_count integer not null default 1 check (installment_count >= 1),
  due_date_rule jsonb not null default '{"type": "LAST_DAY_OF_MONTH"}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- O valor restante após sinal/entrada precisa ser divisível pelo nº de parcelas
  -- para não sobrar centavo na geração das cobranças.
  constraint payment_plans_amount_split check (
    total_cents >= signal_cents + entry_cents
    and (total_cents - signal_cents - entry_cents) % installment_count = 0
  )
);

create index idx_payment_plans_product_version on public.payment_plans(product_version_id) where active;

create trigger trg_payment_plans_updated_at
  before update on public.payment_plans
  for each row execute function public.touch_updated_at();

-- Feriados usados no cálculo de vencimento (regras FIRST/LAST_BUSINESS_DAY).
-- Carnaval não entra como NATIONAL: não é feriado nacional oficial.
create table public.holidays (
  date date primary key,
  name text not null,
  scope text not null default 'NATIONAL'
    check (scope in ('NATIONAL', 'STATE', 'CITY')),
  created_at timestamptz not null default now()
);

create index idx_holidays_scope on public.holidays(scope);

alter table public.document_requirements enable row level security;
alter table public.payment_plans enable row level security;
alter table public.holidays enable row level security;

create policy "document_requirements_select_staff"
  on public.document_requirements for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

create policy "payment_plans_select_staff"
  on public.payment_plans for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

create policy "holidays_select_staff"
  on public.holidays for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));
