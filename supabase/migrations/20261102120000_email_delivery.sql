-- Envio de e-mails transacionais (Resend).
--
-- `message_logs` já guarda destinatário, status e o ID externo. Falta apenas a
-- chave de idempotência: o cliente pode repetir o submit, o webhook pode ser
-- reprocessado e o mesmo e-mail não pode sair duas vezes.
alter table public.message_logs
  add column if not exists idempotency_key text;

create unique index if not exists idx_message_logs_idempotency_key
  on public.message_logs(idempotency_key)
  where idempotency_key is not null;

comment on column public.message_logs.idempotency_key is
  'Chave da operação de origem (ex.: dados-recebidos:<processId>). Evita reenvio em retry/replay.';

-- Garante que o PostgREST enxergue a coluna nova imediatamente.
notify pgrst, 'reload schema';
