-- Documentos enviados pelo cliente (RG/CNH, comprovante, contrato, CRLV).
-- A linha só referencia o arquivo: bytes ficam no Storage e, depois, no Drive.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  contract_process_id uuid not null references public.contract_processes(id) on delete cascade,
  document_requirement_id uuid not null references public.document_requirements(id) on delete restrict,
  document_type text,
  required boolean not null default true,
  original_filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text,
  storage_path text,
  storage_status text not null default 'PENDING'
    check (storage_status in ('PENDING', 'UPLOADED', 'TRANSFERRED', 'ERROR')),
  drive_file_id text,
  drive_folder_id text,
  uploaded_at timestamptz,
  stored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_sha256_format check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$')
);

create index idx_documents_process on public.documents(contract_process_id);
create index idx_documents_requirement on public.documents(contract_process_id, document_requirement_id);
create index idx_documents_storage_status on public.documents(storage_status);
create index idx_documents_drive_file on public.documents(drive_file_id)
  where drive_file_id is not null;

-- Reenvio do mesmo arquivo no mesmo processo é idempotente.
create unique index idx_documents_process_sha256
  on public.documents(contract_process_id, sha256)
  where sha256 is not null;

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.touch_updated_at();

alter table public.documents enable row level security;

-- Metadados de documentos (nomes de arquivo, ids do Drive) são sensíveis:
-- 'atendimento' não recebe policy e o acesso é feito via Edge Function.
create policy "documents_select_sensitive_roles"
  on public.documents for select
  to authenticated
  using (public.has_role(array['owner', 'admin', 'juridico', 'financeiro']));
