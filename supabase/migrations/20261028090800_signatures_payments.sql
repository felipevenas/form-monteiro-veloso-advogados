-- Documentos enviados para assinatura (ZapSign). Um processo tem N documentos.
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  contract_process_id uuid not null references public.contract_processes(id) on delete cascade,
  provider text not null default 'zapsign',
  external_document_id text,
  template_id uuid references public.contract_templates(id) on delete set null,
  status text not null default 'NAO_GERADA'
    check (status in (
      'NAO_GERADA', 'PENDENTE', 'ASSINADA_CLIENTE', 'ASSINADA_COMPLETA', 'RECUSADA', 'CANCELADA'
    )),
  signature_url text,
  signed_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O documento externo pode ainda não existir quando a linha é criada (placeholder
-- aguardando o provedor), por isso o índice único é parcial.
create unique index idx_signatures_process_external_document
  on public.signatures(contract_process_id, external_document_id)
  where external_document_id is not null;

create index idx_signatures_process on public.signatures(contract_process_id);
create index idx_signatures_status on public.signatures(status);
create index idx_signatures_template on public.signatures(template_id);

create trigger trg_signatures_updated_at
  before update on public.signatures
  for each row execute function public.touch_updated_at();

alter table public.signatures enable row level security;

create policy "signatures_select_staff"
  on public.signatures for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));

-- Cobranças do Asaas (sinal, entrada e parcelas). Valores em centavos.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  contract_process_id uuid not null references public.contract_processes(id) on delete cascade,
  external_customer_id text,
  external_charge_id text,
  external_installment_id text,
  installment_number integer not null default 1 check (installment_number >= 1),
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'PENDENTE'
    check (status in ('NAO_CRIADO', 'PENDENTE', 'PARCIAL', 'PAGO', 'VENCIDO', 'CANCELADO', 'ESTORNADO')),
  paid_at timestamptz,
  invoice_url text,
  barcode_url text,
  pix_payload text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_process_installment_key unique (contract_process_id, installment_number),
  constraint payments_external_charge_key unique (external_charge_id)
);

create index idx_payments_process on public.payments(contract_process_id);
create index idx_payments_status_due_date on public.payments(status, due_date);
create index idx_payments_customer on public.payments(external_customer_id)
  where external_customer_id is not null;
create index idx_payments_external_installment on public.payments(external_installment_id)
  where external_installment_id is not null;

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.touch_updated_at();

alter table public.payments enable row level security;

create policy "payments_select_staff"
  on public.payments for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']));
