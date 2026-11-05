# ADR-006 — Adaptadores por provedor e fallback explícito

**Status:** aceito em 2026-10-28.

## Contexto

Infinitum e Vertisell não têm documentação pública confirmada. O fluxo principal (contrato, assinatura, pagamento, documentos) não pode depender deles.

## Decisão

- Cada provedor tem uma porta e um adaptador em `infrastructure/<provider>`.
- `composition.ts` escolhe o modo por feature flag:
  - `INFINITUM_MODE=api|webhook|manual`
  - `VERTISEL_MODE=api|email|manual`
- Falha de um provedor não bloqueia os outros trilhos.
- Quando o modo é `manual`, a operação vira `human_task` + alerta.

## Consequências

- O sistema entrega valor mesmo sem as duas APIs.
- Nenhum detalhe de provedor vaza para `application`/`ui`.
- A cliente pode trocar de fornecedor sem reescrever o fluxo.
