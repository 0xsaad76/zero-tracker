create function public.zero_valid_investment(payload jsonb) returns boolean
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
    payload->>'type' in ('mutual_fund','gold','silver','emergency_cash') and
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

alter table public.zero_records drop constraint investment_shape;
alter table public.zero_records add constraint investment_shape
  check (kind <> 'investments' or public.zero_valid_investment(data));
