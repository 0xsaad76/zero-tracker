import {formatDate, parseDate, type DateInput} from './dateUtils';
import {weekStartOffset, type WeekStartDay} from './weekStart';

export interface WeekDateRange {
  startDate: string;
  endDate: string;
}

export const getWeekDateRange = (anchorDate: DateInput, weekStart: WeekStartDay): WeekDateRange => {
  const anchor = parseDate(anchorDate).startOf('day');
  const daysFromStart = (anchor.day() - weekStartOffset(weekStart) + 7) % 7;
  const start = anchor.subtract(daysFromStart, 'day');
  return {
    startDate: formatDate(start, 'YYYY-MM-DD'),
    endDate: formatDate(start.add(6, 'day'), 'YYYY-MM-DD'),
  };
};

export const getWeeklyRecurringKey = (anchorDate: DateInput, weekStart: WeekStartDay): string =>
  `recurring-weekly:${getWeekDateRange(anchorDate, weekStart).startDate}`;

export const sumAmounts = (items: Array<{amount: number}>): number =>
  items.reduce((total, item) => total + item.amount, 0);

export const sumAmountsByCategory = (items: Array<{amount: number; categoryId: string}>): Map<string, number> => {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amount);
  }
  return totals;
};
