-- Cliente (pessoa física) do escritório. CPF normalizado, sem pontuação.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  cpf text not null,
  email text,
  phone_e164 text,
  address jsonb not null default '{}'::jsonb,
  external_asaas_customer_id text,
  infinitum_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_cpf_format check (cpf ~ '^[0-9]{11}$'),
  constraint clients_phone_e164_format check (phone_e164 is null or phone_e164 ~ '^\+55[0-9]{10,11}$'),
  constraint clients_address_is_object check (jsonb_typeof(address) = 'object'),
  constraint clients_cpf_key unique (cpf)
);

create unique index idx_clients_asaas_customer
  on public.clients(external_asaas_customer_id)
  where external_asaas_customer_id is not null;

create index idx_clients_infinitum_record
  on public.clients(infinitum_record_id)
  where infinitum_record_id is not null;

create index idx_clients_created_at on public.clients(created_at desc);

-- Busca por nome no admin (ILIKE '%...%' não usa B-tree).
create index idx_clients_full_name_trgm on public.clients using gin (full_name extensions.gin_trgm_ops);

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.touch_updated_at();

alter table public.clients enable row level security;

create policy "clients_select_staff"
  on public.clients for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

-- CPF e endereço são dados sensíveis. Privilégio de coluna no Postgres não varia
-- por profile.role, então a leitura completa passa por esta view: ela mascara os
-- campos para 'atendimento' e libera para owner/admin/juridico/financeiro.
-- A view é SECURITY DEFINER e por isso NÃO herda a RLS de clients; o controle de
-- acesso é o WHERE explícito abaixo.
create view public.clients_safe
with (security_invoker = false, security_barrier = true)
as
select
  c.id,
  c.full_name,
  case when public.has_sensitive_access() then c.cpf end as cpf,
  c.email,
  c.phone_e164,
  case when public.has_sensitive_access() then c.address end as address,
  c.created_at,
  c.updated_at
from public.clients c
where public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']);

comment on view public.clients_safe is
  'Leitura de clientes para a equipe. cpf/address vêm nulos para o papel atendimento; escrita sempre via Edge Function.';
