-- Perfis administrativos (equipe do escritório) ligados ao Supabase Auth.
-- O público nunca tem linha aqui: cliente acessa o processo via sessão opaca.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'atendimento'
    check (role in ('owner', 'admin', 'juridico', 'financeiro', 'atendimento')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role) where active;
create unique index idx_profiles_email_lower on public.profiles(lower(email));

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Helpers de autorização usados nas policies. SECURITY DEFINER para ler profiles
-- sem depender das próprias policies (evita recursão de RLS).
create or replace function public.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active
      and p.role = any(roles)
  );
$$;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.active;
$$;

-- Papéis com acesso a CPF/endereço completo e a metadados de documentos (dados sensíveis).
create or replace function public.has_sensitive_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role(array['owner', 'admin', 'juridico', 'financeiro']);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role(array['owner', 'admin']);
$$;

comment on function public.is_admin() is
  'true para owner/admin ativos. Atalho de has_role() para policies administrativas.';

revoke execute on function public.has_role(text[]) from public, anon;
revoke execute on function public.current_role_name() from public, anon;
revoke execute on function public.has_sensitive_access() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.has_role(text[]) to authenticated, service_role;
grant execute on function public.current_role_name() to authenticated, service_role;
grant execute on function public.has_sensitive_access() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- Escrita de profiles é feita por Edge Function (service role).

-- Provisionamento: cria o profile inativo no signup. Um owner precisa ativar e
-- definir o papel antes de o usuário ler qualquer dado (active = false).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'atendimento',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
