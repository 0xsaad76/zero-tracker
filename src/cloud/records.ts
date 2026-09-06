import {supabase} from './client';
import type {CategoryData, ExpenseData, CurrencyData, DebtorData, DebtData, BudgetData} from '../watermelondb/services';
import type {ExportData} from '../backend/export/format';
import {
  investmentBackupSchema,
  investmentTypeRegistrySchema,
  type Investment,
  type InvestmentTypeRegistry,
} from '../investments/model';
import {
  tradeBackupSchema,
  tradingBalanceRegistrySchema,
  tradingPairRegistrySchema,
  tradingStrategyRegistrySchema,
  type Trade,
  type TradingBalanceRegistry,
  type TradingPairRegistry,
  type TradingStrategyRegistry,
} from '../trading/model';
import {clearInvestmentReminders, syncInvestmentReminderData} from '../investments/reminders';

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
  investmentTypeRegistry?: InvestmentTypeRegistry;
  trades?: Trade[];
  tradingStrategyRegistry?: TradingStrategyRegistry;
  tradingPairRegistry?: TradingPairRegistry;
  tradingBalanceRegistry?: TradingBalanceRegistry;
}
const collections = [
  'users',
  'categories',
  'expenses',
  'currencies',
  'debtors',
  'debts',
  'budgets',
  'investments',
  'trades',
] as const;
type RecordKind =
  | (typeof collections)[number]
  | 'settings'
  | 'investment_types'
  | 'trading_strategies'
  | 'trading_pairs'
  | 'trading_balances';
const recognizedKinds: RecordKind[] = [
  ...collections,
  'settings',
  'investment_types',
  'trading_strategies',
  'trading_pairs',
  'trading_balances',
];
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
let recentRead: {epoch: number; snapshot: Snapshot; expiresAt: number} | null = null;
const controllers = new Set<AbortController>();
const RECENT_READ_MS = 1500;

// Read protocol negotiation. New record kinds ship with a new zero_read_vN
// RPC, but the live database may not have the migration yet (migrations are
// applied by the owner, not by the app). Reads transparently fall back to the
// newest RPC the server actually has, so the app keeps working instead of
// landing on the retry screen. Writes of unknown kinds still fail at the
// server CHECK constraint; trading mutations guard on cloudProtocolVersion().
const READ_RPCS = ['zero_read_v4', 'zero_read_v3', 'zero_read_v2'] as const;
let readRpcIndex = 0;

const missingFunction = (error: unknown) =>
  (error as {code?: string} | null)?.code === 'PGRST202' ||
  /could not find the function/i.test((error as Error | null)?.message ?? '');

/** Newest read protocol to use: optimistic v4 before the first read, the confirmed fallback afterwards. */
export function cloudProtocolVersion(): number {
  return readRpcIndex >= READ_RPCS.length ? 0 : 4 - readRpcIndex;
}

/** True once the server confirmed the trading protocol (v4). Optimistic before the first read. */
export function tradingSyncAvailable(): boolean {
  return cloudProtocolVersion() >= 4;
}

export function setCloudUser(userId: string | null) {
  if (activeUserId === userId) {
    // On a cold signed-out start activeUserId is already null, but persisted
    // alarms from a previously killed process must still be removed.
    if (userId === null) void clearInvestmentReminders().catch(() => {});
    return;
  }
  epoch++;
  activeUserId = userId;
  pendingRead = null;
  recentRead = null;
  readRpcIndex = 0;
  for (const controller of controllers) controller.abort();
  controllers.clear();
  // Account switches must never retain the previous account's reminder IDs.
  void clearInvestmentReminders().catch(() => {});
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
    if (error) {
      const failure = new Error('Could not reach your cloud data. Check your connection and try again.') as Error & {
        code?: string;
      };
      failure.code = (error as {code?: string} | null)?.code;
      throw failure;
    }
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
  trades: [],
});

export function decodeRecords(records: CloudRecord[]): CloudData {
  const result = emptyCloudData();
  // Isolate nested preferences/receipt arrays too: mutations must not alter
  // the baseline used to decide what needs to be sent to the server.
  for (const record of JSON.parse(JSON.stringify(records)) as CloudRecord[]) {
    if (record.kind === 'settings') {
      result.preferences = record.data.preferences as CloudData['preferences'];
      result.legacyImports = record.data.legacyImports as string[] | undefined;
    } else if (record.kind === 'investment_types') {
      result.investmentTypeRegistry = investmentTypeRegistrySchema.parse({...record.data, id: record.id});
    } else if (record.kind === 'trading_strategies') {
      result.tradingStrategyRegistry = tradingStrategyRegistrySchema.parse({...record.data, id: record.id});
    } else if (record.kind === 'trading_pairs') {
      result.tradingPairRegistry = tradingPairRegistrySchema.parse({...record.data, id: record.id});
    } else if (record.kind === 'trading_balances') {
      result.tradingBalanceRegistry = tradingBalanceRegistrySchema.parse({...record.data, id: record.id});
    } else if (record.kind === 'trades') {
      result.trades!.push({
        ...tradeBackupSchema.parse({...record.data, id: record.id}),
        userId: String(record.data.userId),
      });
    } else if (record.kind === 'investments') {
      result.investments!.push({
        ...investmentBackupSchema.parse({...record.data, id: record.id}),
        userId: String(record.data.userId),
      });
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
  if (data.investmentTypeRegistry) {
    const registry = investmentTypeRegistrySchema.parse(data.investmentTypeRegistry);
    records.push({kind: 'investment_types', id: 'registry', data: {...registry}});
  }
  if (data.tradingStrategyRegistry) {
    const registry = tradingStrategyRegistrySchema.parse(data.tradingStrategyRegistry);
    records.push({kind: 'trading_strategies', id: 'registry', data: {...registry}});
  }
  if (data.tradingPairRegistry) {
    const registry = tradingPairRegistrySchema.parse(data.tradingPairRegistry);
    records.push({kind: 'trading_pairs', id: 'registry', data: {...registry}});
  }
  if (data.tradingBalanceRegistry) {
    const registry = tradingBalanceRegistrySchema.parse(data.tradingBalanceRegistry);
    records.push({kind: 'trading_balances', id: 'registry', data: {...registry}});
  }
  return records;
}

async function readSnapshot(owner: string, generation: number, allowRecent = false): Promise<Snapshot> {
  // Keep one just-fetched snapshot in RAM briefly so auth bootstrap and the
  // first screen do not issue the same request several times. Nothing is
  // persisted on the device, and mutations always request a fresh revision.
  if (allowRecent && recentRead?.epoch === generation && recentRead.expiresAt > Date.now()) {
    return recentRead.snapshot;
  }
  if (pendingRead?.epoch === generation) return pendingRead.promise;
  const promise = (async () => {
    for (;;) {
      try {
        return await rpc<Snapshot>(READ_RPCS[readRpcIndex], {}, owner, generation);
      } catch (error) {
        if (readRpcIndex + 1 < READ_RPCS.length && missingFunction(error)) {
          readRpcIndex++;
          continue;
        }
        throw error;
      }
    }
  })();
  pendingRead = {epoch: generation, promise};
  try {
    const snapshot = await promise;
    recentRead = {epoch: generation, snapshot, expiresAt: Date.now() + RECENT_READ_MS};
    return snapshot;
  } finally {
    if (pendingRead?.promise === promise) pendingRead = null;
  }
}

export async function readCloudData(): Promise<CloudData> {
  const owner = requireCloudUser();
  const generation = epoch;
  const data = decodeRecords((await readSnapshot(owner, generation, true)).records);
  assertSession(owner, generation);
  void syncInvestmentReminderData(data.investments ?? []).catch(() => {});
  return data;
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
      const deletes = before.records
        .filter(r => recognizedKinds.includes(r.kind) && !current.has(key(r)))
        .map(({kind, id}) => ({kind, id}));
      if (!upserts.length && !deletes.length) {
        void syncInvestmentReminderData(draft.investments ?? []).catch(() => {});
        return result;
      }
      const saved = await rpc<boolean>(
        'zero_write',
        {expected_revision: before.revision, upserts, deletes},
        owner,
        generation,
      );
      pendingRead = null;
      recentRead = null;
      if (saved) {
        void syncInvestmentReminderData(draft.investments ?? []).catch(() => {});
        return result;
      }
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
