import {nanoid} from 'nanoid';
import {DEFAULTS, sanitizeString} from '../backend/sanitize';
import {formatDate, parseDate} from '../utils/dateUtils';
import type {CategoryData} from '../watermelondb/services/categoryService';
import type {CurrencyData} from '../watermelondb/services/currencyService';
import type {DebtData} from '../watermelondb/services/debtService';
import type {DebtorData} from '../watermelondb/services/debtorService';
import type {ExpenseData, ExpenseWithCategory} from '../watermelondb/services/expenseService';
import {mutateCloudData, readCloudData, requireCloudUser} from './records';

export type {CategoryData, CurrencyData, DebtData, DebtorData, ExpenseData, ExpenseWithCategory};
export type UserData = {id: string; username: string; email: string};

/** First-run defaults are one batch, so retrying an interrupted setup is safe. */
export async function createDefaultCategories(
  userId: string,
  categories: {name: string; icon?: string; color?: string}[],
): Promise<void> {
  const uid = requireCloudUser(userId);
  const prepared = categories.map(c => ({
    id: nanoid(24),
    name: c.name,
    icon: sanitizeString(c.icon, DEFAULTS.icon),
    color: sanitizeString(c.color, DEFAULTS.color),
    categoryStatus: true,
    userId: uid,
  }));
  await mutateCloudData(draft => {
    for (const category of prepared) {
      if (!draft.categories.some(c => c.name === category.name && c.userId === uid)) draft.categories.push(category);
    }
  });
}

const requireOwned = <T extends {id: string; userId: string}>(
  rows: T[],
  id: string,
  userId: string,
  label: string,
): T => {
  const row = rows.find(item => item.id === id && item.userId === userId);
  if (!row) {
    throw new Error(`${label} not found for the signed-in user: ${id}`);
  }
  return row;
};

const validateAmount = (amount: number): void => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive, finite number.');
  }
};

const readForUser = async (userId: string) => {
  requireCloudUser(userId);
  const data = await readCloudData();
  requireCloudUser(userId);
  return data;
};

const mapDebtor = (debtor: DebtorData): DebtorData => ({
  ...debtor,
  icon: sanitizeString(debtor.icon, DEFAULTS.icon),
  color: sanitizeString(debtor.color, DEFAULTS.color),
});

export const createUser = async (username: string, email: string): Promise<string> => {
  const uid = requireCloudUser();
  return mutateCloudData(draft => {
    requireCloudUser(uid);
    draft.users = draft.users.filter(user => user.id !== uid);
    draft.users.push({id: uid, username, email: email || ''});
    return uid;
  });
};

export const updateUserById = async (userId: string, updates: {username?: string; email?: string}): Promise<void> => {
  const uid = requireCloudUser(userId);
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const user = draft.users.find(row => row.id === uid);
    if (!user) {
      throw new Error(`User profile not found: ${uid}`);
    }
    if (updates.username !== undefined) {
      user.username = updates.username;
    }
    if (updates.email !== undefined) {
      user.email = updates.email;
    }
  });
};

export const getAllUsers = async (): Promise<UserData[]> => {
  const uid = requireCloudUser();
  const data = await readForUser(uid);
  const user = data.users.find(row => row.id === uid);
  return user ? [{...user}] : [];
};

export const createCategory = async (
  name: string,
  userId: string,
  icon: string | null,
  color: string | null,
): Promise<string> => {
  const uid = requireCloudUser(userId);
  const id = nanoid(24);
  return mutateCloudData(draft => {
    requireCloudUser(uid);
    draft.categories.push({
      id,
      name,
      categoryStatus: true,
      userId: uid,
      icon: sanitizeString(icon, DEFAULTS.icon),
      color: sanitizeString(color, DEFAULTS.color),
    });
    return id;
  });
};

export const softDeleteCategoryById = async (categoryId: string): Promise<void> => {
  const uid = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    requireOwned(draft.categories, categoryId, uid, 'Category').categoryStatus = false;
  });
};

export const updateCategoryById = async (
  categoryId: string,
  newName?: string,
  newIcon?: string,
  newColor?: string,
): Promise<void> => {
  const uid = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const category = requireOwned(draft.categories, categoryId, uid, 'Category');
    if (newName !== undefined) {
      category.name = newName;
    }
    if (newIcon !== undefined) {
      category.icon = sanitizeString(newIcon, DEFAULTS.icon);
    }
    if (newColor !== undefined) {
      category.color = sanitizeString(newColor, DEFAULTS.color);
    }
  });
};

export const getAllCategoriesByUserId = async (userId: string): Promise<CategoryData[]> => {
  const uid = requireCloudUser(userId);
  const data = await readForUser(uid);
  return data.categories
    .filter(row => row.userId === uid)
    .map(category => ({
      ...category,
      icon: sanitizeString(category.icon, DEFAULTS.icon),
      color: sanitizeString(category.color, DEFAULTS.color),
    }));
};

export const createExpense = async (
  userId: string,
  title: string,
  amount: number,
  description: string,
  categoryId: string,
  date: string,
): Promise<string> => {
  const uid = requireCloudUser(userId);
  validateAmount(amount);
  const id = nanoid(24);
  return mutateCloudData(draft => {
    requireCloudUser(uid);
    if (categoryId) {
      requireOwned(draft.categories, categoryId, uid, 'Category');
    }
    draft.expenses.push({id, userId: uid, title, amount, description: description || '', categoryId, date});
    return id;
  });
};

export const updateExpenseById = async (
  expenseId: string,
  categoryId?: string,
  newTitle?: string,
  newAmount?: number,
  newDescription?: string,
  newDate?: string,
): Promise<void> => {
  const uid = requireCloudUser();
  if (newAmount !== undefined) {
    validateAmount(newAmount);
  }
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const expense = requireOwned(draft.expenses, expenseId, uid, 'Expense');
    if (categoryId) {
      requireOwned(draft.categories, categoryId, uid, 'Category');
    }
    if (categoryId !== undefined) {
      expense.categoryId = categoryId;
    }
    if (newTitle !== undefined) {
      expense.title = newTitle;
    }
    if (newAmount !== undefined) {
      expense.amount = newAmount;
    }
    if (newDescription !== undefined) {
      expense.description = newDescription;
    }
    if (newDate !== undefined) {
      expense.date = newDate;
    }
  });
};

export const deleteExpenseById = async (expenseId: string): Promise<void> => {
  const uid = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const expense = requireOwned(draft.expenses, expenseId, uid, 'Expense');
    draft.expenses.splice(draft.expenses.indexOf(expense), 1);
  });
};

export const getAllExpensesByUserId = async (userId: string): Promise<ExpenseData[]> => {
  const uid = requireCloudUser(userId);
  const data = await readForUser(uid);
  return data.expenses
    .filter(row => row.userId === uid)
    .map(expense => ({
      ...expense,
      description: expense.description ?? '',
    }));
};

const getExpensesWithCategory = async (
  userId: string,
  matches: (expense: ExpenseData) => boolean,
): Promise<ExpenseWithCategory[]> => {
  const data = await readForUser(userId);
  const categories = new Map(
    data.categories
      .filter(row => row.userId === userId)
      .map(category => [
        category.id,
        {id: category.id, name: category.name, icon: category.icon ?? '', color: category.color ?? '#808080'},
      ]),
  );
  return data.expenses
    .filter(row => row.userId === userId && matches(row))
    .map(expense => ({
      ...expense,
      description: expense.description ?? '',
      category: categories.get(expense.categoryId),
    }));
};

export const getAllExpensesByUserIdWithCategory = async (userId: string): Promise<ExpenseWithCategory[]> => {
  return getExpensesWithCategory(requireCloudUser(userId), () => true);
};

export const getAllExpensesByDate = async (userId: string, targetDate: string): Promise<ExpenseWithCategory[]> => {
  return getExpensesWithCategory(requireCloudUser(userId), expense => expense.date.startsWith(targetDate));
};

export const getAllExpensesByDateRange = async (
  userId: string,
  startDate: string,
  endDate: string,
): Promise<ExpenseWithCategory[]> => {
  const uid = requireCloudUser(userId);
  const endExclusive = formatDate(parseDate(endDate).add(1, 'day'), 'YYYY-MM-DD');
  return getExpensesWithCategory(uid, expense => expense.date >= startDate && expense.date < endExclusive);
};

export const getAllExpensesByMonth = async (userId: string, yearMonth: string): Promise<ExpenseWithCategory[]> => {
  return getExpensesWithCategory(requireCloudUser(userId), expense => expense.date.startsWith(yearMonth));
};

export const getAllExpensesByCategoryAndMonth = async (
  userId: string,
  categoryId: string,
  yearMonth: string,
): Promise<ExpenseWithCategory[]> => {
  return getExpensesWithCategory(
    requireCloudUser(userId),
    expense => expense.categoryId === categoryId && expense.date.startsWith(yearMonth),
  );
};

export const getAvailableExpenseYears = async (userId: string): Promise<number[]> => {
  const uid = requireCloudUser(userId);
  const data = await readForUser(uid);
  const years = new Set<number>();
  for (const expense of data.expenses) {
    if (expense.userId === uid && expense.date) {
      const year = Number.parseInt(expense.date.substring(0, 4), 10);
      if (!Number.isNaN(year)) {
        years.add(year);
      }
    }
  }
  return Array.from(years).sort((a, b) => a - b);
};

export const createCurrency = async (code: string, symbol: string, name: string, userId: string): Promise<string> => {
  const uid = requireCloudUser(userId);
  return mutateCloudData(draft => {
    requireCloudUser(uid);
    draft.currencies = draft.currencies.filter(row => row.userId !== uid);
    draft.currencies.push({id: uid, userId: uid, code, symbol, name});
    return uid;
  });
};

export const updateCurrencyById = async (
  currencyId: string,
  updates: {code?: string; symbol?: string; name?: string},
): Promise<void> => {
  const uid = requireCloudUser(currencyId);
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const currency = requireOwned(draft.currencies, currencyId, uid, 'Currency');
    if (updates.code !== undefined) {
      currency.code = updates.code;
    }
    if (updates.symbol !== undefined) {
      currency.symbol = updates.symbol;
    }
    if (updates.name !== undefined) {
      currency.name = updates.name;
    }
  });
};

export const getCurrencyByUserId = async (userId: string): Promise<CurrencyData | null> => {
  const uid = requireCloudUser(userId);
  const data = await readForUser(uid);
  const currency = data.currencies.find(row => row.userId === uid && row.id === uid);
  return currency ? {...currency} : null;
};

export const createDebtor = async (
  title: string,
  userId: string,
  icon: string | null,
  type: string,
  color: string | null,
): Promise<string> => {
  const uid = requireCloudUser(userId);
  const id = nanoid(24);
  return mutateCloudData(draft => {
    requireCloudUser(uid);
    draft.debtors.push({
      id,
      title,
      type,
      debtorStatus: true,
      userId: uid,
      icon: sanitizeString(icon, DEFAULTS.icon),
      color: sanitizeString(color, DEFAULTS.color),
    });
    return id;
  });
};

export const deleteDebtorById = async (debtorId: string): Promise<void> => {
  const uid = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const debtor = requireOwned(draft.debtors, debtorId, uid, 'Debtor');
    draft.debts = draft.debts.filter(row => row.userId !== uid || row.debtorId !== debtorId);
    draft.debtors.splice(draft.debtors.indexOf(debtor), 1);
  });
};

export const updateDebtorById = async (
  debtorId: string,
  newTitle?: string,
  newType?: string,
  newIcon?: string,
  newColor?: string,
): Promise<void> => {
  const uid = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const debtor = requireOwned(draft.debtors, debtorId, uid, 'Debtor');
    if (newTitle !== undefined) {
      debtor.title = newTitle;
    }
    if (newType !== undefined) {
      debtor.type = newType;
    }
    if (newIcon !== undefined) {
      debtor.icon = sanitizeString(newIcon, DEFAULTS.icon);
    }
    if (newColor !== undefined) {
      debtor.color = sanitizeString(newColor, DEFAULTS.color);
    }
  });
};

export const getAllDebtorsByUserId = async (userId: string): Promise<DebtorData[]> => {
  const uid = requireCloudUser(userId);
  const data = await readForUser(uid);
  return data.debtors.filter(row => row.userId === uid).map(mapDebtor);
};

export const getDebtorByDebtorId = async (debtorId: string): Promise<DebtorData | null> => {
  const uid = requireCloudUser();
  const data = await readForUser(uid);
  const debtor = data.debtors.find(row => row.userId === uid && row.id === debtorId);
  return debtor ? mapDebtor(debtor) : null;
};

export const createDebt = async (
  userId: string,
  amount: number,
  description: string,
  debtorId: string,
  date: string,
  type: string,
): Promise<string> => {
  const uid = requireCloudUser(userId);
  validateAmount(amount);
  const id = nanoid(24);
  return mutateCloudData(draft => {
    requireCloudUser(uid);
    requireOwned(draft.debtors, debtorId, uid, 'Debtor');
    draft.debts.push({id, userId: uid, amount, description, debtorId, date, type});
    return id;
  });
};

export const updateDebtById = async (
  debtId: string,
  newAmount?: number,
  newDescription?: string,
  newDate?: string,
  newType?: string,
): Promise<void> => {
  const uid = requireCloudUser();
  if (newAmount !== undefined) {
    validateAmount(newAmount);
  }
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const debt = requireOwned(draft.debts, debtId, uid, 'Debt');
    if (newAmount !== undefined) {
      debt.amount = newAmount;
    }
    if (newDescription !== undefined) {
      debt.description = newDescription;
    }
    if (newDate !== undefined) {
      debt.date = newDate;
    }
    if (newType !== undefined) {
      debt.type = newType;
    }
  });
};

export const deleteDebtById = async (debtId: string): Promise<void> => {
  const uid = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const debt = requireOwned(draft.debts, debtId, uid, 'Debt');
    draft.debts.splice(draft.debts.indexOf(debt), 1);
  });
};

export const deleteAllDebtsByDebtorId = async (debtorId: string): Promise<void> => {
  const uid = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    requireOwned(draft.debtors, debtorId, uid, 'Debtor');
    draft.debts = draft.debts.filter(row => row.userId !== uid || row.debtorId !== debtorId);
  });
};

export const getAllDebtsByUserId = async (userId: string): Promise<DebtData[]> => {
  const uid = requireCloudUser(userId);
  const data = await readForUser(uid);
  return data.debts.filter(row => row.userId === uid).map(debt => ({...debt}));
};

export const getAllDebtsByUserIdAndDebtorId = async (userId: string, debtorId: string): Promise<DebtData[]> => {
  const uid = requireCloudUser(userId);
  const data = await readForUser(uid);
  return data.debts.filter(row => row.userId === uid && row.debtorId === debtorId).map(debt => ({...debt}));
};
