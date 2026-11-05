-- Sessão pública do cliente. O token em claro só existe no cookie HttpOnly do
-- navegador; aqui fica apenas o SHA-256 (hex).
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.contract_processes(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint sessions_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint sessions_token_hash_key unique (token_hash)
);

create index idx_sessions_process on public.sessions(process_id);
create index idx_sessions_expires_at on public.sessions(expires_at);
create index idx_sessions_active
  on public.sessions(process_id, expires_at)
  where revoked_at is null;

alter table public.sessions enable row level security;
-- Sem policies: acesso exclusivo por Edge Functions com service role.

-- Códigos OTP de confirmação (e-mail/WhatsApp). Guarda apenas o hash.
create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.contract_processes(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_otp_codes_process on public.otp_codes(process_id, created_at desc);
create index idx_otp_codes_expires_at on public.otp_codes(expires_at);
create index idx_otp_codes_pending
  on public.otp_codes(process_id, expires_at)
  where consumed_at is null;

alter table public.otp_codes enable row level security;
-- Sem policies: acesso exclusivo por Edge Functions com service role.
