# Roadmap

## Fase 0 — Descoberta e P0

**Status:** parcial. O produto piloto foi modelado no seed; as decisões de negócio continuam pendentes.

- [x] Produto piloto (`defesa-busca-apreensao`) com formulário, 4 documentos e 2 planos de pagamento.
- [x] Estrutura de estados, outbox e RLS.
- [ ] Confirmar ordem comercial (pagamento antes/depois da assinatura) por produto.
- [ ] Confirmar `unlock_condition` por produto.
- [ ] Confirmar IDs de templates ZapSign e plano/créditos.
- [ ] Confirmar Drive Compartilhado e service account.
- [ ] Confirmar API do Infinitum (quadros/fases/credenciais).
- [ ] Confirmar API da Vertisell ou aprovar fallback (e-mail + Meta Cloud API).
- [ ] Aprovar os 12 kits com o jurídico.

## Fase 1 — Fundação + formulário

**Status:** concluída no escopo do formulário público, publicado em `https://form.monteiroveloso.com`. Os itens não marcados abaixo são evoluções posteriores da fase.

- [x] Vite + React + TypeScript + Tailwind com tokens da landing.
- [x] Estrutura feature-based (`components/pages/hooks/services/types/utils`).
- [x] Schema do Supabase, RLS, RPCs, seed e tipos gerados.
- [x] Wizard schema-driven com Zod, máscaras e autosave por etapa.
- [x] Wizard compacto de 5 etapas: dados → contrato/pagamento → assinatura → pagamento → documentos.
- [x] Autosave em rascunho (debounce, flush ao trocar de etapa, status acessível).
- [x] CEP automático via ViaCEP com fallback manual.
- [x] Assinatura como checkpoint: ZapSign cria o contrato e envia por e-mail/WhatsApp; “Prosseguir” bloqueado até o webhook.
- [x] Pagamento como checkpoint: checkout hospedado do Asaas, retorno ao formulário e confirmação por webhook.
- [x] Webhooks ZapSign/Asaas processados de forma síncrona e idempotente.
- [x] Tela de conclusão pós-documentos com resumo e próximos passos.
- [x] Tema claro/escuro com persistência e logo real da LP (apenas ícone).
- [x] Fluxograma de etapas no desktop e stepper minimalista no mobile, sem scroll horizontal.
- [x] Resumo de erros acessível, foco no título da etapa e `aria-live`.
- [x] Snapshot financeiro com validação da soma e agenda de vencimentos.
- [x] Página de status com trilhos independentes e próximo passo.
- [x] Upload de documentos (mock) e timeline.
- [x] Sem área administrativa no frontend: operação interna via Supabase.
- [x] Testes de domínio (CPF, telefone, dinheiro, vencimentos, workflow).
- [x] E-mails transacionais (Resend): confirmação de cadastro, conclusão e link de acesso.
- [x] Headers de segurança, CSP e rewrite de SPA.

**Pendente para fechar a fase de verdade:**

- [x] Edge Functions `api-public` implementadas contra o banco (start, etapas, rascunho, plano, submit, upload).
- [x] `api-admin` com JWT, lista, detalhe, retry e pausa.
- [x] Webhooks Asaas/ZapSign com persistência idempotente.
- [x] Turnstile no frontend (quando configurado) + validação no servidor.
- [x] Rate limit aplicado nas rotas públicas.
- [x] Smoke de integração manual com Supabase local (cliente, 6 parcelas, 4 assinaturas, 2 jobs).
- [x] Testes E2E do formulário público (8 cenários, incluindo acessibilidade e mobile).
- [ ] Sessão com cookie `HttpOnly` same-site (hoje o token vai no header).
- [ ] Testes de integração automatizados das Edge Functions.
- [ ] Campos específicos dos 4 modelos contratuais (aguardando templates/variáveis da cliente).
- [ ] Substituir `PREENCHER_CONTRATO` pelo token real do template e validar o envio automático de WhatsApp no ZapSign.
- [ ] Configurar `ASAAS_API_KEY` e cadastrar o webhook de checkout no Asaas.
- [ ] Worker `jobs` (Fase 4).

## Fase 2 — ZapSign + Drive (em andamento)

- [x] Adaptador ZapSign: criar documento por template com signatário e envio automático por e-mail/WhatsApp.
- [x] Webhook com validação de segredo e dedupe por hash, atualizando a etapa de assinatura.
- [ ] Substituir o template placeholder pelo ID real da cliente.
- [ ] Download do PDF assinado antes dos 60 min e upload ao Drive.
- [ ] Estrutura de pastas por cliente e `appProperties`.
- [ ] Upload real: URL assinada → validação → job → Drive.
- [ ] Reconciliação antes de recriar documento.
- [ ] Testes de replay e de indisponibilidade.

## Fase 3 — Asaas (em andamento)

- [x] Checkout hospedado (`POST /v3/checkouts`) com `callback.successUrl` de volta ao formulário.
- [x] Webhook de checkout (`CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`) atualizando pagamento e etapa.
- [ ] Configurar `ASAAS_API_KEY` e cadastrar o webhook na conta da cliente.
- [ ] Planos à vista e parcelados; dia fixo via parcelamento nativo; demais via cobranças.
- [ ] Reconciliação de cobranças e parcelas.
- [ ] Liberação de documentos conforme `unlock_condition`.
- [ ] Testes de webhook duplicado, pagamento parcial e estorno.

## Fase 4 — Operações

- [ ] Worker completo de outbox (claim, backoff, dead-letter, reaper de `RUNNING`).
- [ ] Infinitum em modo API ou manual.
- [ ] Mensageria (Vertisell ou Meta Cloud API) + templates.
- [ ] Régua de follow-up com pausas e janela 8h–20h.
- [ ] Tarefas humanas e alertas deduplicados.
- [ ] Ações administrativas auditadas (retry, pausa, reenvio).

## Fase 5 — Hardening e go-live

- [x] Testes E2E (Playwright) do fluxo público (formulário, autosave, CEP, tema, acessibilidade e mobile).
- [ ] Testes de carga e rate limit.
- [ ] Revisão de segurança (IDOR, upload, CSP, RLS).
- [ ] Revisão jurídica dos modelos e do aviso de privacidade.
- [ ] Runbooks por integração.
- [ ] Deploy staging + produção, domínio e monitoramento.

## Definition of Done por integração

1. Funciona no sandbox do provedor.
2. Replay/duplicidade não gera efeito duplicado.
3. Timeout/indisponibilidade gera retry e alerta.
4. Erros mapeados para mensagens de UI.
5. Segredo fora do bundle.
6. Runbook em `docs/integrations/<provider>.md`.
