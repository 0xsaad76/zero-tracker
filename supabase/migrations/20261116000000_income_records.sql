-- Expand the record protocol without changing or rewriting existing user data.
alter table public.zero_records drop constraint zero_records_kind_check;
alter table public.zero_records add constraint zero_records_kind_check
  check (kind in (
    'users','categories','expenses','currencies','debtors','debts','budgets','settings','investments','investment_types',
    'trades','trading_strategies','trading_pairs','trading_balances','recurring_schedules','incomes'
  ));

-- Income is self-contained: a source, an amount, a real calendar day, a note.
create function public.zero_valid_income(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if (
    jsonb_typeof(payload) = 'object' and
    jsonb_typeof(payload->'id') = 'string' and length(payload->>'id') between 1 and 160 and
    jsonb_typeof(payload->'title') = 'string' and
    length(btrim(payload->>'title')) between 1 and 80 and
    (payload->>'title') = btrim(payload->>'title') and
    jsonb_typeof(payload->'amount') = 'number' and
    (payload->>'amount')::numeric > 0 and (payload->>'amount')::numeric <= 1000000000000 and
    (payload->>'amount')::numeric * 100 = trunc((payload->>'amount')::numeric * 100) and
    jsonb_typeof(payload->'date') = 'string' and
    payload->>'date' ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$' and
    -- to_char round-trip rejects impossible days such as 2026-02-31.
    to_char((payload->>'date')::date, 'YYYY-MM-DD') = payload->>'date' and
    (payload->>'date')::date >= date '1900-01-01' and
    jsonb_typeof(payload->'description') = 'string' and
    length(payload->>'description') <= 200
  ) is not true then return false; end if;
  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.zero_valid_income(jsonb) from public, anon;
grant execute on function public.zero_valid_income(jsonb) to authenticated;

alter table public.zero_records add constraint income_shape
  check (kind <> 'incomes' or public.zero_valid_income(data));

-- v6 is the current protocol. Older readers hide records they cannot decode,
-- preserving mixed-version safety during app rollout and rollback.
create function public.zero_read_v6() returns jsonb
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
revoke all on function public.zero_read_v6() from public, anon;
grant execute on function public.zero_read_v6() to authenticated;

-- v5 becomes a filter over v6. v4, v3 and v2 already read through v5, so they
-- inherit the income filter without being redefined.
create or replace function public.zero_read_v5() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; compatible_records jsonb;
begin
  snapshot := public.zero_read_v6();
  select coalesce(jsonb_agg(record), '[]'::jsonb) into compatible_records
    from jsonb_array_elements(snapshot->'records') record
    where record->>'kind' <> 'incomes';
  return jsonb_build_object('revision',snapshot->'revision','records',compatible_records);
end;
$$;
revoke all on function public.zero_read_v5() from public, anon;
grant execute on function public.zero_read_v5() to authenticated;
