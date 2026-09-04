import {getAvailableExpenseYears} from '../cloud';

// Session-only; expense-derived information is never written to MMKV.
const cache = new Map<string, number[]>();
let generation = 0;
const withCurrent = (years: number[]) => [...new Set([...years, new Date().getFullYear()])].sort((a, b) => a - b);
export const clearYearsCache = () => {
  generation++;
  cache.clear();
};
export const getCachedYears = (userId: string): number[] => withCurrent(cache.get(userId) ?? []);
export const ensureYearInCache = (userId: string, year: number): number[] => {
  const years = withCurrent([...getCachedYears(userId), year]);
  cache.set(userId, years);
  return years;
};
export const refreshYearsCache = async (userId: string): Promise<number[]> => {
  const epoch = generation;
  const years = withCurrent(await getAvailableExpenseYears(userId));
  if (epoch === generation) cache.set(userId, years);
  return years;
};
export const loadAvailableYears = async (userId: string): Promise<number[]> =>
  cache.has(userId) ? getCachedYears(userId) : refreshYearsCache(userId);
