# ADR-007 — Formulário schema-driven por produto

**Status:** aceito em 2026-10-28.

## Contexto

São 12 kits com campos, documentos e regras financeiras diferentes. Criar uma tela por produto não escala e mistura conteúdo com código.

## Decisão

- O produto/versão carrega um `form_schema` declarativo (`FormStep[]`).
- O frontend renderiza os campos a partir do schema; valida no cliente com Zod derivado.
- O servidor revalida com o mesmo tipo de regra; o cliente nunca é a autoridade.
- O processo guarda `product_version_id` e o snapshot do formulário/financeiro.
- Editar o catálogo não altera processos em andamento.

## Consequências

- Um novo produto é configuração, não código.
- O renderer precisa suportar poucos tipos (text, email, tel, CPF, data, select, textarea).
- Campos muito específicos exigem um novo tipo ou um `extra` validado no servidor.
