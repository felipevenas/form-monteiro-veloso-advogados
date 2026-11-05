-- RPCs chamadas apenas por Edge Functions (service role).

-- Reserva atômica de jobs: FOR UPDATE SKIP LOCKED permite N workers concorrentes
-- sem deadlock. Devolve as linhas já marcadas como RUNNING.
create or replace function public.claim_outbox_jobs(
  p_limit integer default 10,
  p_worker_id text default 'worker'
)
returns setof public.outbox_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
begin
  v_limit := least(greatest(coalesce(p_limit, 10), 1), 100);

  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'p_worker_id é obrigatório' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select j.id
    from public.outbox_jobs j
    where j.status in ('PENDING', 'FAILED')
      and j.run_at <= now()
      and coalesce(j.next_attempt_at, j.run_at) <= now()
      and j.attempt_count < j.max_attempts
    order by j.run_at, j.created_at
    limit v_limit
    for update skip locked
  ),
  claimed as (
    update public.outbox_jobs o
       set status = 'RUNNING',
           locked_at = now(),
           locked_by = p_worker_id,
           attempt_count = o.attempt_count + 1,
           updated_at = now()
      from candidates c
     where o.id = c.id
    returning o.*
  )
  select * from claimed;
end;
$$;

comment on function public.claim_outbox_jobs(integer, text) is
  'Reserva até p_limit (1..100) jobs pendentes/falhos e os retorna já em RUNNING. Exclusivo de service_role.';

-- Rate limit de janela fixa. O upsert é atômico e dispensa transação explícita.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'p_key é obrigatório' using errcode = '22023';
  end if;

  if p_limit is null or p_limit <= 0 then
    raise exception 'p_limit deve ser maior que zero' using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'p_window_seconds deve ser maior ou igual a 1' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    (
      floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
    )::double precision
  );

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start) do update
    set count = rl.count + 1
  returning rl.count into v_count;

  -- Limpeza oportunista (~1% das chamadas) para a tabela não crescer sem limite.
  if random() < 0.01 then
    delete from public.rate_limits
    where window_start < now() - interval '2 days';
  end if;

  return query
  select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Incrementa o contador de janela fixa e informa se a requisição está dentro do limite.';

revoke execute on function public.claim_outbox_jobs(integer, text) from public, anon, authenticated;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_outbox_jobs(integer, text) to service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
