-- Catálogo de serviços por versão do produto.
-- O plano de pagamento passa a pertencer a um serviço, permitindo totais diferentes
-- para busca e apreensão, revisional, cobrança etc.

create table public.product_services (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references public.product_versions(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  total_cents bigint not null check (total_cents > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_services_version_code_key unique (product_version_id, code)
);

create index idx_product_services_version
  on public.product_services(product_version_id, sort_order)
  where active;

create trigger trg_product_services_updated_at
  before update on public.product_services
  for each row execute function public.touch_updated_at();

alter table public.product_services enable row level security;

alter table public.payment_plans
  add column service_id uuid references public.product_services(id) on delete cascade;

create index idx_payment_plans_service
  on public.payment_plans(service_id)
  where active;
