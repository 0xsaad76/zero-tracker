-- Expand the record protocol without changing or rewriting existing user data.
alter table public.zero_records drop constraint zero_records_kind_check;
alter table public.zero_records add constraint zero_records_kind_check
  check (kind in (
    'users','categories','expenses','currencies','debtors','debts','budgets','settings','investments','investment_types',
    'trades','trading_strategies','trading_pairs','trading_balances','recurring_schedules'
  ));

-- Schedules reference other records by id. The app validates that the
-- category, investment, or debtor still exists before posting; the table
-- constraint below owns only the self-contained shape.
create function public.zero_valid_recurring_schedule(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare target text;
begin
  if (
    jsonb_typeof(payload) = 'object' and
    jsonb_typeof(payload->'id') = 'string' and length(payload->>'id') between 1 and 160 and
    (payload->>'target') in ('expense','investment','debt') and
    jsonb_typeof(payload->'dayOfMonth') = 'number' and
    (payload->>'dayOfMonth')::numeric between 1 and 31 and
    (payload->>'dayOfMonth')::numeric = trunc((payload->>'dayOfMonth')::numeric) and
    jsonb_typeof(payload->'amount') = 'number' and
    (payload->>'amount')::numeric > 0 and (payload->>'amount')::numeric <= 1000000000000 and
    (payload->>'amount')::numeric * 100 = trunc((payload->>'amount')::numeric * 100) and
    jsonb_typeof(payload->'paused') = 'boolean' and
    jsonb_typeof(payload->'startMonth') = 'string' and payload->>'startMonth' ~ '^\d{4}-(0[1-9]|1[0-2])$' and
    (
      not (payload ? 'lastPostedMonth') or
      jsonb_typeof(payload->'lastPostedMonth') = 'null' or
      (
        jsonb_typeof(payload->'lastPostedMonth') = 'string' and
        payload->>'lastPostedMonth' ~ '^\d{4}-(0[1-9]|1[0-2])$'
      )
    )
  ) is not true then return false; end if;

  target := payload->>'target';
  if target = 'expense' then
    if (
      jsonb_typeof(payload->'categoryId') = 'string' and
      length(payload->>'categoryId') between 1 and 160 and
      jsonb_typeof(payload->'title') = 'string' and
      length(btrim(payload->>'title')) between 1 and 80 and
      (payload->>'title') = btrim(payload->>'title') and
      jsonb_typeof(payload->'description') = 'string' and
      length(payload->>'description') <= 200
    ) is not true then return false; end if;
  elsif target = 'investment' then
    if (
      jsonb_typeof(payload->'investmentId') = 'string' and
      length(payload->>'investmentId') between 1 and 160
    ) is not true then return false; end if;
  else
    if (
      jsonb_typeof(payload->'debtorId') = 'string' and
      length(payload->>'debtorId') between 1 and 160 and
      (payload->>'debtType') in ('Borrow','Lend') and
      jsonb_typeof(payload->'description') = 'string' and
      length(payload->>'description') <= 200
    ) is not true then return false; end if;
  end if;

  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.zero_valid_recurring_schedule(jsonb) from public, anon;
grant execute on function public.zero_valid_recurring_schedule(jsonb) to authenticated;

alter table public.zero_records add constraint recurring_schedule_shape
  check (kind <> 'recurring_schedules' or public.zero_valid_recurring_schedule(data));

-- v5 is the current protocol. Older readers hide records they cannot decode,
-- preserving mixed-version safety during app rollout and rollback.
create function public.zero_read_v5() returns jsonb
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
revoke all on function public.zero_read_v5() from public, anon;
grant execute on function public.zero_read_v5() to authenticated;

create or replace function public.zero_read_v4() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; compatible_records jsonb;
begin
  snapshot := public.zero_read_v5();
  select coalesce(jsonb_agg(record), '[]'::jsonb) into compatible_records
    from jsonb_array_elements(snapshot->'records') record
    where record->>'kind' <> 'recurring_schedules';
  return jsonb_build_object('revision',snapshot->'revision','records',compatible_records);
end;
$$;
revoke all on function public.zero_read_v4() from public, anon;
grant execute on function public.zero_read_v4() to authenticated;

create or replace function public.zero_read_v3() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; compatible_records jsonb;
begin
  snapshot := public.zero_read_v5();
  select coalesce(jsonb_agg(record), '[]'::jsonb) into compatible_records
    from jsonb_array_elements(snapshot->'records') record
    where record->>'kind' not in ('trades','trading_strategies','trading_pairs','trading_balances','recurring_schedules');
  return jsonb_build_object('revision',snapshot->'revision','records',compatible_records);
end;
$$;
revoke all on function public.zero_read_v3() from public, anon;
grant execute on function public.zero_read_v3() to authenticated;

create or replace function public.zero_read_v2() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; compatible_records jsonb;
begin
  snapshot := public.zero_read_v5();
  select coalesce(jsonb_agg(record), '[]'::jsonb) into compatible_records
    from jsonb_array_elements(snapshot->'records') record
    where record->>'kind' not in ('investment_types','trades','trading_strategies','trading_pairs','trading_balances','recurring_schedules')
      and (
        record->>'kind' <> 'investments' or
        record->'data'->>'type' in ('mutual_fund','gold','silver','emergency_cash')
      );
  return jsonb_build_object('revision',snapshot->'revision','records',compatible_records);
end;
$$;
revoke all on function public.zero_read_v2() from public, anon;
grant execute on function public.zero_read_v2() to authenticated;
