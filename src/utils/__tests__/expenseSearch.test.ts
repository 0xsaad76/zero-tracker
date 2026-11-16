import {searchExpenses, searchTotal, type SearchableExpense} from '../expenseSearch';

const expense = (overrides: Partial<SearchableExpense>): SearchableExpense => ({
  id: 'a',
  title: 'Lunch',
  description: '',
  amount: 100,
  date: '2026-11-01T12:00:00',
  categoryId: 'food',
  categoryName: 'Food',
  ...overrides,
});

const rows = [
  expense({id: '1', title: 'Lunch at Cafe', amount: 450, date: '2026-11-03T13:00:00'}),
  expense({
    id: '2',
    title: 'Uber',
    amount: 45.5,
    categoryId: 'travel',
    categoryName: 'Transportation',
    date: '2026-10-20T09:00:00',
  }),
  expense({id: '3', title: 'Groceries', description: 'weekly cafe beans', amount: 1200, date: '2026-11-10T18:00:00'}),
];

describe('searchExpenses', () => {
  it('returns everything newest first when the query is empty', () => {
    expect(searchExpenses(rows, {query: '  ', categoryId: null}).map(row => row.id)).toEqual(['3', '1', '2']);
  });

  it('matches title, note and category without regard to case', () => {
    expect(searchExpenses(rows, {query: 'CAFE', categoryId: null}).map(row => row.id)).toEqual(['3', '1']);
    expect(searchExpenses(rows, {query: 'transport', categoryId: null}).map(row => row.id)).toEqual(['2']);
  });

  it('requires every word to match', () => {
    expect(searchExpenses(rows, {query: 'cafe lunch', categoryId: null}).map(row => row.id)).toEqual(['1']);
    expect(searchExpenses(rows, {query: 'cafe uber', categoryId: null})).toEqual([]);
  });

  it('matches amounts by prefix and ignores thousands separators', () => {
    expect(searchExpenses(rows, {query: '45', categoryId: null}).map(row => row.id)).toEqual(['1', '2']);
    expect(searchExpenses(rows, {query: '1,200', categoryId: null}).map(row => row.id)).toEqual(['3']);
  });

  it('matches dates and narrows by category', () => {
    expect(searchExpenses(rows, {query: '2026-10', categoryId: null}).map(row => row.id)).toEqual(['2']);
    expect(searchExpenses(rows, {query: '', categoryId: 'food'}).map(row => row.id)).toEqual(['3', '1']);
    expect(searchExpenses(rows, {query: 'uber', categoryId: 'food'})).toEqual([]);
  });

  it('does not mutate the input order', () => {
    const before = rows.map(row => row.id);
    searchExpenses(rows, {query: '', categoryId: null});
    expect(rows.map(row => row.id)).toEqual(before);
  });
});

describe('searchTotal', () => {
  it('adds in cents to avoid float drift', () => {
    expect(searchTotal([{amount: 0.1}, {amount: 0.2}])).toBe(0.3);
    expect(searchTotal([])).toBe(0);
  });
});
