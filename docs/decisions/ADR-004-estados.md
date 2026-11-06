# ADR-004 — Trilhos independentes e próximo passo derivado

**Status:** aceito em 2026-10-28.

## Contexto

O PRD tem estados de assinatura, pagamento e documentação independentes. Um único enum não representa um pagamento parcial com assinatura completa, por exemplo.

## Decisão

- `general_status` é a etapa percebida pelo cliente e serve para filtros.
- `signature_status`, `payment_status` e `documents_status` são independentes.
- `deriveNextAction(process)` calcula o próximo passo na UI; é uma função pura e testada.
- `general_status` é derivado das regras, não escrito à mão em cada tela.

## Consequências

- A UI consegue mostrar “assinatura concluída, pagamento parcial, documentos bloqueados” sem inventar estados.
- Os filtros operacionais usam etapa e trilho.
- Regras de transição precisam de testes; nenhuma tela pode “marcar como concluído”.
