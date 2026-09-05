import {supabase} from '../src/cloud/client';
import {
  decodeRecords,
  encodeRecords,
  emptyCloudData,
  flushCloudWrites,
  mutateCloudData,
  readCloudData,
  setCloudUser,
  type CloudRecord,
} from '../src/cloud/records';
import {createExpense, updateExpenseById, deleteDebtorById, getAllExpensesByMonth} from '../src/cloud/domain';
import {upsertBudget} from '../src/cloud/budgets';
import {
  deleteInvestment,
  deleteInvestmentEntry,
  deleteInvestmentType,
  saveInvestment,
  saveInvestmentEntry,
  saveInvestmentType,
} from '../src/investments/service';

jest.mock('../src/cloud/client', () => ({supabase: {auth: {getSession: jest.fn()}, rpc: jest.fn()}}));
let remote: {revision: number; records: CloudRecord[]};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const auth = jest.mocked(supabase.auth.getSession);
const rpc = jest.mocked(supabase.rpc);
let conflict = false;
let failWrite = false;
const calls: {name: string; args: Record<string, unknown>; token?: string}[] = [];

beforeEach(async () => {
  setCloudUser(null);
  await flushCloudWrites();
  setCloudUser('account-a');
  jest.clearAllMocks();
  calls.length = 0;
  conflict = false;
  failWrite = false;
  const data = emptyCloudData();
  data.categories = [{id: 'food', userId: 'account-a', name: 'Food', icon: '', color: '#808080', categoryStatus: true}];
  remote = {revision: 0, records: encodeRecords(data)};
  auth.mockResolvedValue({data: {session: {user: {id: 'account-a'}, access_token: 'token-a'}}, error: null} as never);
  rpc.mockImplementation(((name: string, args: Record<string, unknown>) => {
    const call = {name, args, token: undefined as string | undefined};
    calls.push(call);
    return {
      setHeader: (_name: string, value: string) => {
        call.token = value;
        return {
          abortSignal: async () => {
            if (name === 'zero_read_v3') return {data: clone(remote), error: null};
            if (failWrite) return {data: null, error: {message: 'offline'}};
            if (conflict) {
              conflict = false;
              remote.revision++;
              remote.records.push({
                kind: 'expenses',
                id: 'other-device',
                data: {
                  id: 'other-device',
                  userId: 'account-a',
                  amount: 20,
                  title: 'Other',
                  categoryId: 'food',
                  date: '2026-09-03',
                },
              });
              return {data: false, error: null};
            }
            if (args.expected_revision !== remote.revision) return {data: false, error: null};
            for (const r of args.deletes as CloudRecord[])
              remote.records = remote.records.filter(old => old.kind !== r.kind || old.id !== r.id);
            for (const r of args.upserts as CloudRecord[]) {
              remote.records = remote.records.filter(old => old.kind !== r.kind || old.id !== r.id);
              remote.records.push(clone(r));
            }
            remote.revision++;
            return {data: true, error: null};
          },
        };
      },
    };
  }) as never);
});
afterEach(async () => {
  setCloudUser(null);
  await flushCloudWrites();
});

it('saves each record remotely and binds the request to the original token', async () => {
  const id = await createExpense('account-a', 'Lunch', 50, '', 'food', '2026-09-04');
  expect((await getAllExpensesByMonth('account-a', '2026-09'))[0]).toMatchObject({
    id,
    amount: 50,
    category: {name: 'Food'},
  });
  expect(calls.every(c => c.token === 'Bearer token-a')).toBe(true);
  expect(calls.find(c => c.name === 'zero_write')!.args.upserts as CloudRecord[]).toHaveLength(1);
});
it('updates existing amounts instead of mutating the comparison baseline', async () => {
  const id = await createExpense('account-a', 'Lunch', 50, '', 'food', '2026-09-04');
  await updateExpenseById(id, undefined, undefined, 70);
  expect(decodeRecords(remote.records).expenses[0].amount).toBe(70);
});
it('retries a revision conflict without losing another device’s record', async () => {
  conflict = true;
  const id = await createExpense('account-a', 'Lunch', 50, '', 'food', '2026-09-04');
  expect(
    decodeRecords(remote.records)
      .expenses.map(e => e.id)
      .sort(),
  ).toEqual([id, 'other-device'].sort());
  expect(calls.filter(c => c.name === 'zero_write')).toHaveLength(2);
});
it('serializes concurrent saves so both survive', async () => {
  await Promise.all([
    createExpense('account-a', 'One', 10, '', 'food', '2026-09-04'),
    createExpense('account-a', 'Two', 20, '', 'food', '2026-09-04'),
  ]);
  expect(decodeRecords(remote.records).expenses).toHaveLength(2);
});
it('does not report a failed cloud write as saved', async () => {
  failWrite = true;
  await expect(createExpense('account-a', 'Lunch', 50, '', 'food', '2026-09-04')).rejects.toThrow('cloud data');
  expect(decodeRecords(remote.records).expenses).toEqual([]);
});
it('rejects cross-account and signed-out requests before sending data', async () => {
  await expect(createExpense('account-b', 'Wrong', 50, '', 'food', '2026-09-04')).rejects.toThrow('sign in');
  setCloudUser(null);
  await expect(readCloudData()).rejects.toThrow('sign in');
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects a request if account changes while credentials are resolving', async () => {
  let resolve!: (value: unknown) => void;
  auth.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolve = r;
      }) as never,
  );
  const read = readCloudData();
  setCloudUser('account-b');
  resolve({data: {session: {user: {id: 'account-a'}, access_token: 'token-a'}}, error: null});
  await expect(read).rejects.toThrow('account changed');
  expect(rpc).not.toHaveBeenCalled();
});
it('deep-clones settings and receipts before diffing', async () => {
  remote.records.push({
    kind: 'settings',
    id: 'preferences',
    data: {
      preferences: {theme: 'light', locale: null, weekStart: 'monday', showBudgetProgress: true},
      legacyImports: ['old'],
    },
  });
  await mutateCloudData(draft => {
    draft.preferences!.theme = 'dark';
    draft.legacyImports!.push('new');
  });
  expect(decodeRecords(remote.records).preferences!.theme).toBe('dark');
  expect(decodeRecords(remote.records).legacyImports).toEqual(['old', 'new']);
});
it('deletes a debtor and their debts in one server batch', async () => {
  await mutateCloudData(d => {
    d.debtors.push({
      id: 'friend',
      userId: 'account-a',
      title: 'Friend',
      type: 'Other',
      debtorStatus: true,
      icon: '',
      color: '#808080',
    });
    d.debts.push({
      id: 'loan',
      userId: 'account-a',
      debtorId: 'friend',
      amount: 50,
      description: '',
      date: '2026-09-04',
      type: 'lent',
    });
  });
  await deleteDebtorById('friend');
  expect(decodeRecords(remote.records).debts).toEqual([]);
  expect(calls.filter(c => c.name === 'zero_write').at(-1)!.args.deletes as CloudRecord[]).toHaveLength(2);
});
it('keeps recurring budget start dates and atomically removes overrides', async () => {
  const id = await upsertBudget('account-a', 100, 'recurring:2026-08');
  await upsertBudget('account-a', 50, '2026-09');
  await upsertBudget('account-a', 200, 'recurring:2026-09');
  expect(decodeRecords(remote.records).budgets).toEqual([
    {id, userId: 'account-a', categoryId: '', amount: 200, month: 'recurring:2026-08', budgetType: 'monthly'},
  ]);
});

it('creates, updates, and deletes cloud investment history atomically', async () => {
  const id = await saveInvestment({
    name: 'Index fund',
    type: 'mutual_fund',
    startDate: '2020-01-01',
    reviewDay: 15,
    reminderEnabled: false,
  });
  await saveInvestmentEntry(id, {
    id: 'deposit',
    date: '2020-01-02',
    type: 'contribution',
    amount: 100,
  });
  await saveInvestmentEntry(id, {month: '2020-01', date: '2020-01-15', value: 110});
  expect(decodeRecords(remote.records).investments?.[0]).toMatchObject({
    id,
    userId: 'account-a',
    name: 'Index fund',
    flows: [{id: 'deposit', amount: 100}],
    valuations: [{month: '2020-01', value: 110}],
  });
  await deleteInvestmentEntry(id, 'deposit', false);
  expect(decodeRecords(remote.records).investments?.[0].flows).toEqual([]);
  await deleteInvestment(id);
  expect(decodeRecords(remote.records).investments).toEqual([]);
});

it('adds, renames, and removes investment types without deleting investments', async () => {
  const typeId = await saveInvestmentType('Fixed deposit');
  const investmentId = await saveInvestment({
    name: 'Bank FD',
    type: typeId,
    startDate: '2020-01-01',
    reviewDay: 15,
    reminderEnabled: false,
  });
  await saveInvestmentType('Term deposit', typeId);
  expect(decodeRecords(remote.records).investmentTypeRegistry?.items.find(type => type.id === typeId)?.name).toBe(
    'Term deposit',
  );

  await deleteInvestmentType(typeId);
  const data = decodeRecords(remote.records);
  expect(data.investmentTypeRegistry?.items.some(type => type.id === typeId)).toBe(false);
  expect(data.investments?.find(investment => investment.id === investmentId)?.type).toBeNull();
});

it('accepts an investment with no type', async () => {
  const id = await saveInvestment({
    name: 'Untyped asset',
    type: null,
    startDate: '2020-01-01',
    reviewDay: 1,
    reminderEnabled: false,
  });
  expect(decodeRecords(remote.records).investments?.find(investment => investment.id === id)?.type).toBeNull();
});
