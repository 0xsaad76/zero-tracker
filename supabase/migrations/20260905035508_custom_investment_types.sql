-- Expand the record protocol without changing or rewriting existing user data.
alter table public.zero_records drop constraint zero_records_kind_check;
alter table public.zero_records add constraint zero_records_kind_check
  check (kind in (
    'users','categories','expenses','currencies','debtors','debts','budgets','settings','investments','investment_types'
  ));

-- Investment types are optional references. The registry constraint below owns
-- the allowed choices; keeping this field as text avoids coupling independent
-- JSON records inside a table CHECK constraint.
create or replace function public.zero_valid_investment(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  started date;
  entry jsonb;
  entry_date date;
  amount numeric;
begin
  if (
    jsonb_typeof(payload) = 'object' and
    jsonb_typeof(payload->'id') = 'string' and length(payload->>'id') between 1 and 160 and
    jsonb_typeof(payload->'name') = 'string' and length(btrim(payload->>'name')) between 1 and 80 and
    payload->>'name' = btrim(payload->>'name') and
    (
      not (payload ? 'type') or
      jsonb_typeof(payload->'type') = 'null' or
      (
        jsonb_typeof(payload->'type') = 'string' and
        length(payload->>'type') between 1 and 160 and
        payload->>'type' = btrim(payload->>'type')
      )
    ) and
    jsonb_typeof(payload->'startDate') = 'string' and payload->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$' and
    substring(payload->>'startDate' from 1 for 4)::integer >= 1900 and
    jsonb_typeof(payload->'reviewDay') = 'number' and
    (payload->>'reviewDay')::numeric between 1 and 31 and
    (payload->>'reviewDay')::numeric = trunc((payload->>'reviewDay')::numeric) and
    jsonb_typeof(payload->'reminderEnabled') = 'boolean' and
    jsonb_typeof(payload->'flows') = 'array' and jsonb_array_length(payload->'flows') <= 5000 and
    jsonb_typeof(payload->'valuations') = 'array' and jsonb_array_length(payload->'valuations') <= 1200
  ) is not true then return false; end if;

  started := (payload->>'startDate')::date;
  if pg_catalog.to_char(started, 'YYYY-MM-DD') <> payload->>'startDate' then return false; end if;

  for entry in select value from jsonb_array_elements(payload->'flows') loop
    if (
      jsonb_typeof(entry) = 'object' and
      jsonb_typeof(entry->'id') = 'string' and length(entry->>'id') between 1 and 160 and
      jsonb_typeof(entry->'date') = 'string' and entry->>'date' ~ '^\d{4}-\d{2}-\d{2}$' and
      entry->>'type' in ('contribution','withdrawal') and
      jsonb_typeof(entry->'amount') = 'number'
    ) is not true then return false; end if;
    entry_date := (entry->>'date')::date;
    amount := (entry->>'amount')::numeric;
    if pg_catalog.to_char(entry_date, 'YYYY-MM-DD') <> entry->>'date' or entry_date < started or
      amount <= 0 or amount > 1000000000000 or amount * 100 <> trunc(amount * 100)
    then return false; end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(payload->'flows') value
    group by value->>'id' having count(*) > 1
  ) then return false; end if;

  for entry in select value from jsonb_array_elements(payload->'valuations') loop
    if (
      jsonb_typeof(entry) = 'object' and
      jsonb_typeof(entry->'month') = 'string' and entry->>'month' ~ '^\d{4}-(0[1-9]|1[0-2])$' and
      substring(entry->>'month' from 1 for 4)::integer >= 1900 and
      jsonb_typeof(entry->'date') = 'string' and entry->>'date' ~ '^\d{4}-\d{2}-\d{2}$' and
      jsonb_typeof(entry->'value') = 'number'
    ) is not true then return false; end if;
    entry_date := (entry->>'date')::date;
    amount := (entry->>'value')::numeric;
    if pg_catalog.to_char(entry_date, 'YYYY-MM-DD') <> entry->>'date' or
      pg_catalog.to_char(entry_date, 'YYYY-MM') <> entry->>'month' or entry_date < started or
      amount < 0 or amount > 1000000000000 or amount * 100 <> trunc(amount * 100)
    then return false; end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(payload->'valuations') value
    group by value->>'month' having count(*) > 1
  ) then return false; end if;

  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.zero_valid_investment(jsonb) from public, anon;
grant execute on function public.zero_valid_investment(jsonb) to authenticated;

create function public.zero_valid_investment_type_registry(payload jsonb) returns boolean
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
revoke all on function public.zero_valid_investment_type_registry(jsonb) from public, anon;
grant execute on function public.zero_valid_investment_type_registry(jsonb) to authenticated;

alter table public.zero_records add constraint investment_type_registry_shape
  check (
    kind <> 'investment_types' or
    (id = 'registry' and public.zero_valid_investment_type_registry(data))
  );

-- v3 is the current protocol. v2 hides records it cannot decode, preserving
-- mixed-version safety during app rollout and rollback.
create function public.zero_read_v3() returns jsonb
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
revoke all on function public.zero_read_v3() from public, anon;
grant execute on function public.zero_read_v3() to authenticated;

create or replace function public.zero_read_v2() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; compatible_records jsonb;
begin
  snapshot := public.zero_read_v3();
  select coalesce(jsonb_agg(record), '[]'::jsonb) into compatible_records
    from jsonb_array_elements(snapshot->'records') record
    where record->>'kind' <> 'investment_types'
      and (
        record->>'kind' <> 'investments' or
        record->'data'->>'type' in ('mutual_fund','gold','silver','emergency_cash')
      );
  return jsonb_build_object('revision',snapshot->'revision','records',compatible_records);
end;
$$;
revoke all on function public.zero_read_v2() from public, anon;
grant execute on function public.zero_read_v2() to authenticated;
