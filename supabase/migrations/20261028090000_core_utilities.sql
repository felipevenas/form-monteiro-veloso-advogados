-- Extensões e utilitários compartilhados por todas as tabelas.
-- pgcrypto: gen_random_uuid()/digest() em versões antigas do Postgres.
-- pg_trgm: busca textual por nome no admin (ILIKE '%...%').
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Trigger padrão de updated_at. Não use em tabelas sem a coluna.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.touch_updated_at() is
  'Atualiza updated_at em cada UPDATE. Aplicado por trigger em todas as tabelas que possuem a coluna.';
