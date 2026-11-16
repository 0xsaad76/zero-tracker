import {incomeBackupSchema, incomeTotal, incomesForMonth, monthBalance, sortIncomes} from '../model';

const income = (id: string, date: string, amount: number) => ({id, title: 'Salary', amount, date, description: ''});

describe('income schema', () => {
  it('accepts a normal entry, trims the source and defaults the note', () => {
    expect(incomeBackupSchema.parse({id: 'a', title: '  Salary ', amount: 1000.5, date: '2026-11-01'})).toEqual({
      id: 'a',
      title: 'Salary',
      amount: 1000.5,
      date: '2026-11-01',
      description: '',
    });
  });

  it.each([
    ['a blank source', {title: '   '}],
    ['a zero amount', {amount: 0}],
    ['a negative amount', {amount: -5}],
    ['three decimal places', {amount: 10.001}],
    ['an impossible date', {date: '2026-02-31'}],
    ['a datetime instead of a day', {date: '2026-11-01T10:00:00'}],
    ['an oversized note', {description: 'x'.repeat(201)}],
  ])('rejects %s', (_label, override) => {
    expect(incomeBackupSchema.safeParse({...income('a', '2026-11-01', 100), ...override}).success).toBe(false);
  });
});

describe('income maths', () => {
  const rows = [income('a', '2026-11-01', 0.1), income('b', '2026-11-15', 0.2), income('c', '2026-10-30', 500)];

  it('filters by month and totals in cents', () => {
    expect(incomesForMonth(rows, '2026-11').map(row => row.id)).toEqual(['a', 'b']);
    expect(incomeTotal(incomesForMonth(rows, '2026-11'))).toBe(0.3);
    expect(incomeTotal([])).toBe(0);
  });

  it('sorts newest first without mutating', () => {
    expect(sortIncomes(rows).map(row => row.id)).toEqual(['b', 'a', 'c']);
    expect(rows.map(row => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('reports what is left and the share kept', () => {
    expect(monthBalance(50000, 30000)).toEqual({income: 50000, spent: 30000, left: 20000, savedPercent: 40});
    expect(monthBalance(1000, 1500)).toEqual({income: 1000, spent: 1500, left: -500, savedPercent: 0});
    expect(monthBalance(0, 200)).toEqual({income: 0, spent: 200, left: -200, savedPercent: null});
    expect(monthBalance(0.3, 0.1).left).toBe(0.2);
  });
});
