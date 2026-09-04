import {getWeekDateRange, getWeeklyRecurringKey, sumAmountsByCategory} from '../budgetTracking';

describe('budget tracking periods', () => {
  it('uses Sunday boundaries when that is the preference', () => {
    expect(getWeekDateRange('2026-09-03', 'sunday')).toEqual({
      startDate: '2026-08-30',
      endDate: '2026-09-05',
    });
  });

  it('uses Monday boundaries when that is the preference', () => {
    expect(getWeekDateRange('2026-09-03', 'monday')).toEqual({
      startDate: '2026-08-31',
      endDate: '2026-09-06',
    });
    expect(getWeeklyRecurringKey('2026-09-03', 'monday')).toBe('recurring-weekly:2026-08-31');
  });

  it('totals transactions independently per category', () => {
    expect(
      Array.from(
        sumAmountsByCategory([
          {amount: 10, categoryId: 'food'},
          {amount: 20, categoryId: 'travel'},
          {amount: 5, categoryId: 'food'},
        ]),
      ),
    ).toEqual([
      ['food', 15],
      ['travel', 20],
    ]);
  });
});
