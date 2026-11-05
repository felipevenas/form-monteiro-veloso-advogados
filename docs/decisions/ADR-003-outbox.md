# ADR-003 — Outbox + pg_cron/pg_net

**Status:** aceito em 2026-10-28.

## Contexto

Assinatura, pagamento, Drive, card e mensagens são operações externas que falham, demoram e podem ser repetidas. O PRD proíbe depender de aba aberta e de n8n como orquestrador.

## Decisão

- Toda operação externa vira um job em `outbox_jobs` com `idempotency_key` única.
- `pg_cron` chama a função `jobs` a cada minuto via `pg_net`.
- O worker reivindica com `claim_outbox_jobs`, usando `FOR UPDATE SKIP LOCKED`.
- Backoff progressivo, `max_attempts` e `DEAD_LETTER`.
- Antes de repetir, reconciliar pelo ID externo do provedor.

## Consequências

- Nenhum navegador é necessário para o fluxo andar.
- O estado oficial é o banco; a outbox é a fila.
- Precisa de um reaper para jobs presos em `RUNNING`.
- O worker deve processar em lotes para respeitar o limite da Edge Function.
