-- Private per-account JSONB records. The mobile client holds only a publishable
-- key; RLS enforces ownership even if a client bypasses the supplied functions.
create table public.zero_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0)
);
create table public.zero_records (
  user_id uuid not null references public.zero_accounts(user_id) on delete cascade,
  kind text not null check (kind in ('users','categories','expenses','currencies','debtors','debts','budgets','settings')),
  id text not null check (length(id) between 1 and 160),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (user_id, kind, id),
  constraint record_identity check (kind = 'settings' or (data->>'id' is not null and data->>'id' = id)),
  constraint record_owner check (kind in ('users','settings') or (data->>'userId' is not null and data->>'userId' = user_id::text)),
  constraint singleton_identity check (kind not in ('users','currencies') or id = user_id::text),
  constraint settings_identity check (kind <> 'settings' or id = 'preferences'),
  constraint financial_amount check (kind not in ('expenses','debts','budgets') or
    (jsonb_typeof(data->'amount') = 'number' and data->>'amount' is not null and (data->>'amount')::numeric >= 0))
);

alter table public.zero_accounts enable row level security;
alter table public.zero_records enable row level security;
create policy owner_only on public.zero_accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_only on public.zero_records for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.zero_accounts, public.zero_records from public, anon;
grant select, insert, update, delete on public.zero_accounts, public.zero_records to authenticated;

-- Returns an atomic account snapshot as one JSON response. Unlike a paginated
-- table query this cannot silently truncate transactions at PostgREST's row cap.
create function public.zero_read() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid := auth.uid();
  current_revision bigint;
  result jsonb;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  insert into public.zero_accounts(user_id) values (owner) on conflict do nothing;
  select revision into current_revision from public.zero_accounts where user_id = owner for share;
  select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'data',data) order by kind,id), '[]'::jsonb)
    into result from public.zero_records where user_id = owner;
  return jsonb_build_object('revision',current_revision,'records',result);
end;
$$;

-- Compare-and-swap a batch: retries re-read on conflicts; partial writes roll
-- back. auth.uid(), never a caller-supplied user ID, owns every write.
create function public.zero_write(expected_revision bigint, upserts jsonb, deletes jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid := auth.uid();
  current_revision bigint;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(upserts) is distinct from 'array' or jsonb_typeof(deletes) is distinct from 'array' then
    raise exception 'Expected record arrays' using errcode = '22023';
  end if;
  insert into public.zero_accounts(user_id) values (owner) on conflict do nothing;
  select revision into current_revision from public.zero_accounts where user_id = owner for update;
  if expected_revision is null or expected_revision <> current_revision then return false; end if;
  delete from public.zero_records r using jsonb_to_recordset(deletes) as d(kind text,id text)
    where r.user_id = owner and r.kind = d.kind and r.id = d.id;
  insert into public.zero_records(user_id,kind,id,data)
    select owner,u.kind,u.id,u.data from jsonb_to_recordset(upserts) as u(kind text,id text,data jsonb)
    on conflict (user_id,kind,id) do update set data = excluded.data;
  update public.zero_accounts set revision = revision + 1 where user_id = owner;
  return true;
end;
$$;
revoke all on function public.zero_read() from public, anon;
revoke all on function public.zero_write(bigint,jsonb,jsonb) from public, anon;
grant execute on function public.zero_read(), public.zero_write(bigint,jsonb,jsonb) to authenticated;
