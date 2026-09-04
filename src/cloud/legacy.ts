import StorageService from '../utils/asyncStorageService';
import {getBackupPreferences} from '../utils/backupPreferences';
import {readCloudData, mutateCloudData, requireCloudUser, type CloudData} from './records';

const COMPLETE = 'cloudMigrationComplete';
const COLLECTIONS = ['categories', 'expenses', 'debtors', 'debts', 'budgets'] as const;

// This module is the ONLY runtime path to the old database. New installations
// never open SQLite; existing installations use it only for a confirmed move.
export async function readLegacyData(): Promise<CloudData | null> {
  if (StorageService.getBoolean(COMPLETE) || StorageService.getItemSync('isOnboarded') !== 'true') return null;
  const {database} = require('../watermelondb/database') as typeof import('../watermelondb/database');
  const tables = ['users', 'categories', 'expenses', 'currencies', 'debtors', 'debts', 'budgets'] as const;
  const fields: Record<(typeof tables)[number], string[]> = {
    users: ['username', 'email'],
    categories: ['name', 'categoryStatus', 'userId', 'icon', 'color'],
    expenses: ['title', 'amount', 'description', 'categoryId', 'userId', 'date'],
    currencies: ['code', 'symbol', 'name', 'userId'],
    debtors: ['title', 'type', 'debtorStatus', 'userId', 'icon', 'color'],
    debts: ['description', 'amount', 'debtorId', 'userId', 'date', 'type'],
    budgets: ['userId', 'categoryId', 'amount', 'month', 'budgetType'],
  };
  const rows = await database.read(async () =>
    Promise.all(
      tables.map(async table => {
        const records = await database.get(table).query().fetch();
        return [
          table,
          records.map(record => {
            const value: Record<string, unknown> = {id: record.id};
            for (const field of fields[table]) value[field] = (record as unknown as Record<string, unknown>)[field];
            return value;
          }),
        ];
      }),
    ),
  );
  const result = Object.fromEntries(rows) as unknown as CloudData;
  if (!result.users.length && !COLLECTIONS.some(k => result[k].length)) return null;
  result.preferences = getBackupPreferences();
  return result;
}

export async function moveLegacyData(local: CloudData, authenticatedEmail = ''): Promise<void> {
  const userId = requireCloudUser();
  const source = local.users[0]?.id;
  if (!source || local.users.length !== 1)
    throw new Error('The old database has an ambiguous owner. Its records have been left untouched.');
  if (new Set(local.currencies.map(c => c.code)).size > 1)
    throw new Error('The old database has multiple currencies. Its records have been left untouched.');
  const receipt = `sqlite:${source}`;
  const id = (value: string) => `sqlite:${value}`;
  const moved = {
    categories: local.categories.map(r => ({
      ...r,
      id: id(r.id),
      userId,
      icon: r.icon ?? '',
      color: r.color ?? '#808080',
    })),
    expenses: local.expenses.map(r => ({
      ...r,
      id: id(r.id),
      userId,
      categoryId: id(r.categoryId),
      description: r.description ?? '',
    })),
    debtors: local.debtors.map(r => ({...r, id: id(r.id), userId, icon: r.icon ?? '', color: r.color ?? '#808080'})),
    debts: local.debts.map(r => ({...r, id: id(r.id), userId, debtorId: id(r.debtorId)})),
    budgets: local.budgets.map(r => ({...r, id: id(r.id), userId, categoryId: r.categoryId ? id(r.categoryId) : ''})),
  };
  await mutateCloudData(draft => {
    if (draft.currencies.length && local.currencies.length && draft.currencies[0].code !== local.currencies[0].code) {
      throw new Error(
        'This cloud account uses a different currency. Choose the correct account; your device copy has been preserved.',
      );
    }
    if (draft.legacyImports?.includes(receipt)) return;
    if (!draft.users.length)
      draft.users.push({id: userId, username: local.users[0].username, email: authenticatedEmail});
    for (const kind of COLLECTIONS) {
      (draft[kind] as {id: string}[]).push(...moved[kind]);
    }
    if (!draft.currencies.length)
      draft.currencies = local.currencies.slice(0, 1).map(c => ({...c, id: userId, userId}));
    draft.preferences ??= local.preferences;
    draft.legacyImports = [...(draft.legacyImports ?? []), receipt];
  });
  const verified = await readCloudData();
  if (!verified.legacyImports?.includes(receipt))
    throw new Error('Cloud verification failed. The device copy is safe.');
  // Verify each field, not merely IDs: a restored/modified local copy with the
  // same IDs must never be discarded just because an earlier receipt exists.
  for (const kind of COLLECTIONS) {
    const rows = new Map(verified[kind].map(r => [r.id, r]));
    if (
      moved[kind].some(r => {
        const saved = rows.get(r.id) as unknown as Record<string, unknown> | undefined;
        return (
          !saved ||
          Object.entries(r).some(
            ([key, value]) => value !== undefined && JSON.stringify(saved[key]) !== JSON.stringify(value),
          )
        );
      })
    )
      throw new Error(
        'Some cloud records differ from this device. The device copy has been preserved for manual resolution.',
      );
  }
  if (local.currencies.length && local.currencies[0].code !== verified.currencies[0]?.code)
    throw new Error('Currency verification failed. The device copy is safe.');
  requireCloudUser(userId);
  const {database} = require('../watermelondb/database') as typeof import('../watermelondb/database');
  await database.write(async () => {
    requireCloudUser(userId);
    await database.unsafeResetDatabase();
  });
  StorageService.setBoolean(COMPLETE, true);
  StorageService.removeItemSync('isOnboarded');
  for (const key of StorageService.getAllKeys()) {
    if (key.startsWith('available-expense-years') || key === 'driveBackupState' || key === 'error_log')
      StorageService.removeItemSync(key);
  }
}
