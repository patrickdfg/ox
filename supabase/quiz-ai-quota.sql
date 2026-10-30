-- 퀴즈 생성 횟수만 저장한다. 원고와 생성 결과는 저장하지 않는다.
create table if not exists public.quiz_ai_usage (
  usage_date date not null,
  user_id text not null,
  attempts integer not null default 0,
  last_at timestamptz not null default now(),
  primary key (usage_date, user_id)
);
alter table public.quiz_ai_usage enable row level security;
revoke all on public.quiz_ai_usage from public, anon, authenticated;

create or replace function public.quiz_ai_reserve(p_uid text)
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_day date := timezone('Asia/Seoul', now())::date;
  v_used integer := 0;
  v_total integer := 0;
  v_last timestamptz;
begin
  if auth.role() is distinct from 'service_role' or p_uid is null or length(p_uid) < 1 or length(p_uid) > 128 then
    raise exception 'invalid request';
  end if;
  perform pg_advisory_xact_lock(71183225012::bigint);
  select attempts, last_at into v_used, v_last from public.quiz_ai_usage where usage_date = v_day and user_id = p_uid;
  v_used := coalesce(v_used, 0);
  select coalesce(sum(attempts), 0) into v_total from public.quiz_ai_usage where usage_date = v_day;
  if v_used >= 10 or v_total >= 100 then return jsonb_build_object('allowed', false, 'reason', 'daily'); end if;
  if v_last is not null and v_last > now() - interval '10 seconds' then return jsonb_build_object('allowed', false, 'reason', 'interval'); end if;
  insert into public.quiz_ai_usage(usage_date, user_id, attempts, last_at) values(v_day, p_uid, 1, now())
  on conflict (usage_date, user_id) do update set attempts = quiz_ai_usage.attempts + 1, last_at = now();
  return jsonb_build_object('allowed', true);
end; $$;
revoke all on function public.quiz_ai_reserve(text) from public, anon, authenticated;
grant execute on function public.quiz_ai_reserve(text) to service_role;
