-- Templates de documento (contrato, procuração, declarações) e o "kit" assinado
-- por versão de produto.
create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  external_template_id text,
  name text not null,
  template_type text not null
    check (template_type in ('CONTRATO', 'PROCURACAO', 'DECLARACAO_HIPOSSUFICIENCIA', 'DECLARACAO_RESIDENCIA', 'OUTRO')),
  version integer not null default 1 check (version > 0),
  required_variables jsonb not null default '[]'::jsonb,
  approval_status text not null default 'DRAFT'
    check (approval_status in ('DRAFT', 'APPROVED', 'RETIRED')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_templates_approval_consistency
    check (approval_status <> 'APPROVED' or approved_at is not null),
  constraint contract_templates_required_variables_is_array
    check (jsonb_typeof(required_variables) = 'array')
);

-- O id externo é único quando preenchido (placeholders de seed ficam de fora).
create unique index idx_contract_templates_external_id
  on public.contract_templates(external_template_id)
  where external_template_id is not null;

create index idx_contract_templates_type on public.contract_templates(template_type, approval_status);

create trigger trg_contract_templates_updated_at
  before update on public.contract_templates
  for each row execute function public.touch_updated_at();

-- Documentos que compõem a assinatura de uma versão de produto.
create table public.kit_items (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references public.product_versions(id) on delete cascade,
  contract_template_id uuid not null references public.contract_templates(id) on delete restrict,
  sort_order integer not null default 0,
  required boolean not null default true,
  signer_role text not null default 'CLIENTE'
    check (signer_role in ('CLIENTE', 'INTERNO')),
  created_at timestamptz not null default now(),
  constraint kit_items_product_version_template_key unique (product_version_id, contract_template_id)
);

create index idx_kit_items_product_version on public.kit_items(product_version_id, sort_order);
create index idx_kit_items_template on public.kit_items(contract_template_id);

alter table public.contract_templates enable row level security;
alter table public.kit_items enable row level security;

create policy "contract_templates_select_staff"
  on public.contract_templates for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

create policy "kit_items_select_staff"
  on public.kit_items for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));
