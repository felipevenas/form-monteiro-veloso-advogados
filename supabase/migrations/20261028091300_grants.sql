-- Privilégios explícitos: o padrão do Supabase concede ALL em novas tabelas a
-- anon/authenticated. Aqui o acesso é reduzido ao mínimo.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

revoke insert, update, delete, truncate on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;

-- Tabelas internas (sessão, OTP, outbox, webhooks, rate limit, config): nenhum
-- acesso direto para authenticated.
revoke all on public.sessions from authenticated;
revoke all on public.otp_codes from authenticated;
revoke all on public.integration_events from authenticated;
revoke all on public.outbox_jobs from authenticated;
revoke all on public.message_logs from authenticated;
revoke all on public.consent_records from authenticated;
revoke all on public.rate_limits from authenticated;
revoke all on public.integration_configurations from authenticated;

-- clients: CPF/endereço ficam fora do grant de coluna. Quem precisa do registro
-- completo lê public.clients_safe (mascarada por papel).
revoke select on public.clients from authenticated;
grant select (id, full_name, email, phone_e164, created_at, updated_at)
  on public.clients to authenticated;

grant select on public.clients_safe to authenticated;

grant select on
  public.profiles,
  public.products,
  public.product_versions,
  public.contract_templates,
  public.kit_items,
  public.document_requirements,
  public.payment_plans,
  public.holidays,
  public.contract_processes,
  public.signatures,
  public.payments,
  public.documents,
  public.process_events,
  public.human_tasks,
  public.audit_logs,
  public.alerts
to authenticated;

-- service_role é o único caminho de escrita (Edge Functions).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Novas tabelas/funções criadas por migrations não ganham acesso anon por padrão.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
