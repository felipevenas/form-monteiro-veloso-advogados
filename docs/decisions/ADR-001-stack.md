# ADR-001 — SPA Vite + Supabase Edge Functions

**Status:** aceito em 2026-10-28.

## Contexto

O projeto tem duas superfícies (formulário público e painel), muitas integrações e nenhuma necessidade de SEO. O time já usa React e Supabase.

## Decisão

- Frontend: Vite + React + TypeScript, hospedado na Vercel.
- Backend: Supabase Edge Functions, com 5 funções roteadas internamente.
- Banco: Supabase Postgres como fonte de verdade.

## Consequências

- Menos superfície e um único backend.
- Sem SSR; se o formulário precisar de SEO, a landing Astro continua sendo o lugar.
- Edge Functions têm limite de execução; tarefas longas vão para a outbox.
- O frontend não recebe segredo de integração.
