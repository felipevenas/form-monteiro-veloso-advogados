# ADR-002 — Sessão pública por token opaco

**Status:** aceito; evolução para cookie planejada.

## Contexto

O cliente não cria conta. O PRD exige continuidade entre abas, retomada segura e nada de `localStorage`. IDs sequenciais e dados pessoais não podem aparecer na URL.

## Decisão

- Token aleatório de 24 bytes (`mv_...`), salvo como SHA-256 em `sessions.token_hash`.
- Token no path e no header `X-Process-Token`; nunca em `localStorage`.
- Expiração de 30 dias, revogação e rotação.
- Retomada por magic link/OTP no e-mail da contratação.
- Respostas genéricas para não revelar existência de e-mail/CPF.

## Evolução

Para usar cookie `HttpOnly` de verdade, a API precisa ser same-site:

1. proxy `/api` na Vercel para as Edge Functions, ou
2. domínio customizado do Supabase no mesmo site (`api.form.monteiroveloso.com`).

Enquanto isso, o header é o bearer da sessão. A URL é um link secreto: `Referrer-Policy` restritiva e `rel="noreferrer"` nos links externos.

## Consequências

- Funciona sem cadastro e sem terceiros.
- O link não deve ser compartilhado; a UI avisa.
- Webhooks nunca usam esse token.
