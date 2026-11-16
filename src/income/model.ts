import {z} from 'zod';
import {total, validDate} from '../investments/model';

/**
 * Money coming in: salary, freelance, refunds, gifts. Deliberately simple —
 * a source, an amount, a day and an optional note — so a month's income can
 * sit next to its spending and answer "what is left?".
 */
export const incomeBackupSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().trim().min(1, 'Enter where this income came from.').max(80, 'Use 80 characters or fewer.'),
  amount: z
    .number()
    .finite()
    .min(0.01, 'Enter an amount above zero.')
    .max(1e12)
    .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.01, 'Use at most two decimal places.'),
  date: z.string().refine(validDate, 'Enter a valid date (YYYY-MM-DD).'),
  description: z.string().max(200, 'Use 200 characters or fewer.').default(''),
});
export type IncomeBackup = z.infer<typeof incomeBackupSchema>;
export type Income = IncomeBackup & {userId: string};

/** Newest first; ties keep a stable order by id. */
export const sortIncomes = <T extends Pick<Income, 'date' | 'id'>>(incomes: T[]): T[] =>
  [...incomes].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

export const incomesForMonth = <T extends Pick<Income, 'date'>>(incomes: T[], month: string): T[] =>
  incomes.filter(income => income.date.startsWith(month));

export const incomeTotal = (incomes: Pick<Income, 'amount'>[]): number => total(incomes.map(income => income.amount));

export interface MonthBalance {
  income: number;
  spent: number;
  /** Income minus spending. Negative means the month spent more than it earned. */
  left: number;
  /** Share of income kept, 0–100. Null when there is no income to compare against. */
  savedPercent: number | null;
}

export function monthBalance(income: number, spent: number): MonthBalance {
  const left = Math.round((income - spent) * 100) / 100;
  return {
    income,
    spent,
    left,
    savedPercent: income > 0 ? Math.max(0, Math.round((left / income) * 100)) : null,
  };
}
