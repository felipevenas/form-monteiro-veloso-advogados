-- Processo de contratação: fonte oficial do estado. O Infinitum (CRM) apenas
-- reflete o status; nenhuma escrita vem de lá.
create table public.contract_processes (
  id uuid primary key default gen_random_uuid(),
  public_code text not null,
  client_id uuid references public.clients(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  product_version_id uuid not null references public.product_versions(id) on delete restrict,
  general_status text not null default 'INICIADO'
    check (general_status in (
      'INICIADO', 'DADOS_PENDENTES', 'VALIDANDO_DADOS', 'DADOS_INVALIDOS',
      'PRONTO_PARA_CONTRATO', 'CONTRATO_EM_GERACAO',
      'AGUARDANDO_ASSINATURA_CLIENTE', 'AGUARDANDO_ASSINATURA_INTERNA',
      'AGUARDANDO_PAGAMENTO', 'AGUARDANDO_DOCUMENTOS',
      'DOCUMENTOS_EM_PROCESSAMENTO', 'DOCUMENTACAO_CONCLUIDA',
      'CONCLUIDO', 'CANCELADO', 'ERRO_REQUER_INTERVENCAO'
    )),
  signature_status text not null default 'NAO_GERADA'
    check (signature_status in (
      'NAO_GERADA', 'PENDENTE', 'ASSINADA_CLIENTE', 'ASSINADA_COMPLETA', 'RECUSADA', 'CANCELADA'
    )),
  payment_status text not null default 'NAO_CRIADO'
    check (payment_status in (
      'NAO_CRIADO', 'PENDENTE', 'PARCIAL', 'PAGO', 'VENCIDO', 'CANCELADO', 'ESTORNADO'
    )),
  documents_status text not null default 'NAO_INICIADA'
    check (documents_status in (
      'NAO_INICIADA', 'PENDENTE', 'EM_ENVIO', 'PARCIAL', 'COMPLETA', 'ERRO'
    )),
  current_step text not null default 'identificacao',
  completed_steps text[] not null default '{}',
  form_data jsonb not null default '{}'::jsonb,
  financial_snapshot jsonb,
  -- Define quando o upload de documentos é liberado para o cliente.
  unlock_condition text not null default 'AFTER_BOTH'
    check (unlock_condition in ('IMMEDIATE', 'AFTER_SIGNATURE', 'AFTER_PAYMENT', 'AFTER_BOTH')),
  attribution jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_processes_public_code_format check (public_code ~ '^[A-Z0-9]{8,10}$'),
  constraint contract_processes_public_code_key unique (public_code),
  constraint contract_processes_form_data_is_object check (jsonb_typeof(form_data) = 'object'),
  constraint contract_processes_attribution_is_object check (jsonb_typeof(attribution) = 'object')
);

create index idx_contract_processes_general_status on public.contract_processes(general_status);
create index idx_contract_processes_product_id on public.contract_processes(product_id);
create index idx_contract_processes_product_version_id on public.contract_processes(product_version_id);
create index idx_contract_processes_client_id on public.contract_processes(client_id);
create index idx_contract_processes_created_at on public.contract_processes(created_at desc);
create index idx_contract_processes_status_created
  on public.contract_processes(general_status, created_at desc);

create trigger trg_contract_processes_updated_at
  before update on public.contract_processes
  for each row execute function public.touch_updated_at();

alter table public.contract_processes enable row level security;

create policy "contract_processes_select_staff"
  on public.contract_processes for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));
