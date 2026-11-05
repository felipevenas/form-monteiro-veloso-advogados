-- Catálogo de produtos jurídicos e suas versões publicadas.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- Versão imutável do produto: o processo guarda product_version_id para que
-- mudanças futuras de formulário/preço não alterem processos em andamento.
create table public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'APPROVED', 'RETIRED')),
  form_schema jsonb not null,
  unlock_condition text not null default 'AFTER_BOTH'
    check (unlock_condition in ('IMMEDIATE', 'AFTER_SIGNATURE', 'AFTER_PAYMENT', 'AFTER_BOTH')),
  contract_label text not null default '',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint product_versions_product_version_key unique (product_id, version),
  constraint product_versions_approval_consistency
    check (status <> 'APPROVED' or approved_at is not null)
);

create index idx_product_versions_product_id on public.product_versions(product_id);
create index idx_product_versions_status on public.product_versions(status);

alter table public.products enable row level security;
alter table public.product_versions enable row level security;

create policy "products_select_staff"
  on public.products for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

create policy "product_versions_select_staff"
  on public.product_versions for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));
