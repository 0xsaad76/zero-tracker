import {readFile, readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

// Real Postgres semantics, ephemeral in-memory database. No cloud users/data.
const db = new PGlite();
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
await db.exec(`create role anon; create role authenticated;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  insert into auth.users(id) values ('${A}'), ('${B}');`);
const migrationDir = new URL('../supabase/migrations/', import.meta.url);
for (const file of (await readdir(migrationDir)).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(await readFile(new URL(file, migrationDir), 'utf8'));
}
const user = async id => db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${id}';`);
const read = async () => (await db.query('select public.zero_read() as snapshot')).rows[0].snapshot;
const write = async (revision, upserts, deletes = []) =>
  (
    await db.query('select public.zero_write($1, $2::jsonb, $3::jsonb) as saved', [
      revision,
      JSON.stringify(upserts),
      JSON.stringify(deletes),
    ])
  ).rows[0].saved;
const record = (owner, id, title) => ({
  kind: 'expenses',
  id,
  data: {id, userId: owner, amount: 30, title, categoryId: 'food', date: '2026-09-04'},
});
try {
  // New portfolios stay invisible to an old client's read/diff/write cycle.
  await user(A);
  const investment = {
    kind: 'investments',
    id: 'portfolio',
    data: {
      id: 'portfolio',
      userId: A,
      name: 'Fund',
      type: 'mutual_fund',
      startDate: '2026-09-01',
      reviewDay: 31,
      reminderEnabled: true,
      flows: [],
      valuations: [],
    },
  };
  assert.equal(await write(0, [investment]), true);
  assert.equal((await read()).records.length, 0);
  assert.equal((await db.query('select public.zero_read_v2() as snapshot')).rows[0].snapshot.records.length, 1);
  assert.equal((await db.query('select public.zero_read_v3() as snapshot')).rows[0].snapshot.records.length, 1);
  await user(B);
  assert.equal((await db.query('select public.zero_read_v2() as snapshot')).rows[0].snapshot.records.length, 0);
  await assert.rejects(write(0, [{...investment, data: {...investment.data, userId: A}}]));
  await user(A);
  assert.equal(await write(1, [record(A, 'old-client', 'Legacy expense')]), true);
  assert.equal((await db.query('select public.zero_read_v2() as snapshot')).rows[0].snapshot.records.length, 2);
  await assert.rejects(write(2, [{...investment, data: {...investment.data, reviewDay: 32}}]));
  await assert.rejects(
    write(2, [
      {
        ...investment,
        data: {
          ...investment.data,
          flows: [{id: 'bad-date', date: '2026-02-31', type: 'contribution', amount: 10}],
        },
      },
    ]),
  );
  await assert.rejects(
    write(2, [
      {
        ...investment,
        data: {
          ...investment.data,
          valuations: [
            {month: '2026-09', date: '2026-09-04', value: 10},
            {month: '2026-09', date: '2026-09-05', value: 11},
          ],
        },
      },
    ]),
  );
  const registry = {
    kind: 'investment_types',
    id: 'registry',
    data: {
      id: 'registry',
      userId: A,
      items: [
        {id: 'mutual_fund', name: 'Mutual funds'},
        {id: 'fixed_deposit', name: 'Fixed deposit'},
      ],
    },
  };
  const customInvestment = {
    ...investment,
    id: 'custom-portfolio',
    data: {...investment.data, id: 'custom-portfolio', name: 'Bank FD', type: 'fixed_deposit'},
  };
  const untypedInvestment = {
    ...investment,
    id: 'untyped-portfolio',
    data: {...investment.data, id: 'untyped-portfolio', name: 'Other asset', type: null},
  };
  assert.equal(await write(2, [registry, customInvestment, untypedInvestment]), true);
  assert.equal((await db.query('select public.zero_read_v3() as snapshot')).rows[0].snapshot.records.length, 5);
  assert.equal((await db.query('select public.zero_read_v2() as snapshot')).rows[0].snapshot.records.length, 2);
  assert.equal((await read()).records.length, 1);
  await assert.rejects(
    write(3, [
      {
        ...registry,
        data: {
          ...registry.data,
          items: [
            {id: 'one', name: 'Cash'},
            {id: 'two', name: 'cash'},
          ],
        },
      },
    ]),
  );
  await assert.rejects(write(3, [{...customInvestment, data: {...customInvestment.data, type: 'x'.repeat(161)}}]));
  // A v2 client can still write a compatible record without deleting records hidden from its snapshot.
  assert.equal(await write(3, [record(A, 'another-old-client', 'Dinner')]), true);
  assert.equal((await db.query('select public.zero_read_v3() as snapshot')).rows[0].snapshot.records.length, 6);
  // Reset only the ephemeral test fixtures before the existing gate.
  await db.exec('reset role; delete from public.zero_records; delete from public.zero_accounts;');
  await user(A);
  assert.deepEqual(await read(), {revision: 0, records: []});
  assert.equal(await write(0, [record(A, 'first', 'Lunch')]), true);
  assert.equal((await read()).records.length, 1);
  assert.equal(await write(0, [record(A, 'stale', 'Must not save')]), false);
  assert.equal((await read()).records.length, 1);
  // A failed batch must restore its earlier deletes as well as reject inserts.
  await assert.rejects(write(1, [record(B, 'bad', 'Wrong owner')], [{kind: 'expenses', id: 'first'}]));
  assert.equal((await read()).records[0].id, 'first');
  assert.equal((await read()).revision, 1);
  await user(B);
  assert.deepEqual(await read(), {revision: 0, records: []});
  assert.equal((await db.query('select * from public.zero_records')).rows.length, 0);
  assert.equal((await db.query('update public.zero_records set data = data returning id')).rows.length, 0);
  await assert.rejects(
    db.query('insert into public.zero_records(user_id,kind,id,data) values ($1,$2,$3,$4::jsonb)', [
      A,
      'expenses',
      'intruder',
      JSON.stringify(record(A, 'intruder', 'Bad').data),
    ]),
  );
  assert.equal(await write(0, [record(B, 'first', 'Own lunch')]), true);
  await user(A);
  assert.equal((await read()).records[0].data.title, 'Lunch');
  assert.equal(await write(1, [], [{kind: 'expenses', id: 'first'}]), true);
  assert.equal((await read()).records.length, 0);
  await user(B);
  assert.equal((await read()).records.length, 1);
  // No default 1,000-row Data API truncation: the RPC returns the whole snapshot.
  assert.equal(
    await write(
      1,
      Array.from({length: 1100}, (_, i) => record(B, `many-${i}`, 'Imported')),
    ),
    true,
  );
  assert.equal((await read()).records.length, 1101);
  await db.exec('reset role; set role anon;');
  await assert.rejects(read());
  await assert.rejects(write(0, []));
  await assert.rejects(db.query('select * from public.zero_records'));
  console.log(
    'PASS: investment compatibility, owner isolation, anonymous denial, CAS conflicts, atomic rollback, account deletion scope, >1,000-row restore.',
  );
} finally {
  await db.close();
}
