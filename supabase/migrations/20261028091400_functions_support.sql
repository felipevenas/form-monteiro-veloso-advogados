-- Suporte às Edge Functions da Fase 1/2.
--
-- 1. Plano escolhido no processo (a escolha é gravada no wizard, mas o snapshot
--    financeiro só é congelado no submit).
-- 2. Pausa de automação usada pelas ações administrativas PAUSE/RESUME.
-- 3. Bucket privado de staging dos documentos enviados pelo cliente.

alter table public.contract_processes
  add column if not exists selected_plan_id uuid
    references public.payment_plans(id) on delete set null;

alter table public.contract_processes
  add column if not exists automation_paused_at timestamptz;

create index if not exists idx_contract_processes_selected_plan
  on public.contract_processes(selected_plan_id)
  where selected_plan_id is not null;

comment on column public.contract_processes.selected_plan_id is
  'Escolha atual do wizard. O snapshot financeiro congelado permanece em financial_snapshot.';

comment on column public.contract_processes.automation_paused_at is
  'Quando preenchido, o worker não executa jobs deste processo (pausa manual auditada).';

-- Bucket de staging: o navegador recebe uma URL assinada de upload único e o
-- worker move o arquivo para o Drive. Nunca é público.
-- O bloco é tolerante a ambientes onde o schema storage ainda não existe.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'client-documents',
      'client-documents',
      false,
      10485760,
      array['application/pdf', 'image/jpeg', 'image/png']
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;
