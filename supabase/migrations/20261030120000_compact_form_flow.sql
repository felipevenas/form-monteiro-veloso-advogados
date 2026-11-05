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
