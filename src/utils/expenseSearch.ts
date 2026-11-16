export interface SearchableExpense {
  id: string;
  title: string;
  description?: string;
  amount: number;
  date: string;
  categoryId: string;
  categoryName: string;
}

export interface ExpenseSearchFilter {
  query: string;
  /** A category id, or null for every category. */
  categoryId: string | null;
}

const normalize = (value: string) => value.toLocaleLowerCase().trim();

/**
 * Every word must match somewhere: title, note, category, date (YYYY-MM-DD)
 * or amount. Amount words match as a prefix of the plain number, so "45"
 * finds 45, 450 and 45.5 without separators or currency symbols getting in
 * the way ("1,200" is read as 1200).
 */
export function searchExpenses<T extends SearchableExpense>(expenses: T[], filter: ExpenseSearchFilter): T[] {
  const words = normalize(filter.query).split(/\s+/).filter(Boolean);
  const matches = expenses.filter(expense => {
    if (filter.categoryId && expense.categoryId !== filter.categoryId) return false;
    if (!words.length) return true;
    const text = normalize(`${expense.title} ${expense.description ?? ''} ${expense.categoryName}`);
    const amount = String(expense.amount);
    const day = expense.date.slice(0, 10);
    return words.every(word => {
      if (text.includes(word) || day.includes(word)) return true;
      const numeric = word.replace(/,/g, '');
      return /^\d+(\.\d*)?$/.test(numeric) && amount.startsWith(numeric);
    });
  });
  return matches.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export const searchTotal = (expenses: Pick<SearchableExpense, 'amount'>[]): number =>
  expenses.reduce((sum, expense) => sum + Math.round(expense.amount * 100), 0) / 100;
