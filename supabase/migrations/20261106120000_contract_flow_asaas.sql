-- Fluxo de contratação: variáveis do contrato, vencimentos, assinatura interna
-- e cobranças do Asaas na ordem correta (cliente → sinal/entrada → parcelas).
--
-- Esta migration é aditiva e idempotente. A v2 continua DRAFT; nada aqui
-- publica serviços ou valores para o cliente.

-- ---------------------------------------------------------------------------
-- 1. Configuração de êxito e desconto (definida pela equipe, nunca pelo cliente)
-- ---------------------------------------------------------------------------
alter table public.product_services
  add column if not exists success_percent numeric(5, 2),
  add column if not exists success_months smallint,
  add column if not exists success_conditions text,
  add column if not exists success_clause text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_services_success_percent_check'
  ) then
    alter table public.product_services
      add constraint product_services_success_percent_check
      check (success_percent is null or (success_percent > 0 and success_percent <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_services_success_months_check'
  ) then
    alter table public.product_services
      add constraint product_services_success_months_check
      check (success_months is null or (success_months > 0 and success_months <= 120));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_services_success_conditions_length_check'
  ) then
    alter table public.product_services
      add constraint product_services_success_conditions_length_check
      check (success_conditions is null or char_length(success_conditions) <= 2000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_services_success_clause_length_check'
  ) then
    alter table public.product_services
      add constraint product_services_success_clause_length_check
      check (success_clause is null or char_length(success_clause) <= 4000);
  end if;
end $$;

comment on column public.product_services.success_percent is
  'Percentual de êxito sobre o proveito econômico (ex.: 30.00). Definido pela equipe.';
comment on column public.product_services.success_months is
  'Prazo, em meses, da cláusula de êxito. Definido pela equipe.';
comment on column public.product_services.success_conditions is
  'Condições adicionais do êxito da redução (vai para {{exito_reducao_condicoes}}).';
comment on column public.product_services.success_clause is
  'Cláusula de êxito para os modos CLAUSULA_BRANCA/CLAUSULA_ADMINISTRATIVA.';

alter table public.payment_plans
  add column if not exists discount_percent numeric(5, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payment_plans_discount_percent_check'
  ) then
    alter table public.payment_plans
      add constraint payment_plans_discount_percent_check
      check (discount_percent >= 0 and discount_percent <= 100);
  end if;
end $$;

comment on column public.payment_plans.discount_percent is
  'Desconto por quitação antecipada, em percentual. 0 = cláusula em branco.';

-- Produtos de redução já trazem o êxito fixo de 30% no modelo (cláusula 5.4.1).
update public.product_services
set success_percent = 30
where success_mode = 'REDUCAO'
  and success_percent is null;

-- ---------------------------------------------------------------------------
-- 2. Trilha da assinatura interna (Dra. Roberta) e arquivo final
-- ---------------------------------------------------------------------------
alter table public.signatures
  add column if not exists external_signer_id text,
  add column if not exists external_internal_signer_id text,
  add column if not exists signed_file_url text,
  add column if not exists drive_file_id text,
  add column if not exists drive_folder_id text;

comment on column public.signatures.external_signer_id is
  'Token do signatário cliente no ZapSign.';
comment on column public.signatures.external_internal_signer_id is
  'Token da signatária interna (Dra. Roberta) no ZapSign, usado na assinatura em lote.';
comment on column public.signatures.signed_file_url is
  'URL do PDF assinado no ZapSign (temporária; o arquivo é copiado para o Storage/Drive).';
comment on column public.signatures.drive_file_id is
  'ID do PDF assinado no Google Drive.';
comment on column public.signatures.drive_folder_id is
  'Pasta do processo no Google Drive.';

create index if not exists idx_signatures_external_signer
  on public.signatures(external_signer_id)
  where external_signer_id is not null;
create index if not exists idx_signatures_internal_signer
  on public.signatures(external_internal_signer_id)
  where external_internal_signer_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Remove os campos de veículo do formulário (os contratos não os usam)
-- ---------------------------------------------------------------------------
do $$
declare
  v record;
  new_steps jsonb;
begin
  for v in select id, form_schema from public.product_versions loop
    if jsonb_typeof(v.form_schema -> 'steps') <> 'array' then
      continue;
    end if;

    select jsonb_agg(
      case
        when step ->> 'id' = 'contrato' then
          jsonb_set(
            step,
            '{fields}',
            coalesce(
              (
                select jsonb_agg(field)
                from jsonb_array_elements(step -> 'fields') as field
                where field ->> 'name' not in ('placa_veiculo', 'modelo_veiculo')
              ),
              '[]'::jsonb
            ),
            true
          )
        else step
      end
      order by ord
    )
    into new_steps
    from jsonb_array_elements(v.form_schema -> 'steps') with ordinality as t(step, ord);

    update public.product_versions
    set form_schema = jsonb_set(form_schema, '{steps}', new_steps, true)
    where id = v.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. v2: número do contrato (opcional) no objeto bancário
-- ---------------------------------------------------------------------------
do $$
declare
  v_version_id uuid := '22222222-2222-4222-8222-222222222223';
  v_schema jsonb;
  v_steps jsonb;
begin
  select form_schema into v_schema
  from public.product_versions
  where id = v_version_id;

  if v_schema is null then
    return;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_schema -> 'steps') as step,
         jsonb_array_elements(step -> 'fields') as field
    where step ->> 'id' = 'contrato'
      and field ->> 'name' = 'numero_contrato'
  ) then
    return;
  end if;

  select jsonb_agg(
    case
      when step ->> 'id' = 'contrato' then
        jsonb_set(
          step,
          '{fields}',
          (step -> 'fields') || jsonb_build_array(
            jsonb_build_object(
              'name', 'numero_contrato',
              'label', 'Número do contrato (opcional)',
              'type', 'text',
              'required', false,
              'placeholder', 'Se tiver em mãos',
              'maxLength', 80,
              'colSpan', 1,
              'visibleWhen', jsonb_build_object('objectType', 'BANK')
            )
          ),
          true
        )
      else step
    end
    order by ord
  )
  into v_steps
  from jsonb_array_elements(v_schema -> 'steps') with ordinality as t(step, ord);

  update public.product_versions
  set form_schema = jsonb_set(v_schema, '{steps}', v_steps, true)
  where id = v_version_id;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Templates da v2: variáveis geradas pela automação
-- ---------------------------------------------------------------------------
update public.contract_templates
set required_variables = required_variables || '["valor_total_extenso"]'::jsonb
where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12'
)
and not required_variables ? 'valor_total_extenso';

update public.contract_templates
set required_variables = required_variables || '["numero_contrato"]'::jsonb
where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12'
)
and not required_variables ? 'numero_contrato';

notify pgrst, 'reload schema';
