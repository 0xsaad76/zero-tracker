import {nanoid} from 'nanoid';
import type {BudgetData, BudgetPeriod} from '../watermelondb/services/budgetService';
import {mutateCloudData, readCloudData, requireCloudUser} from './records';

export type {BudgetData, BudgetPeriod};

const MONTHLY_RECURRING_PREFIX = 'recurring:';
const WEEKLY_RECURRING_PREFIX = 'recurring-weekly:';

export const upsertBudget = async (
  userId: string,
  amount: number,
  month: string,
  budgetType: BudgetPeriod = 'monthly',
  categoryId: string = '',
): Promise<string> => {
  const uid = requireCloudUser(userId);
  if (!userId || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('A spending limit requires a user and a positive, finite amount.');
  }
  const validPeriod =
    budgetType === 'monthly'
      ? /^(recurring:)?\d{4}-(0[1-9]|1[0-2])$/.test(month)
      : budgetType === 'weekly' && /^recurring-weekly:\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(month);
  if (!validPeriod) {
    throw new Error('Invalid spending limit period.');
  }
  const id = nanoid(24);
  const isMonthlyRecurring = budgetType === 'monthly' && month.startsWith(MONTHLY_RECURRING_PREFIX);
  const isWeeklyRecurring = budgetType === 'weekly' && month.startsWith(WEEKLY_RECURRING_PREFIX);
  return mutateCloudData(draft => {
    requireCloudUser(uid);
    if (categoryId && !draft.categories.some(category => category.id === categoryId && category.userId === uid)) {
      throw new Error(`Category not found for the signed-in user: ${categoryId}`);
    }
    const sameScope = (budget: BudgetData): boolean =>
      budget.userId === uid && (budget.categoryId ?? '') === categoryId;
    const matching = draft.budgets.filter(
      budget =>
        sameScope(budget) &&
        budget.budgetType === budgetType &&
        (isMonthlyRecurring
          ? budget.month === 'recurring' || budget.month.startsWith(MONTHLY_RECURRING_PREFIX)
          : isWeeklyRecurring
            ? budget.month.startsWith(WEEKLY_RECURRING_PREFIX)
            : budget.month === month),
    );
    const existing = matching.filter(budget => !(isMonthlyRecurring || isWeeklyRecurring) || budget.month <= month);
    existing.sort((a, b) => b.month.localeCompare(a.month));
    let budgetId: string;
    if (existing.length > 0) {
      const budget = existing[0];
      budget.amount = amount;
      budget.month = (isMonthlyRecurring || isWeeklyRecurring) && budget.month < month ? budget.month : month;
      budgetId = budget.id;
    } else {
      draft.budgets.push({id, userId: uid, categoryId, amount, month, budgetType});
      budgetId = id;
    }
    if (isMonthlyRecurring) {
      const overrideMonth = month.slice(MONTHLY_RECURRING_PREFIX.length);
      draft.budgets = draft.budgets.filter(
        budget => !(sameScope(budget) && budget.budgetType === 'monthly' && budget.month === overrideMonth),
      );
    }
    return budgetId;
  });
};

export const deleteBudget = async (budgetId: string): Promise<void> => {
  const uid = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(uid);
    const index = draft.budgets.findIndex(budget => budget.id === budgetId && budget.userId === uid);
    if (index === -1) {
      throw new Error(`Spending limit not found for the signed-in user: ${budgetId}`);
    }
    draft.budgets.splice(index, 1);
  });
};

export const getBudgetsByMonth = async (userId: string, yearMonth: string): Promise<BudgetData[]> => {
  const uid = requireCloudUser(userId);
  const data = await readCloudData();
  requireCloudUser(uid);
  return data.budgets
    .filter(budget => {
      if (budget.userId !== uid) {
        return false;
      }
      if (budget.budgetType === 'weekly') {
        if (!budget.month.startsWith(WEEKLY_RECURRING_PREFIX)) {
          return false;
        }
        const startMonth = budget.month.slice(WEEKLY_RECURRING_PREFIX.length, WEEKLY_RECURRING_PREFIX.length + 7);
        return yearMonth >= startMonth;
      }
      if (budget.budgetType !== 'monthly') {
        return false;
      }
      if (budget.month === yearMonth || budget.month === 'recurring') {
        return true;
      }
      if (!budget.month.startsWith(MONTHLY_RECURRING_PREFIX)) {
        return false;
      }
      return yearMonth >= budget.month.slice(MONTHLY_RECURRING_PREFIX.length);
    })
    .map(budget => ({...budget, categoryId: budget.categoryId ?? ''}));
};
