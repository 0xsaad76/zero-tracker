import {supabase} from './client';
import type {CategoryData, ExpenseData, CurrencyData, DebtorData, DebtData, BudgetData} from '../watermelondb/services';
import type {ExportData} from '../backend/export/format';
import {investmentBackupSchema, type Investment} from '../investments/model';

export interface CloudData {
  users: {id: string; username: string; email: string}[];
  categories: CategoryData[];
  expenses: ExpenseData[];
  currencies: CurrencyData[];
  debtors: DebtorData[];
  debts: DebtData[];
  budgets: BudgetData[];
  preferences?: ExportData['preferences'];
  legacyImports?: string[];
  investments?: Investment[];
}
const collections = ['users', 'categories', 'expenses', 'currencies', 'debtors', 'debts', 'budgets', 'investments'] as const;
type RecordKind = (typeof collections)[number] | 'settings';
export interface CloudRecord {
  kind: RecordKind;
  id: string;
  data: Record<string, unknown>;
}
interface Snapshot {
  revision: number;
  records: CloudRecord[];
}

let activeUserId: string | null = null;
let epoch = 0;
let writeQueue: Promise<unknown> = Promise.resolve();
let pendingRead: {epoch: number; promise: Promise<Snapshot>} | null = null;
const controllers = new Set<AbortController>();

export function setCloudUser(userId: string | null) {
  if (activeUserId === userId) return;
  epoch++;
  activeUserId = userId;
  pendingRead = null;
  for (const controller of controllers) controller.abort();
  controllers.clear();
}

export function requireCloudUser(userId?: string): string {
  if (!activeUserId || (userId !== undefined && userId !== activeUserId)) {
    throw new Error('Please sign in to access your account.');
  }
  return activeUserId;
}

function assertSession(owner: string, generation: number) {
  if (owner !== activeUserId || generation !== epoch) throw new Error('Your account changed. Please try again.');
}

async function rpc<T>(name: string, args: Record<string, unknown>, owner: string, generation: number): Promise<T> {
  assertSession(owner, generation);
  const controller = new AbortController();
  controllers.add(controller);
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    // Resolve credentials BEFORE dispatch, then recheck the account: a refresh or
    // sign-out must not send an old account's mutation with a new account's token.
    const {data: auth, error: authError} = await supabase.auth.getSession();
    assertSession(owner, generation);
    if (authError || auth.session?.user.id !== owner) throw new Error('Please sign in again.');
    const {data, error} = await supabase
      .rpc(name, args, {head: false})
      .setHeader('Authorization', `Bearer ${auth.session.access_token}`)
      .abortSignal(controller.signal);
    assertSession(owner, generation);
    if (error) throw new Error('Could not reach your cloud data. Check your connection and try again.');
    if (data === null) throw new Error('The cloud returned no result. Please try again.');
    return data as T;
  } finally {
    clearTimeout(timer);
    controllers.delete(controller);
  }
}

export const emptyCloudData = (): CloudData => ({
  users: [],
  categories: [],
  expenses: [],
  currencies: [],
  debtors: [],
  debts: [],
  budgets: [],
  investments: [],
});

export function decodeRecords(records: CloudRecord[]): CloudData {
  const result = emptyCloudData();
  // Isolate nested preferences/receipt arrays too: mutations must not alter
  // the baseline used to decide what needs to be sent to the server.
  for (const record of JSON.parse(JSON.stringify(records)) as CloudRecord[]) {
    if (record.kind === 'settings') {
      result.preferences = record.data.preferences as CloudData['preferences'];
      result.legacyImports = record.data.legacyImports as string[] | undefined;
    } else if (record.kind === 'investments') {
      result.investments!.push({...investmentBackupSchema.parse({...record.data, id: record.id}), userId: String(record.data.userId)});
    } else if (collections.includes(record.kind)) {
      // The record envelope is authoritative for the ID.
      (result[record.kind] as Record<string, unknown>[]).push({...record.data, id: record.id});
    }
  }
  return result;
}

export function encodeRecords(data: CloudData): CloudRecord[] {
  const records: CloudRecord[] = [];
  for (const kind of collections) {
    for (const row of data[kind] ?? []) records.push({kind, id: row.id, data: {...row}});
  }
  if (data.preferences || data.legacyImports) {
    records.push({
      kind: 'settings',
      id: 'preferences',
      data: {
        ...(data.preferences ? {preferences: data.preferences} : {}),
        ...(data.legacyImports ? {legacyImports: data.legacyImports} : {}),
      },
    });
  }
  return records;
}

async function readSnapshot(owner: string, generation: number): Promise<Snapshot> {
  // Coalesce concurrent screen queries only, never persist a financial cache.
  if (pendingRead?.epoch === generation) return pendingRead.promise;
  const promise = rpc<Snapshot>('zero_read_v2', {}, owner, generation);
  pendingRead = {epoch: generation, promise};
  try {
    return await promise;
  } finally {
    if (pendingRead?.promise === promise) pendingRead = null;
  }
}

export async function readCloudData(): Promise<CloudData> {
  return decodeRecords((await readSnapshot(requireCloudUser(), epoch)).records);
}

export async function mutateCloudData<T>(mutation: (draft: CloudData) => T): Promise<T> {
  const owner = requireCloudUser();
  const generation = epoch;
  const execute = async () => {
    assertSession(owner, generation);
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await readSnapshot(owner, generation);
      assertSession(owner, generation);
      const draft = decodeRecords(before.records);
      const result = mutation(draft);
      const after = encodeRecords(draft);
      const key = (r: {kind: string; id: string}) => `${r.kind}:${r.id}`;
      const original = new Map(before.records.map(r => [key(r), r]));
      const current = new Set(after.map(key));
      const upserts = after.filter(r => JSON.stringify(original.get(key(r))?.data) !== JSON.stringify(r.data));
      const deletes = before.records.filter(r => (r.kind === 'settings' || collections.includes(r.kind)) && !current.has(key(r))).map(({kind, id}) => ({kind, id}));
      if (!upserts.length && !deletes.length) return result;
      const saved = await rpc<boolean>(
        'zero_write',
        {expected_revision: before.revision, upserts, deletes},
        owner,
        generation,
      );
      pendingRead = null;
      if (saved) return result;
    }
    throw new Error('Your data changed on another device. Please try again.');
  };
  const job = writeQueue.then(execute, execute);
  writeQueue = job.catch(() => {});
  return job;
}

export async function flushCloudWrites(): Promise<void> {
  await writeQueue;
}
