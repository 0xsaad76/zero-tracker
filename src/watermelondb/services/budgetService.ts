import {Q} from '@nozbe/watermelondb';
import {database} from '../database';
import Budget from '../models/Budget';

export interface BudgetData {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  month: string;
  budgetType: BudgetPeriod;
}

export type BudgetPeriod = 'monthly' | 'weekly';

const MONTHLY_RECURRING_PREFIX = 'recurring:';
const WEEKLY_RECURRING_PREFIX = 'recurring-weekly:';

/**
 * Creates or updates one overall or category spending limit.
 *
 * `month` is retained as the persisted period-key column for compatibility.
 * Monthly limits use one of three forms:
 *   - `'2026-07'`             — applies to that month only.
 *   - `'recurring:2026-07'`   — applies to July 2026 and every month after.
 *   - `'recurring'`           — legacy, pre-start-month form; treated as
 *                               "applies to every month". Still read by
 *                               getBudgetsByMonth for backwards compatibility;
 *                               new writes always use the `recurring:` form.
 * Weekly limits use `recurring-weekly:YYYY-MM-DD`, where the date is the
 * first week to which the limit applies.
 *
 * The start-month comparison in getBudgetsByMonth is lexicographic, which is
 * only correct because months are zero-padded `YYYY-MM`. Keep that format.
 */
export const upsertBudget = async (
  userId: string,
  amount: number,
  month: string,
  budgetType: BudgetPeriod = 'monthly',
  categoryId: string = '',
): Promise<string> => {
  if (!userId || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('A spending limit requires a user and a positive, finite amount.');
  }
  const validPeriod =
    budgetType === 'monthly'
      ? /^(recurring:)?\d{4}-(0[1-9]|1[0-2])$/.test(month)
      : /^recurring-weekly:\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(month);
  if (!validPeriod) {
    throw new Error('Invalid spending limit period.');
  }
  let budgetId = '';
  const isMonthlyRecurring = budgetType === 'monthly' && month.startsWith(MONTHLY_RECURRING_PREFIX);
  const isWeeklyRecurring = budgetType === 'weekly' && month.startsWith(WEEKLY_RECURRING_PREFIX);

  await database.write(async () => {
    const periodQuery = isMonthlyRecurring
      ? Q.or(Q.where('month', 'recurring'), Q.where('month', Q.like(`${MONTHLY_RECURRING_PREFIX}%`)))
      : isWeeklyRecurring
        ? Q.where('month', Q.like(`${WEEKLY_RECURRING_PREFIX}%`))
        : Q.where('month', month);

    const matching = await database
      .get<Budget>('budgets')
      .query(
        Q.where('user_id', userId),
        categoryId
          ? Q.where('category_id', categoryId)
          : Q.or(Q.where('category_id', ''), Q.where('category_id', null)),
        periodQuery,
        Q.where('budget_type', budgetType),
      )
      .fetch();

    // Leave future scheduled entries alone when editing an earlier month/week.
    const existing = matching.filter(b => !(isMonthlyRecurring || isWeeklyRecurring) || b.month <= month);
    // Select the latest effective recurring entry if an imported backup has history.
    existing.sort((a, b) => b.month.localeCompare(a.month));
    const overrides = isMonthlyRecurring
      ? await database
          .get<Budget>('budgets')
          .query(
            Q.where('user_id', userId),
            categoryId
              ? Q.where('category_id', categoryId)
              : Q.or(Q.where('category_id', ''), Q.where('category_id', null)),
            Q.where('budget_type', 'monthly'),
            Q.where('month', month.slice(MONTHLY_RECURRING_PREFIX.length)),
          )
          .fetch()
      : [];
    let mutation: Budget;
    if (existing.length > 0) {
      mutation = existing[0].prepareUpdate(b => {
        b.amount = amount;
        // Editing the amount must not make a previously applicable recurring limit disappear.
        b.month = (isMonthlyRecurring || isWeeklyRecurring) && b.month < month ? b.month : month;
      });
    } else {
      mutation = database.get<Budget>('budgets').prepareCreate(b => {
        b.userId = userId;
        b.categoryId = categoryId;
        b.amount = amount;
        b.month = month;
        b.budgetType = budgetType;
      });
    }
    // Changing this month's override to recurring is one atomic database batch.
    await database.batch(mutation, ...overrides.map(b => b.prepareDestroyPermanently()));
    budgetId = mutation.id;
  });
  return budgetId;
};

export const deleteBudget = async (budgetId: string): Promise<void> => {
  await database.write(async () => {
    const budget = await database.get<Budget>('budgets').find(budgetId);
    await budget.destroyPermanently();
  });
};

export const getBudgetsByMonth = async (userId: string, yearMonth: string): Promise<BudgetData[]> => {
  const budgets = await database.get<Budget>('budgets').query(Q.where('user_id', userId)).fetch();

  const filtered = budgets.filter(b => {
    if (b.budgetType === 'weekly') {
      if (!b.month.startsWith(WEEKLY_RECURRING_PREFIX)) {
        return false;
      }
      const startMonth = b.month.slice(WEEKLY_RECURRING_PREFIX.length, WEEKLY_RECURRING_PREFIX.length + 7);
      return yearMonth >= startMonth;
    }
    if (b.budgetType !== 'monthly') {
      return false;
    }
    if (b.month === yearMonth || b.month === 'recurring') {
      return true;
    }
    if (!b.month.startsWith(MONTHLY_RECURRING_PREFIX)) {
      return false;
    }
    const startMonth = b.month.slice(MONTHLY_RECURRING_PREFIX.length);
    return yearMonth >= startMonth;
  });

  return filtered.map(b => ({
    id: b.id,
    userId: b.userId,
    categoryId: b.categoryId ?? '',
    amount: b.amount,
    month: b.month,
    budgetType: b.budgetType as BudgetPeriod,
  }));
};
