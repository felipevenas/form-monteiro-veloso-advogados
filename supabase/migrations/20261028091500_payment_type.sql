-- Tipo da cobrança: sinal, entrada ou parcela. O número sequencial (`installment_number`)
-- continua sendo a ordem de exibição; o rótulo vem do tipo.
alter table public.payments
  add column if not exists payment_type text not null default 'INSTALLMENT';

alter table public.payments
  drop constraint if exists payments_type_check;

alter table public.payments
  add constraint payments_type_check
  check (payment_type in ('SIGNAL', 'ENTRY', 'INSTALLMENT'));
