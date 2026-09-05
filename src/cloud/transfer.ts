import {nanoid} from 'nanoid';
import {buildImportPlan} from '../backend/import/planner';
import type {ExportData} from '../backend/export/format';
import type {ImportResult} from '../watermelondb/services/importService';
import {mutateCloudData, readCloudData, requireCloudUser, type CloudData} from './records';
import {getBackupPreferences, restoreBackupPreferences} from '../utils/backupPreferences';
import {investmentBackupSchema, investmentTypeRegistrySchema, resolveInvestmentTypes} from '../investments/model';

export async function getAllData(): Promise<ExportData> {
  const d = await readCloudData();
  const categories = new Map(d.categories.map(c => [c.id, c.name]));
  const debtors = new Map(d.debtors.map(c => [c.id, c.title]));
  return {
    users: d.users.map(({username, email}) => ({username, email})),
    categories: d.categories.map(({name, categoryStatus, icon, color}) => ({name, categoryStatus, icon, color})),
    currencies: d.currencies.map(({name, code, symbol}) => ({name, code, symbol})),
    expenses: d.expenses.map(({title, amount, description, date, categoryId}) => ({
      title,
      amount,
      description: description ?? '',
      date,
      category: {name: categories.get(categoryId) ?? 'Unknown'},
    })),
    debtors: d.debtors.map(({title, type, debtorStatus, icon, color}) => ({title, type, debtorStatus, icon, color})),
    debts: d.debts.map(({amount, description, debtorId, date, type}) => ({
      amount,
      description,
      date,
      type,
      debtor: {title: debtors.get(debtorId) ?? 'Unknown'},
    })),
    budgets: d.budgets.map(({amount, month, budgetType, categoryId}) => ({
      amount,
      month,
      budgetType,
      category: categoryId ? {name: categories.get(categoryId) ?? 'Unknown'} : undefined,
    })),
    preferences: d.preferences ?? getBackupPreferences(),
    investments: (d.investments ?? []).map(({userId: _owner, ...investment}) => investment),
    investmentTypes: resolveInvestmentTypes(d.investmentTypeRegistry),
  };
}

export async function importAllData(data: ExportData): Promise<ImportResult> {
  const userId = requireCloudUser();
  if ((data.investments ?? []).filter(investment => investment.reminderEnabled).length > 100) {
    throw new Error('This backup has more than 100 enabled investment reminders. Disable some before importing.');
  }
  const plan = buildImportPlan(data);
  const categories = plan.categories.map(c => ({
    id: nanoid(24),
    userId,
    name: c.name,
    categoryStatus: c.status,
    icon: c.icon,
    color: c.color,
  }));
  const debtors = plan.debtors.map(d => ({
    id: nanoid(24),
    userId,
    title: d.title,
    type: d.type,
    debtorStatus: d.status,
    icon: d.icon,
    color: d.color,
  }));
  const categoryId = (name: string) => categories.find(c => c.name === name)!.id;
  const debtorId = (title: string) => debtors.find(d => d.title === title)!.id;
  const imported: Omit<CloudData, 'users'> = {
    ...(data.investments
      ? {investments: data.investments.map(i => ({...investmentBackupSchema.parse(i), id: nanoid(24), userId}))}
      : {}),
    categories,
    debtors,
    currencies: plan.currencies.slice(0, 1).map(c => ({...c, id: userId, userId})),
    expenses: plan.expenses.map(e => ({
      id: nanoid(24),
      userId,
      title: e.title,
      amount: e.amount,
      description: e.description,
      date: e.date,
      categoryId: categoryId(e.categoryName),
    })),
    debts: plan.debts.map(d => ({
      id: nanoid(24),
      userId,
      amount: d.amount,
      description: d.description,
      date: d.date,
      type: d.type,
      debtorId: debtorId(d.debtorTitle),
    })),
    budgets: plan.budgets.map(b => ({
      id: nanoid(24),
      userId,
      amount: b.amount,
      month: b.month,
      budgetType: b.budgetType as 'monthly' | 'weekly',
      categoryId: b.categoryName ? categoryId(b.categoryName) : '',
    })),
    ...(data.preferences ? {preferences: data.preferences} : {}),
    ...(data.investmentTypes !== undefined
      ? {
          investmentTypeRegistry: investmentTypeRegistrySchema.parse({
            id: 'registry',
            userId,
            items: data.investmentTypes,
          }),
        }
      : {}),
  };
  // Backup restore is one server transaction. Authentication identity never comes from a file.
  await mutateCloudData(draft => {
    Object.assign(draft, imported);
  });
  restoreBackupPreferences(data.preferences);
  return {userId, stats: plan.stats};
}

export async function deleteAllData(): Promise<void> {
  await mutateCloudData(draft => {
    draft.categories = [];
    draft.expenses = [];
    draft.debtors = [];
    draft.debts = [];
    draft.budgets = [];
    draft.currencies = [];
    draft.investments = [];
    draft.investmentTypeRegistry = undefined;
    // Retain Google identity and migration receipts; deleting data is not deleting the account.
  });
}

export type {ExportData, ImportResult};
