-- Expand only: existing rows/RLS/write transactions remain intact.
alter table public.zero_records drop constraint zero_records_kind_check;
alter table public.zero_records add constraint zero_records_kind_check
  check (kind in ('users','categories','expenses','currencies','debtors','debts','budgets','settings','investments'));
alter table public.zero_records add constraint investment_shape check (kind <> 'investments' or (
  jsonb_typeof(data->'name') = 'string' and length(data->>'name') between 1 and 80 and
  data->>'type' in ('mutual_fund','gold','silver','emergency_cash') and
  jsonb_typeof(data->'flows') = 'array' and jsonb_typeof(data->'valuations') = 'array' and
  jsonb_typeof(data->'reminderEnabled') = 'boolean' and
  jsonb_typeof(data->'reviewDay') = 'number' and (data->>'reviewDay')::numeric between 1 and 31 and
  (data->>'reviewDay')::numeric = trunc((data->>'reviewDay')::numeric) and
  data->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$'
) is true);

create function public.zero_read_v2() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare owner uuid := auth.uid(); current_revision bigint; result jsonb;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  insert into public.zero_accounts(user_id) values (owner) on conflict do nothing;
  select revision into current_revision from public.zero_accounts where user_id = owner for share;
  select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'data',data) order by kind,id), '[]'::jsonb)
    into result from public.zero_records where user_id = owner;
  return jsonb_build_object('revision',current_revision,'records',result);
end;
$$;
revoke all on function public.zero_read_v2() from public, anon;
grant execute on function public.zero_read_v2() to authenticated;

-- Older clients reconstruct/deletion-diff their entire snapshot. Do not expose
-- new record kinds to them, otherwise saving an expense could delete a portfolio.
create or replace function public.zero_read() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; legacy_records jsonb;
begin
  snapshot := public.zero_read_v2();
  select coalesce(jsonb_agg(r), '[]'::jsonb) into legacy_records
    from jsonb_array_elements(snapshot->'records') r
    where r->>'kind' in ('users','categories','expenses','currencies','debtors','debts','budgets','settings');
  return jsonb_build_object('revision',snapshot->'revision','records',legacy_records);
end;
$$;
