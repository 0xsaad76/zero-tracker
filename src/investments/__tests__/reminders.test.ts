import {investmentReminderRows} from '../reminders';
import {localDate, type Investment} from '../model';

const month = localDate().slice(0, 7);
const day = `${month}-01`;
const investment = (overrides: Partial<Investment> = {}): Investment => ({
  id: 'fund',
  userId: 'owner',
  name: 'Fund',
  type: 'mutual_fund',
  startDate: day,
  reviewDay: 10,
  reminderEnabled: true,
  flows: [],
  valuations: [],
  ...overrides,
});

it('stores only anonymous schedule fields and excludes opted-out investments', () => {
  expect(investmentReminderRows([investment(), investment({id: 'off', reminderEnabled: false})])).toEqual([
    {id: 'fund', day: 10, completedMonth: '', startMonth: month},
  ]);
});

it('marks the month complete only when no transaction followed its valuation', () => {
  const complete = investment({valuations: [{month, date: day, value: 100}]});
  const stale = investment({
    id: 'stale',
    flows: [{id: 'later', date: `${month}-02`, type: 'contribution', amount: 10}],
    valuations: [{month, date: day, value: 100}],
  });
  expect(investmentReminderRows([complete, stale]).map(row => row.completedMonth)).toEqual([month, '']);
});
