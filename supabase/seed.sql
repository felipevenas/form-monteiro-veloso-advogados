-- Seed do produto piloto: Defesa em Busca e Apreensão.
-- IDs fixos para permitir referência em testes e Edge Functions.

insert into public.products (id, slug, name, short_name, description, active)
values (
  '11111111-1111-4111-8111-111111111111',
  'defesa-busca-apreensao',
  'Defesa em Busca e Apreensão',
  'Busca e Apreensão',
  'Assessoria jurídica para defesa em ação de busca e apreensão de veículo financiado.',
  true
);

insert into public.product_versions (
  id, product_id, version, status, form_schema, unlock_condition, contract_label,
  approved_at
)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  1,
  'APPROVED',
  '{
    "version": 1,
    "steps": [
      {
        "id": "identificacao",
        "title": "Quem vai contratar",
        "description": "Precisamos dos dados básicos para localizar seu processo e emitir o contrato.",
        "fields": [
          { "name": "nome_completo", "label": "Nome completo", "type": "text", "required": true, "autocomplete": "name", "placeholder": "Como está no seu documento", "colSpan": 2 },
          { "name": "cpf", "label": "CPF", "type": "text", "required": true, "mask": "cpf", "inputmode": "numeric", "placeholder": "000.000.000-00", "colSpan": 1 },
          { "name": "telefone", "label": "WhatsApp", "type": "tel", "required": true, "mask": "phone", "autocomplete": "tel", "placeholder": "(71) 99999-9999", "colSpan": 1 },
          { "name": "email", "label": "E-mail", "type": "email", "required": true, "autocomplete": "email", "placeholder": "voce@email.com", "colSpan": 2 }
        ]
      },
      {
        "id": "dados-pessoais",
        "title": "Dados pessoais",
        "description": "Essas informações aparecem no contrato e nos documentos complementares.",
        "fields": [
          {
            "name": "estado_civil",
            "label": "Estado civil",
            "type": "select",
            "required": true,
            "options": ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"],
            "colSpan": 1
          },
          { "name": "profissao", "label": "Profissão", "type": "text", "required": true, "placeholder": "Ex.: Motorista de aplicativo", "colSpan": 1 },
          { "name": "nacionalidade", "label": "Nacionalidade", "type": "text", "required": true, "default": "Brasileira", "placeholder": "Brasileira", "colSpan": 2 }
        ]
      },
      {
        "id": "endereco",
        "title": "Endereço",
        "description": "Endereço completo para o contrato e para a declaração de residência.",
        "fields": [
          { "name": "cep", "label": "CEP", "type": "text", "required": true, "mask": "cep", "inputmode": "numeric", "placeholder": "00000-000", "colSpan": 1 },
          {
            "name": "uf",
            "label": "UF",
            "type": "select",
            "required": true,
            "options": ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"],
            "colSpan": 1
          },
          { "name": "logradouro", "label": "Logradouro", "type": "text", "required": true, "placeholder": "Rua, avenida...", "colSpan": 2 },
          { "name": "numero", "label": "Número", "type": "text", "required": true, "placeholder": "17", "colSpan": 1 },
          { "name": "complemento", "label": "Complemento", "type": "text", "required": false, "placeholder": "Apto, bloco, sala (opcional)", "colSpan": 1 },
          { "name": "bairro", "label": "Bairro", "type": "text", "required": true, "placeholder": "Bairro", "colSpan": 1 },
          { "name": "cidade", "label": "Cidade", "type": "text", "required": true, "placeholder": "Salvador", "colSpan": 1 }
        ]
      },
      {
        "id": "contrato",
        "title": "Dados do contrato",
        "description": "Informações do financiamento e do veículo que serão usadas na defesa.",
        "fields": [
          { "name": "placa_veiculo", "label": "Placa do veículo", "type": "text", "required": true, "mask": "placa", "placeholder": "ABC1D23", "colSpan": 1 },
          { "name": "modelo_veiculo", "label": "Modelo do veículo", "type": "text", "required": true, "placeholder": "Ex.: Fiat Argo 1.0", "colSpan": 1 },
          { "name": "instituicao_financeira", "label": "Banco ou financeira", "type": "text", "required": true, "placeholder": "Ex.: Banco Itaú", "colSpan": 2 },
          { "name": "numero_contrato", "label": "Número do contrato de financiamento", "type": "text", "required": false, "placeholder": "Se tiver em mãos (opcional)", "colSpan": 2 }
        ]
      },
      {
        "id": "financeiro",
        "title": "Forma de pagamento",
        "description": "Escolha o plano. O contrato só é gerado se os valores fecharem.",
        "fields": [
          { "name": "plano_pagamento", "label": "Plano de pagamento", "type": "payment_plan", "required": true }
        ]
      },
      {
        "id": "revisao",
        "title": "Revise e confirme",
        "description": "Confira os dados antes de gerar o contrato e seguir para a assinatura.",
        "fields": [
          {
            "name": "consentimento_dados",
            "label": "Autorizo o tratamento dos meus dados para a prestação do serviço.",
            "type": "consent",
            "required": true,
            "consent_type": "tratamento_dados",
            "consent_version": "2026-01"
          }
        ]
      }
    ]
  }'::jsonb,
  'AFTER_BOTH',
  'Contrato de Prestação de Serviços Advocatícios',
  '2026-10-28T00:00:00Z'
);

insert into public.contract_templates (
  id, external_template_id, name, template_type, version, required_variables, approval_status, approved_at
)
values
  (
    '33333333-3333-4333-8333-333333333331',
    'PREENCHER_CONTRATO',
    'Contrato de Prestação de Serviços Advocatícios',
    'CONTRATO',
    1,
    '["nome_completo", "cpf", "estado_civil", "profissao", "nacionalidade", "endereco_completo", "placa_veiculo", "modelo_veiculo", "instituicao_financeira", "numero_contrato", "valor_total", "forma_pagamento"]'::jsonb,
    'DRAFT',
    null
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    'PREENCHER_PROCURACAO',
    'Procuração Ad Judicia et Extra',
    'PROCURACAO',
    1,
    '["nome_completo", "cpf", "nacionalidade", "estado_civil", "profissao", "endereco_completo", "placa_veiculo", "instituicao_financeira"]'::jsonb,
    'DRAFT',
    null
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'PREENCHER_DECLARACAO_HIPOSSUFICIENCIA',
    'Declaração de Hipossuficiência',
    'DECLARACAO_HIPOSSUFICIENCIA',
    1,
    '["nome_completo", "cpf", "endereco_completo"]'::jsonb,
    'DRAFT',
    null
  ),
  (
    '33333333-3333-4333-8333-333333333334',
    'PREENCHER_DECLARACAO_RESIDENCIA',
    'Declaração de Residência',
    'DECLARACAO_RESIDENCIA',
    1,
    '["nome_completo", "cpf", "endereco_completo"]'::jsonb,
    'DRAFT',
    null
  );

insert into public.kit_items (id, product_version_id, contract_template_id, sort_order, required, signer_role)
values
  ('44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333331', 10, true, 'CLIENTE'),
  ('44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333332', 20, true, 'CLIENTE'),
  ('44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 30, true, 'CLIENTE'),
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333334', 40, true, 'CLIENTE');

insert into public.document_requirements (
  id, product_version_id, code, label, description, required, accepted_mime_types, max_size_bytes, sort_order
)
values
  (
    '55555555-5555-4555-8555-555555555551',
    '22222222-2222-4222-8222-222222222222',
    'RG_CNH',
    'RG ou CNH',
    'Documento de identidade com foto, legível e sem cortes.',
    true,
    array['application/pdf', 'image/jpeg', 'image/png'],
    10485760,
    10
  ),
  (
    '55555555-5555-4555-8555-555555555552',
    '22222222-2222-4222-8222-222222222222',
    'COMPROVANTE_RESIDENCIA',
    'Comprovante de residência',
    'Conta de água, luz ou telefone dos últimos 90 dias no nome do cliente.',
    true,
    array['application/pdf', 'image/jpeg', 'image/png'],
    10485760,
    20
  ),
  (
    '55555555-5555-4555-8555-555555555553',
    '22222222-2222-4222-8222-222222222222',
    'CONTRATO_FINANCIAMENTO',
    'Contrato de financiamento',
    'Contrato do financiamento do veículo ou extrato de parcelas.',
    true,
    array['application/pdf', 'image/jpeg', 'image/png'],
    10485760,
    30
  ),
  (
    '55555555-5555-4555-8555-555555555554',
    '22222222-2222-4222-8222-222222222222',
    'DOCUMENTO_VEICULO',
    'Documento do veículo (CRLV)',
    'Opcional. Ajuda na análise, mas não bloqueia o processo.',
    false,
    array['application/pdf', 'image/jpeg', 'image/png'],
    10485760,
    40
  );

-- Catálogo fictício de serviços para a simulação. Substituir pelos serviços e
-- valores reais da cliente.
insert into public.product_services (
  id, product_version_id, code, name, description, total_cents, active, sort_order
)
values
  (
    '77777777-7777-4777-8777-777777777771',
    '22222222-2222-4222-8222-222222222222',
    'busca-apreensao',
    'Defesa em busca e apreensão',
    'Defesa de veículo apreendido ou em risco de apreensão, com análise do contrato e do processo.',
    350000,
    true,
    10
  ),
  (
    '77777777-7777-4777-8777-777777777772',
    '22222222-2222-4222-8222-222222222222',
    'revisional-financiamento',
    'Revisional de financiamento',
    'Auditoria de juros, tarifas e seguros embutidos no contrato de financiamento.',
    420000,
    true,
    20
  ),
  (
    '77777777-7777-4777-8777-777777777773',
    '22222222-2222-4222-8222-222222222222',
    'cobranca-negociacao',
    'Cobrança e negociação',
    'Defesa contra cobrança abusiva e negociação da dívida com o banco.',
    240000,
    true,
    30
  ),
  (
    '77777777-7777-4777-8777-777777777774',
    '22222222-2222-4222-8222-222222222222',
    'analise-contratual',
    'Análise contratual',
    'Leitura técnica do contrato e parecer sobre cláusulas, encargos e riscos.',
    90000,
    true,
    40
  );

insert into public.payment_plans (
  id, product_version_id, service_id, label, description, method, mode,
  total_cents, signal_cents, entry_cents, installment_count, due_date_rule, active
)
values
  (
    '66666666-6666-4666-8666-666666666661',
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777771',
    'À vista no PIX',
    'Sinal de R$ 500,00 na contratação e o saldo em parcela única no dia 10.',
    'PIX',
    'AVISTA',
    350000,
    50000,
    0,
    1,
    '{"type": "FIXED_DAY", "day": 10}'::jsonb,
    true
  ),
  (
    '66666666-6666-4666-8666-666666666662',
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777771',
    '6x no PIX',
    'Sinal de R$ 500,00 na contratação + 6 parcelas de R$ 500,00 (total R$ 3.500,00).',
    'PIX',
    'PARCELADO',
    350000,
    50000,
    0,
    6,
    '{"type": "FIXED_DAY", "day": 10}'::jsonb,
    true
  ),
  (
    '88888888-8888-4888-8888-888888888801',
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777772',
    'À vista no PIX',
    'Sinal de R$ 600,00 na contratação e o saldo em parcela única no dia 10.',
    'PIX',
    'AVISTA',
    420000,
    60000,
    0,
    1,
    '{"type": "FIXED_DAY", "day": 10}'::jsonb,
    true
  ),
  (
    '88888888-8888-4888-8888-888888888802',
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777772',
    '6x no PIX',
    'Sinal de R$ 600,00 na contratação + 6 parcelas de R$ 600,00 (total R$ 4.200,00).',
    'PIX',
    'PARCELADO',
    420000,
    60000,
    0,
    6,
    '{"type": "FIXED_DAY", "day": 10}'::jsonb,
    true
  ),
  (
    '88888888-8888-4888-8888-888888888803',
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777773',
    'À vista no PIX',
    'Sinal de R$ 300,00 na contratação e o saldo em parcela única no dia 10.',
    'PIX',
    'AVISTA',
    240000,
    30000,
    0,
    1,
    '{"type": "FIXED_DAY", "day": 10}'::jsonb,
    true
  ),
  (
    '88888888-8888-4888-8888-888888888804',
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777773',
    '6x no PIX',
    'Sinal de R$ 300,00 na contratação + 6 parcelas de R$ 350,00 (total R$ 2.400,00).',
    'PIX',
    'PARCELADO',
    240000,
    30000,
    0,
    6,
    '{"type": "FIXED_DAY", "day": 10}'::jsonb,
    true
  ),
  (
    '88888888-8888-4888-8888-888888888805',
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777774',
    'À vista no PIX',
    'Sinal de R$ 150,00 na contratação e o saldo em parcela única no dia 10.',
    'PIX',
    'AVISTA',
    90000,
    15000,
    0,
    1,
    '{"type": "FIXED_DAY", "day": 10}'::jsonb,
    true
  ),
  (
    '88888888-8888-4888-8888-888888888806',
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777774',
    '6x no PIX',
    'Sinal de R$ 150,00 na contratação + 6 parcelas de R$ 125,00 (total R$ 900,00).',
    'PIX',
    'PARCELADO',
    90000,
    15000,
    0,
    6,
    '{"type": "FIXED_DAY", "day": 10}'::jsonb,
    true
  );

-- Feriados nacionais oficiais (Lei 14.759/2023 inclui 20/11). Carnaval e
-- Corpus Christi não são feriados nacionais por lei; Corpus Christi entra aqui
-- por ser feriado nacional de facto usado pelo escritório no cálculo de prazos.
insert into public.holidays (date, name, scope)
values
  ('2026-01-01', 'Confraternização Universal', 'NATIONAL'),
  ('2026-04-03', 'Sexta-feira Santa', 'NATIONAL'),
  ('2026-04-21', 'Tiradentes', 'NATIONAL'),
  ('2026-05-01', 'Dia do Trabalho', 'NATIONAL'),
  ('2026-06-04', 'Corpus Christi', 'NATIONAL'),
  ('2026-09-07', 'Independência do Brasil', 'NATIONAL'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'NATIONAL'),
  ('2026-11-02', 'Finados', 'NATIONAL'),
  ('2026-11-15', 'Proclamação da República', 'NATIONAL'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'NATIONAL'),
  ('2026-12-25', 'Natal', 'NATIONAL'),
  ('2027-01-01', 'Confraternização Universal', 'NATIONAL'),
  ('2027-03-26', 'Sexta-feira Santa', 'NATIONAL'),
  ('2027-04-21', 'Tiradentes', 'NATIONAL'),
  ('2027-05-01', 'Dia do Trabalho', 'NATIONAL'),
  ('2027-05-27', 'Corpus Christi', 'NATIONAL'),
  ('2027-09-07', 'Independência do Brasil', 'NATIONAL'),
  ('2027-10-12', 'Nossa Senhora Aparecida', 'NATIONAL'),
  ('2027-11-02', 'Finados', 'NATIONAL'),
  ('2027-11-15', 'Proclamação da República', 'NATIONAL'),
  ('2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'NATIONAL'),
  ('2027-12-25', 'Natal', 'NATIONAL')
on conflict (date) do nothing;

-- Mantém o seed alinhado ao fluxo compacto (mesmo conteúdo da migration).
-- Fluxo compacto de 5 etapas:
-- dados → contrato/pagamento → assinatura → pagamento → documentos.
-- Assinatura e pagamento são checkpoints (sem campos) controlados por webhook.

update public.product_versions
set form_schema = $flow$
{
  "version": 1,
  "steps": [
    {
      "id": "dados",
      "title": "Seus dados",
      "description": "Dados pessoais, contato e endereço usados no contrato e nos documentos.",
      "fields": [
        { "name": "nome_completo", "label": "Nome completo", "type": "text", "required": true, "autocomplete": "name", "placeholder": "Como está no seu documento", "colSpan": 2 },
        { "name": "cpf", "label": "CPF", "type": "text", "required": true, "mask": "cpf", "inputmode": "numeric", "placeholder": "000.000.000-00", "colSpan": 1 },
        { "name": "telefone", "label": "WhatsApp", "type": "tel", "required": true, "mask": "phone", "autocomplete": "tel", "placeholder": "(71) 99999-9999", "hint": "O contrato será enviado para este número.", "colSpan": 1 },
        { "name": "email", "label": "E-mail", "type": "email", "required": true, "autocomplete": "email", "placeholder": "voce@email.com", "colSpan": 2 },
        {
          "name": "estado_civil",
          "label": "Estado civil",
          "type": "select",
          "required": true,
          "options": ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"],
          "colSpan": 1
        },
        { "name": "profissao", "label": "Profissão", "type": "text", "required": true, "placeholder": "Ex.: Motorista de aplicativo", "colSpan": 1 },
        { "name": "nacionalidade", "label": "Nacionalidade", "type": "text", "required": true, "default": "Brasileira", "placeholder": "Brasileira", "colSpan": 2 },
        { "name": "cep", "label": "CEP", "type": "text", "required": true, "mask": "cep", "inputmode": "numeric", "placeholder": "00000-000", "colSpan": 1 },
        {
          "name": "uf",
          "label": "UF",
          "type": "select",
          "required": true,
          "options": ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"],
          "colSpan": 1
        },
        { "name": "logradouro", "label": "Logradouro", "type": "text", "required": true, "placeholder": "Rua, avenida...", "colSpan": 2 },
        { "name": "numero", "label": "Número", "type": "text", "required": true, "placeholder": "17", "colSpan": 1 },
        { "name": "complemento", "label": "Complemento", "type": "text", "required": false, "placeholder": "Apto, bloco, sala (opcional)", "colSpan": 1 },
        { "name": "bairro", "label": "Bairro", "type": "text", "required": true, "placeholder": "Bairro", "colSpan": 1 },
        { "name": "cidade", "label": "Cidade", "type": "text", "required": true, "placeholder": "Salvador", "colSpan": 1 }
      ]
    },
    {
      "id": "contrato",
      "title": "Contrato e pagamento",
      "description": "Dados do financiamento e escolha do plano. O contrato sai com essas informações.",
      "fields": [
        { "name": "placa_veiculo", "label": "Placa do veículo", "type": "text", "required": true, "mask": "placa", "placeholder": "ABC1D23", "colSpan": 1 },
        { "name": "modelo_veiculo", "label": "Modelo do veículo", "type": "text", "required": true, "placeholder": "Ex.: Fiat Argo 1.0", "colSpan": 1 },
        { "name": "instituicao_financeira", "label": "Banco ou financeira", "type": "text", "required": true, "placeholder": "Ex.: Banco Itaú", "colSpan": 2 },
        { "name": "numero_contrato", "label": "Número do contrato de financiamento", "type": "text", "required": false, "placeholder": "Se tiver em mãos (opcional)", "colSpan": 2 }
      ]
    },
    {
      "id": "assinatura",
      "title": "Assinatura do contrato",
      "description": "Enviamos o contrato para o seu WhatsApp. O avanço é liberado após a assinatura.",
      "fields": []
    },
    {
      "id": "pagamento",
      "title": "Pagamento",
      "description": "Pague no checkout do Asaas. A confirmação é automática e você volta para o formulário.",
      "fields": []
    },
    {
      "id": "documentos",
      "title": "Documentos",
      "description": "Anexe os documentos obrigatórios para concluir o processo.",
      "fields": []
    }
  ]
}
$flow$::jsonb
where id = '22222222-2222-4222-8222-222222222222';

