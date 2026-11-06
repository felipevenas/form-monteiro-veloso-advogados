-- Formulário v2: catálogo de serviços com kit documental próprio.
--
-- Nesta rodada entram apenas os dados que o cliente responde (qualificação,
-- endereço, serviço e objeto). Honorários/êxito continuam derivados do plano.
-- A v2 nasce como DRAFT com serviços, planos e templates inativos/rascunho:
-- nada é publicado e a v1 (APPROVED) permanece intocada.

-- ---------------------------------------------------------------------------
-- 1. Metadados do serviço (grupo comercial, objeto e cláusula de êxito)
-- ---------------------------------------------------------------------------
alter table public.product_services
  add column if not exists group_number smallint not null default 1,
  add column if not exists object_type text not null default 'NONE',
  add column if not exists success_mode text not null default 'CLAUSULA_BRANCA',
  add column if not exists kit_code text,
  add column if not exists requires_vehicle_data boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_services_group_number_check'
  ) then
    alter table public.product_services
      add constraint product_services_group_number_check
      check (group_number between 1 and 4);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_services_object_type_check'
  ) then
    alter table public.product_services
      add constraint product_services_object_type_check
      check (object_type in ('BANK', 'PUBLIC_ENTITY', 'NONE'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_services_success_mode_check'
  ) then
    alter table public.product_services
      add constraint product_services_success_mode_check
      check (success_mode in ('REDUCAO', 'CLAUSULA_BRANCA', 'CLAUSULA_ADMINISTRATIVA'));
  end if;
end $$;

comment on column public.product_services.group_number is
  'Grupo comercial do serviço (1–4); organiza a escolha do serviço no formulário.';
comment on column public.product_services.object_type is
  'Objeto do contrato: BANK, PUBLIC_ENTITY ou NONE. Controla campos visíveis e variáveis do template.';
comment on column public.product_services.success_mode is
  'Cláusula de êxito: REDUCAO, CLAUSULA_BRANCA ou CLAUSULA_ADMINISTRATIVA.';
comment on column public.product_services.kit_code is
  'Código lógico do kit documental (ex.: ZAPSIGN_CONTRATO_01).';
comment on column public.product_services.requires_vehicle_data is
  'Indica se o formulário precisa de placa/modelo do veículo.';

-- ---------------------------------------------------------------------------
-- 2. Kit por serviço e serviço escolhido no processo
-- ---------------------------------------------------------------------------
alter table public.kit_items
  add column if not exists service_id uuid references public.product_services(id) on delete cascade;

create index if not exists idx_kit_items_service on public.kit_items(service_id);

comment on column public.kit_items.service_id is
  'Serviço dono do item. Nulo no kit v1, que é compartilhado por toda a versão.';

alter table public.contract_processes
  add column if not exists selected_service_id uuid references public.product_services(id) on delete set null;

create index if not exists idx_contract_processes_selected_service
  on public.contract_processes(selected_service_id);

comment on column public.contract_processes.selected_service_id is
  'Serviço escolhido pelo cliente; define o kit assinado e o plano aceito.';

-- ---------------------------------------------------------------------------
-- 3. Qualificação civil do cliente (vem do formulário, não do contrato)
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists marital_status text,
  add column if not exists profession text,
  add column if not exists nationality text default 'Brasileira';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_marital_status_check'
  ) then
    alter table public.clients
      add constraint clients_marital_status_check
      check (
        marital_status is null
        or marital_status in (
          'solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel', 'uniao-estavel'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clients_profession_length_check'
  ) then
    alter table public.clients
      add constraint clients_profession_length_check
      check (profession is null or char_length(profession) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clients_nationality_length_check'
  ) then
    alter table public.clients
      add constraint clients_nationality_length_check
      check (nationality is null or char_length(nationality) <= 80);
  end if;
end $$;

comment on column public.clients.marital_status is
  'Estado civil informado no formulário (solteiro, casado, divorciado, viuvo, uniao_estavel).';
comment on column public.clients.profession is
  'Profissão informada no formulário.';
comment on column public.clients.nationality is
  'Nacionalidade informada no formulário; padrão Brasileira.';

-- A view mantém a máscara de cpf/address e passa a expor a qualificação.
-- As colunas novas entram no fim para preservar o contrato existente da view.
create or replace view public.clients_safe
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
  c.updated_at,
  c.marital_status,
  c.profession,
  c.nationality
from public.clients c
where public.has_role(array['owner', 'admin', 'juridico', 'financeiro', 'atendimento']);

comment on view public.clients_safe is
  'Leitura de clientes para a equipe. cpf/address vêm nulos para o papel atendimento; escrita sempre via Edge Function.';

-- ---------------------------------------------------------------------------
-- 4. Produto base e versão 2 (DRAFT)
--
-- O produto também é criado no seed.sql. A migration roda antes do seed em um
-- banco limpo, então garante a linha base com ON CONFLICT para que o v2 tenha
-- FK válida nos dois caminhos (produção já existente e `db reset` limpo).
-- ---------------------------------------------------------------------------
insert into public.products (id, slug, name, short_name, description, active)
values (
  '11111111-1111-4111-8111-111111111111',
  'defesa-busca-apreensao',
  'Defesa em Busca e Apreensão',
  'Busca e Apreensão',
  'Assessoria jurídica para defesa em ação de busca e apreensão de veículo financiado.',
  true
)
on conflict (id) do nothing;

insert into public.product_versions (
  id, product_id, version, status, form_schema, unlock_condition, contract_label, approved_at
)
values (
  '22222222-2222-4222-8222-222222222223',
  '11111111-1111-4111-8111-111111111111',
  2,
  'DRAFT',
  $flow$
{
  "version": 2,
  "steps": [
    {
      "id": "dados",
      "title": "Seus dados",
      "description": "Dados pessoais, contato e endereço usados no contrato e nos documentos.",
      "fields": [
        { "name": "nome_completo", "label": "Nome completo", "type": "text", "required": true, "autocomplete": "name", "placeholder": "Como está no seu documento", "maxLength": 160, "colSpan": 2 },
        { "name": "cpf", "label": "CPF", "type": "text", "required": true, "mask": "cpf", "inputmode": "numeric", "placeholder": "000.000.000-00", "maxLength": 14, "colSpan": 1 },
        { "name": "telefone", "label": "WhatsApp", "type": "tel", "required": true, "mask": "phone", "autocomplete": "tel", "placeholder": "(71) 99999-9999", "hint": "O contrato será enviado para este número.", "maxLength": 20, "colSpan": 1 },
        { "name": "email", "label": "E-mail", "type": "email", "required": true, "autocomplete": "email", "placeholder": "voce@email.com", "maxLength": 254, "colSpan": 2 },
        { "name": "estado_civil", "label": "Estado civil", "type": "select", "required": true, "options": ["solteiro","casado","divorciado","viuvo","uniao_estavel"], "colSpan": 1 },
        { "name": "profissao", "label": "Profissão", "type": "text", "required": true, "placeholder": "Ex.: Motorista de aplicativo", "maxLength": 120, "colSpan": 1 },
        { "name": "nacionalidade", "label": "Nacionalidade", "type": "text", "required": true, "default": "Brasileira", "placeholder": "Brasileira", "maxLength": 80, "colSpan": 2 },
        { "name": "cep", "label": "CEP", "type": "text", "required": true, "mask": "cep", "inputmode": "numeric", "placeholder": "00000-000", "maxLength": 9, "colSpan": 1 },
        { "name": "uf", "label": "UF", "type": "select", "required": true, "options": ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"], "colSpan": 1 },
        { "name": "logradouro", "label": "Rua / avenida", "type": "text", "required": true, "placeholder": "Rua, avenida...", "maxLength": 200, "colSpan": 2 },
        { "name": "numero", "label": "Número", "type": "text", "required": true, "placeholder": "17", "maxLength": 20, "colSpan": 1 },
        { "name": "complemento", "label": "Complemento", "type": "text", "required": false, "placeholder": "Apto, bloco, sala (opcional)", "maxLength": 120, "colSpan": 1 },
        { "name": "bairro", "label": "Bairro", "type": "text", "required": true, "placeholder": "Bairro", "maxLength": 120, "colSpan": 1 },
        { "name": "cidade", "label": "Cidade", "type": "text", "required": true, "placeholder": "Salvador", "maxLength": 120, "colSpan": 1 }
      ]
    },
    {
      "id": "contrato",
      "title": "Contrato e pagamento",
      "description": "Escolha o serviço, informe o objeto e selecione a forma de pagamento.",
      "fields": [
        { "name": "banco_instituicao_financeira", "label": "Banco / instituição financeira", "type": "text", "required": true, "placeholder": "Ex.: Banco Itaú", "maxLength": 160, "colSpan": 2, "visibleWhen": { "objectType": "BANK" } },
        { "name": "ente_federativo_e_lei_aplicavel", "label": "Ente federativo e lei aplicável", "type": "text", "required": true, "placeholder": "Ex.: União Federal / Lei 14.181/2021", "maxLength": 200, "colSpan": 2, "visibleWhen": { "objectType": "PUBLIC_ENTITY" } },
        { "name": "descricao_adicional_do_objeto", "label": "Descrição adicional do objeto", "type": "textarea", "required": false, "placeholder": "Detalhes que devem aparecer no contrato (opcional)", "maxLength": 2000, "colSpan": 2 }
      ]
    },
    { "id": "assinatura", "title": "Assinatura do contrato", "description": "Enviamos o contrato para o seu WhatsApp. O avanço é liberado após a assinatura.", "fields": [] },
    { "id": "pagamento", "title": "Pagamento", "description": "Pague no checkout do Asaas. A confirmação é automática e você volta para o formulário.", "fields": [] },
    { "id": "documentos", "title": "Documentos", "description": "Anexe os documentos obrigatórios para concluir o processo.", "fields": [] }
  ]
}
$flow$::jsonb,
  'AFTER_BOTH',
  'Contrato de Prestação de Serviços Advocatícios',
  null
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Serviços da v2 (12). Inativos até a conferência comercial.
-- ---------------------------------------------------------------------------
insert into public.product_services (
  id, product_version_id, code, name, total_cents, active, sort_order,
  group_number, object_type, success_mode, kit_code
)
values
  ('99999999-9999-4999-8999-999999999901', '22222222-2222-4222-8222-222222222223', 'revisional-contrato-veiculo', 'Revisional de Contrato de Veículo', 100000, false, 10, 1, 'BANK', 'REDUCAO', 'ZAPSIGN_CONTRATO_01'),
  ('99999999-9999-4999-8999-999999999902', '22222222-2222-4222-8222-222222222223', 'defesa-busca-apreensao', 'Defesa de Busca e Apreensão', 100000, false, 20, 1, 'BANK', 'CLAUSULA_BRANCA', 'ZAPSIGN_CONTRATO_02'),
  ('99999999-9999-4999-8999-999999999903', '22222222-2222-4222-8222-222222222223', 'defesa-execucao-monitoria', 'Defesa em Execução ou Monitória', 100000, false, 30, 1, 'BANK', 'CLAUSULA_BRANCA', 'ZAPSIGN_CONTRATO_03'),
  ('99999999-9999-4999-8999-999999999904', '22222222-2222-4222-8222-222222222223', 'revisional-produtos-conta-corrente', 'Revisional de Produtos de Conta Corrente', 100000, false, 40, 1, 'BANK', 'REDUCAO', 'ZAPSIGN_CONTRATO_04'),
  ('99999999-9999-4999-8999-999999999905', '22222222-2222-4222-8222-222222222223', 'limitacao-consignados', 'Limitação dos Consignados', 100000, false, 50, 2, 'PUBLIC_ENTITY', 'REDUCAO', 'ZAPSIGN_CONTRATO_05'),
  ('99999999-9999-4999-8999-999999999906', '22222222-2222-4222-8222-222222222223', 'superendividamento', 'Superendividamento', 100000, false, 60, 2, 'NONE', 'REDUCAO', 'ZAPSIGN_CONTRATO_06'),
  ('99999999-9999-4999-8999-999999999907', '22222222-2222-4222-8222-222222222223', 'desbloqueio-conta-bancaria', 'Desbloqueio de Conta Bancária', 100000, false, 70, 3, 'BANK', 'CLAUSULA_BRANCA', 'ZAPSIGN_CONTRATO_07'),
  ('99999999-9999-4999-8999-999999999908', '22222222-2222-4222-8222-222222222223', 'acao-indenizatoria-geral', 'Ação Indenizatória Geral', 100000, false, 80, 3, 'BANK', 'CLAUSULA_BRANCA', 'ZAPSIGN_CONTRATO_08'),
  ('99999999-9999-4999-8999-999999999909', '22222222-2222-4222-8222-222222222223', 'solicitacoes-administrativas-bacen-procon', 'Solicitações Administrativas no BACEN e PROCON', 100000, false, 90, 4, 'BANK', 'CLAUSULA_ADMINISTRATIVA', 'ZAPSIGN_CONTRATO_09'),
  ('99999999-9999-4999-8999-999999999910', '22222222-2222-4222-8222-222222222223', 'laudo-tecnico-solicitacao-contrato', 'Laudo Técnico do Contrato + Solicitação de Contrato', 100000, false, 100, 4, 'BANK', 'CLAUSULA_ADMINISTRATIVA', 'ZAPSIGN_CONTRATO_10'),
  ('99999999-9999-4999-8999-999999999911', '22222222-2222-4222-8222-222222222223', 'cancelamento-debito-automatico-solicitacao-contratos', 'Cancelamento de Débito Automático + Solicitação dos Contratos', 100000, false, 110, 4, 'BANK', 'CLAUSULA_ADMINISTRATIVA', 'ZAPSIGN_CONTRATO_11'),
  ('99999999-9999-4999-8999-999999999912', '22222222-2222-4222-8222-222222222223', 'cancelamento-associacoes', 'Cancelamento de Associações', 100000, false, 120, 4, 'BANK', 'CLAUSULA_ADMINISTRATIVA', 'ZAPSIGN_CONTRATO_12')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Um plano provisório por serviço (inativo até a definição dos valores).
-- ---------------------------------------------------------------------------
insert into public.payment_plans (
  id, product_version_id, service_id, label, description, method, mode,
  total_cents, signal_cents, entry_cents, installment_count, due_date_rule, active
)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999901', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc02', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999902', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc03', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999903', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc04', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999904', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc05', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999905', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc06', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999906', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc07', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999907', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc08', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999908', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc09', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999909', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc10', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999910', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc11', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999911', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc12', '22222222-2222-4222-8222-222222222223', '99999999-9999-4999-8999-999999999912', 'À vista no Pix (configurar)', 'Plano provisório; valores serão definidos na confecção.', 'PIX', 'AVISTA', 100000, 10000, 0, 1, '{"type": "FIXED_DAY", "day": 10}'::jsonb, false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Templates placeholder: 1 contrato + 1 procuração por serviço.
-- As variáveis do objeto mudam com o serviço; a cláusula de êxito também.
-- ---------------------------------------------------------------------------
with base as (
  select
    '["nome_completo","nacionalidade","estado_civil","profissao","cpf","email","whatsapp","rua_avenida","numero","complemento","bairro","cidade_uf","cep"]'::jsonb as base_contrato,
    '["nome_completo","nacionalidade","estado_civil","profissao","cpf","email","rua_avenida","numero","complemento","bairro","cidade_uf","cep"]'::jsonb as base_procuracao,
    '["descricao_adicional_do_objeto","clausula_pagamento","forma_pagamento","clausula_desconto","exito_reducao_percentual","exito_reducao_meses","exito_reducao_condicoes","data_extenso"]'::jsonb as tail_reducao,
    '["descricao_adicional_do_objeto","clausula_pagamento","forma_pagamento","clausula_desconto","clausula_exito","data_extenso"]'::jsonb as tail_branca
)
insert into public.contract_templates (
  id, external_template_id, name, template_type, version, required_variables,
  approval_status, approved_at
)
select
  t.id,
  t.external_template_id,
  t.name,
  t.template_type,
  1,
  (case when t.template_type = 'CONTRATO' then base.base_contrato else base.base_procuracao end)
    || t.object_variables
    || (case
          when t.template_type = 'PROCURACAO' then '["data_extenso"]'::jsonb
          when t.success_mode = 'REDUCAO' then base.tail_reducao
          else base.tail_branca
        end),
  'DRAFT',
  null
from base
cross join (values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'::uuid, 'PREENCHER_CONTRATO_01', 'Contrato - Revisional de Contrato de Veículo', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'REDUCAO'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'::uuid, 'PREENCHER_CONTRATO_02', 'Contrato - Defesa de Busca e Apreensão', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_BRANCA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'::uuid, 'PREENCHER_CONTRATO_03', 'Contrato - Defesa em Execução ou Monitória', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_BRANCA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04'::uuid, 'PREENCHER_CONTRATO_04', 'Contrato - Revisional de Produtos de Conta Corrente', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'REDUCAO'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05'::uuid, 'PREENCHER_CONTRATO_05', 'Contrato - Limitação dos Consignados', 'CONTRATO', '["ente_federativo_e_lei_aplicavel"]'::jsonb, 'REDUCAO'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06'::uuid, 'PREENCHER_CONTRATO_06', 'Contrato - Superendividamento', 'CONTRATO', '[]'::jsonb, 'REDUCAO'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07'::uuid, 'PREENCHER_CONTRATO_07', 'Contrato - Desbloqueio de Conta Bancária', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_BRANCA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08'::uuid, 'PREENCHER_CONTRATO_08', 'Contrato - Ação Indenizatória Geral', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_BRANCA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09'::uuid, 'PREENCHER_CONTRATO_09', 'Contrato - Solicitações Administrativas no BACEN e PROCON', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_ADMINISTRATIVA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10'::uuid, 'PREENCHER_CONTRATO_10', 'Contrato - Laudo Técnico do Contrato + Solicitação de Contrato', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_ADMINISTRATIVA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11'::uuid, 'PREENCHER_CONTRATO_11', 'Contrato - Cancelamento de Débito Automático + Solicitação dos Contratos', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_ADMINISTRATIVA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12'::uuid, 'PREENCHER_CONTRATO_12', 'Contrato - Cancelamento de Associações', 'CONTRATO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_ADMINISTRATIVA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13'::uuid, 'PREENCHER_PROCURACAO_01', 'Procuração - Revisional de Contrato de Veículo', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'REDUCAO'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14'::uuid, 'PREENCHER_PROCURACAO_02', 'Procuração - Defesa de Busca e Apreensão', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_BRANCA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15'::uuid, 'PREENCHER_PROCURACAO_03', 'Procuração - Defesa em Execução ou Monitória', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_BRANCA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16'::uuid, 'PREENCHER_PROCURACAO_04', 'Procuração - Revisional de Produtos de Conta Corrente', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'REDUCAO'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17'::uuid, 'PREENCHER_PROCURACAO_05', 'Procuração - Limitação dos Consignados', 'PROCURACAO', '["ente_federativo_e_lei_aplicavel"]'::jsonb, 'REDUCAO'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18'::uuid, 'PREENCHER_PROCURACAO_06', 'Procuração - Superendividamento', 'PROCURACAO', '[]'::jsonb, 'REDUCAO'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19'::uuid, 'PREENCHER_PROCURACAO_07', 'Procuração - Desbloqueio de Conta Bancária', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_BRANCA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20'::uuid, 'PREENCHER_PROCURACAO_08', 'Procuração - Ação Indenizatória Geral', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_BRANCA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21'::uuid, 'PREENCHER_PROCURACAO_09', 'Procuração - Solicitações Administrativas no BACEN e PROCON', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_ADMINISTRATIVA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22'::uuid, 'PREENCHER_PROCURACAO_10', 'Procuração - Laudo Técnico do Contrato + Solicitação de Contrato', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_ADMINISTRATIVA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa23'::uuid, 'PREENCHER_PROCURACAO_11', 'Procuração - Cancelamento de Débito Automático + Solicitação dos Contratos', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_ADMINISTRATIVA'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa24'::uuid, 'PREENCHER_PROCURACAO_12', 'Procuração - Cancelamento de Associações', 'PROCURACAO', '["banco_instituicao_financeira"]'::jsonb, 'CLAUSULA_ADMINISTRATIVA')
) as t(id, external_template_id, name, template_type, object_variables, success_mode)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Kit por serviço: contrato (sort 10) + procuração (sort 20).
-- ---------------------------------------------------------------------------
insert into public.kit_items (
  id, product_version_id, contract_template_id, service_id, sort_order, required, signer_role
)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '99999999-9999-4999-8999-999999999901', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb13', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13', '99999999-9999-4999-8999-999999999901', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', '99999999-9999-4999-8999-999999999902', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb14', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14', '99999999-9999-4999-8999-999999999902', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', '99999999-9999-4999-8999-999999999903', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb15', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15', '99999999-9999-4999-8999-999999999903', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', '99999999-9999-4999-8999-999999999904', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb16', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16', '99999999-9999-4999-8999-999999999904', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb05', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05', '99999999-9999-4999-8999-999999999905', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb17', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17', '99999999-9999-4999-8999-999999999905', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb06', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06', '99999999-9999-4999-8999-999999999906', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb18', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18', '99999999-9999-4999-8999-999999999906', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb07', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07', '99999999-9999-4999-8999-999999999907', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb19', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19', '99999999-9999-4999-8999-999999999907', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb08', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08', '99999999-9999-4999-8999-999999999908', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20', '99999999-9999-4999-8999-999999999908', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb09', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09', '99999999-9999-4999-8999-999999999909', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21', '99999999-9999-4999-8999-999999999909', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb10', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', '99999999-9999-4999-8999-999999999910', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb22', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22', '99999999-9999-4999-8999-999999999910', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11', '99999999-9999-4999-8999-999999999911', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb23', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa23', '99999999-9999-4999-8999-999999999911', 20, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12', '99999999-9999-4999-8999-999999999912', 10, true, 'CLIENTE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb24', '22222222-2222-4222-8222-222222222223', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa24', '99999999-9999-4999-8999-999999999912', 20, true, 'CLIENTE')
on conflict (id) do nothing;
