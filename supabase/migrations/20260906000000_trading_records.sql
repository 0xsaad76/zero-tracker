-- Expand the record protocol without changing or rewriting existing user data.
alter table public.zero_records drop constraint zero_records_kind_check;
alter table public.zero_records add constraint zero_records_kind_check
  check (kind in (
    'users','categories','expenses','currencies','debtors','debts','budgets','settings','investments','investment_types',
    'trades','trading_strategies','trading_pairs','trading_balances'
  ));

create function public.zero_valid_trade(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare entry_date date;
begin
  if (
    jsonb_typeof(payload) = 'object' and
    jsonb_typeof(payload->'id') = 'string' and length(payload->>'id') between 1 and 160 and
    jsonb_typeof(payload->'pair') = 'string' and
    length(payload->>'pair') between 1 and 160 and (payload->>'pair') = btrim(payload->>'pair') and
    (payload->>'direction') in ('long','short') and
    jsonb_typeof(payload->'leverage') = 'number' and
    (payload->>'leverage')::numeric between 1 and 125 and
    (payload->>'leverage')::numeric = trunc((payload->>'leverage')::numeric) and
    jsonb_typeof(payload->'avgPrice') = 'number' and
    (payload->>'avgPrice')::numeric > 0 and (payload->>'avgPrice')::numeric <= 1000000000000 and
    jsonb_typeof(payload->'date') = 'string' and payload->>'date' ~ '^\d{4}-\d{2}-\d{2}$' and
    substring(payload->>'date' from 1 for 4)::integer >= 1900 and
    jsonb_typeof(payload->'riskReward') = 'number' and
    (payload->>'riskReward')::numeric between 0.05 and 100 and
    jsonb_typeof(payload->'strategy') = 'string' and
    length(payload->>'strategy') between 1 and 160 and (payload->>'strategy') = btrim(payload->>'strategy') and
    jsonb_typeof(payload->'reason') = 'string' and
    length(btrim(payload->>'reason')) between 1 and 500 and (payload->>'reason') = btrim(payload->>'reason') and
    jsonb_typeof(payload->'pnl') = 'number' and
    (payload->>'pnl')::numeric between -1000000000000 and 1000000000000
  ) is not true then return false; end if;

  entry_date := (payload->>'date')::date;
  if pg_catalog.to_char(entry_date, 'YYYY-MM-DD') <> payload->>'date' then return false; end if;
  -- Two-decimal money for pnl, up to eight decimals for crypto average prices.
  if (payload->>'pnl')::numeric * 100 <> trunc((payload->>'pnl')::numeric * 100) then return false; end if;
  if (payload->>'avgPrice')::numeric * 100000000 <> trunc((payload->>'avgPrice')::numeric * 100000000) then return false; end if;
  if (payload->>'riskReward')::numeric * 100 <> trunc((payload->>'riskReward')::numeric * 100) then return false; end if;

  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.zero_valid_trade(jsonb) from public, anon;
grant execute on function public.zero_valid_trade(jsonb) to authenticated;

create function public.zero_valid_trading_strategy_registry(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare entry jsonb;
begin
  if (
    jsonb_typeof(payload) = 'object' and
    payload->>'id' = 'registry' and
    jsonb_typeof(payload->'userId') = 'string' and
    jsonb_typeof(payload->'items') = 'array' and
    jsonb_array_length(payload->'items') <= 100
  ) is not true then return false; end if;

  for entry in select value from jsonb_array_elements(payload->'items') loop
    if (
      jsonb_typeof(entry) = 'object' and
      jsonb_typeof(entry->'id') = 'string' and
      length(entry->>'id') between 1 and 160 and entry->>'id' = btrim(entry->>'id') and
      jsonb_typeof(entry->'name') = 'string' and
      length(entry->>'name') between 1 and 40 and entry->>'name' = btrim(entry->>'name')
    ) is not true then return false; end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(payload->'items') value
    group by value->>'id' having count(*) > 1
  ) then return false; end if;
  if exists (
    select 1 from jsonb_array_elements(payload->'items') value
    group by pg_catalog.lower(value->>'name') having count(*) > 1
  ) then return false; end if;

  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.zero_valid_trading_strategy_registry(jsonb) from public, anon;
grant execute on function public.zero_valid_trading_strategy_registry(jsonb) to authenticated;

create function public.zero_valid_trading_pair_registry(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare entry jsonb;
begin
  if (
    jsonb_typeof(payload) = 'object' and
    payload->>'id' = 'registry' and
    jsonb_typeof(payload->'userId') = 'string' and
    jsonb_typeof(payload->'items') = 'array' and
    jsonb_array_length(payload->'items') <= 100
  ) is not true then return false; end if;

  for entry in select value from jsonb_array_elements(payload->'items') loop
    if (
      jsonb_typeof(entry) = 'object' and
      jsonb_typeof(entry->'id') = 'string' and
      length(entry->>'id') between 1 and 160 and entry->>'id' = btrim(entry->>'id') and
      jsonb_typeof(entry->'name') = 'string' and
      length(entry->>'name') between 1 and 20 and entry->>'name' = btrim(entry->>'name')
    ) is not true then return false; end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(payload->'items') value
    group by value->>'id' having count(*) > 1
  ) then return false; end if;
  if exists (
    select 1 from jsonb_array_elements(payload->'items') value
    group by pg_catalog.lower(value->>'name') having count(*) > 1
  ) then return false; end if;

  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.zero_valid_trading_pair_registry(jsonb) from public, anon;
grant execute on function public.zero_valid_trading_pair_registry(jsonb) to authenticated;

create function public.zero_valid_trading_balance_registry(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare entry jsonb;
begin
  if (
    jsonb_typeof(payload) = 'object' and
    payload->>'id' = 'registry' and
    jsonb_typeof(payload->'userId') = 'string' and
    jsonb_typeof(payload->'items') = 'array' and
    jsonb_array_length(payload->'items') <= 1200
  ) is not true then return false; end if;

  for entry in select value from jsonb_array_elements(payload->'items') loop
    if (
      jsonb_typeof(entry) = 'object' and
      jsonb_typeof(entry->'month') = 'string' and entry->>'month' ~ '^\d{4}-(0[1-9]|1[0-2])$' and
      jsonb_typeof(entry->'openingBalance') = 'number' and
      (entry->>'openingBalance')::numeric between 0 and 1000000000000 and
      (entry->>'openingBalance')::numeric * 100 = trunc((entry->>'openingBalance')::numeric * 100)
    ) is not true then return false; end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(payload->'items') value
    group by value->>'month' having count(*) > 1
  ) then return false; end if;

  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.zero_valid_trading_balance_registry(jsonb) from public, anon;
grant execute on function public.zero_valid_trading_balance_registry(jsonb) to authenticated;

alter table public.zero_records add constraint trade_shape
  check (kind <> 'trades' or public.zero_valid_trade(data));
alter table public.zero_records add constraint trading_strategy_registry_shape
  check (
    kind <> 'trading_strategies' or
    (id = 'registry' and public.zero_valid_trading_strategy_registry(data))
  );
alter table public.zero_records add constraint trading_pair_registry_shape
  check (
    kind <> 'trading_pairs' or
    (id = 'registry' and public.zero_valid_trading_pair_registry(data))
  );
alter table public.zero_records add constraint trading_balance_registry_shape
  check (
    kind <> 'trading_balances' or
    (id = 'registry' and public.zero_valid_trading_balance_registry(data))
  );

-- v4 is the current protocol. v3 and older hide records they cannot decode,
-- preserving mixed-version safety during app rollout and rollback.
create function public.zero_read_v4() returns jsonb
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
revoke all on function public.zero_read_v4() from public, anon;
grant execute on function public.zero_read_v4() to authenticated;

create or replace function public.zero_read_v3() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; compatible_records jsonb;
begin
  snapshot := public.zero_read_v4();
  select coalesce(jsonb_agg(record), '[]'::jsonb) into compatible_records
    from jsonb_array_elements(snapshot->'records') record
    where record->>'kind' not in ('trades','trading_strategies','trading_pairs','trading_balances');
  return jsonb_build_object('revision',snapshot->'revision','records',compatible_records);
end;
$$;
revoke all on function public.zero_read_v3() from public, anon;
grant execute on function public.zero_read_v3() to authenticated;

create or replace function public.zero_read_v2() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; compatible_records jsonb;
begin
  snapshot := public.zero_read_v4();
  select coalesce(jsonb_agg(record), '[]'::jsonb) into compatible_records
    from jsonb_array_elements(snapshot->'records') record
    where record->>'kind' not in ('investment_types','trades','trading_strategies','trading_pairs','trading_balances')
      and (
        record->>'kind' <> 'investments' or
        record->'data'->>'type' in ('mutual_fund','gold','silver','emergency_cash')
      );
  return jsonb_build_object('revision',snapshot->'revision','records',compatible_records);
end;
$$;
revoke all on function public.zero_read_v2() from public, anon;
grant execute on function public.zero_read_v2() to authenticated;
