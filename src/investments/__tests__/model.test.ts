import {
  investmentBackupSchema,
  investmentSummary,
  investmentTypeRegistrySchema,
  monthEnd,
  portfolioSummary,
  resolveInvestmentTypes,
  reviewDate,
  type Investment,
} from '../model';

const investment = (overrides: Partial<Investment> = {}): Investment => ({
  id: 'fund',
  userId: 'owner',
  name: 'Index fund',
  type: 'mutual_fund',
  startDate: '2026-08-01',
  reviewDay: 31,
  reminderEnabled: true,
  flows: [],
  valuations: [],
  ...overrides,
});

it('excludes contributions from monthly and all-time gains', () => {
  const result = investmentSummary(
    investment({
      reviewDay: 1,
      flows: [
        {id: 'aug', date: '2026-08-01', type: 'contribution', amount: 1000},
        {id: 'sep', date: '2026-09-01', type: 'contribution', amount: 500},
      ],
      valuations: [
        {month: '2026-08', date: '2026-08-31', value: 1100},
        {month: '2026-09', date: '2026-09-30', value: 1650},
      ],
    }),
    '2026-09',
    '2026-09-30',
  );
  expect(result.monthlyGain).toBe(50);
  expect(result.gain).toBe(150);
  expect(result.monthlyContributed).toBe(500);
});

it('adjusts an estimated value for withdrawals without changing the last known gain', () => {
  const result = investmentSummary(
    investment({
      reviewDay: 1,
      flows: [
        {id: 'deposit', date: '2026-08-01', type: 'contribution', amount: 1000},
        {id: 'withdraw', date: '2026-09-04', type: 'withdrawal', amount: 200},
      ],
      valuations: [{month: '2026-08', date: '2026-08-31', value: 1100}],
    }),
    '2026-09',
    '2026-09-05',
  );
  expect(result.value).toBe(900);
  expect(result.gain).toBe(100);
  expect(result.monthlyGain).toBeNull();
  expect(result.status).toBe('Update due');
});

it('marks a valuation stale when cash moves after its valuation date', () => {
  const result = investmentSummary(
    investment({
      flows: [{id: 'later', date: '2026-09-20', type: 'contribution', amount: 100}],
      valuations: [{month: '2026-09', date: '2026-09-10', value: 500}],
    }),
    '2026-09',
    '2026-09-30',
  );
  expect(result.value).toBe(600);
  expect(result.stale).toBe(true);
});

it('allows a real zero valuation and does not display a missing value as zero', () => {
  expect(investmentSummary(investment(), '2026-09', '2026-09-30').value).toBeNull();
  expect(
    investmentSummary(
      investment({valuations: [{month: '2026-09', date: '2026-09-30', value: 0}]}),
      '2026-09',
      '2026-09-30',
    ).value,
  ).toBe(0);
});

it('clamps reminder days and month ends for leap years', () => {
  expect(monthEnd('2028-02')).toBe('2028-02-29');
  expect(reviewDate(investment(), '2028-02')).toBe('2028-02-29');
  expect(reviewDate(investment(), '2027-02')).toBe('2027-02-28');
});

it('keeps aggregate values unknown until every active investment is valued', () => {
  const known = investment({valuations: [{month: '2026-09', date: '2026-09-05', value: 100}]});
  const unknown = investment({id: 'cash', name: 'Cash', type: 'emergency_cash'});
  const result = portfolioSummary([known, unknown], '2026-09', '2026-09-05');
  expect(result.value).toBeNull();
  expect(result.due).toBe(1);
});

it('supports untyped investments and falls back to the original four types before customization', () => {
  expect(investmentBackupSchema.parse({...investment(), type: undefined}).type).toBeNull();
  expect(resolveInvestmentTypes().map(type => type.id)).toEqual(['mutual_fund', 'gold', 'silver', 'emergency_cash']);
  expect(resolveInvestmentTypes({id: 'registry', userId: 'owner', items: []})).toEqual([]);
});

it('rejects duplicate investment type IDs and names', () => {
  expect(
    investmentTypeRegistrySchema.safeParse({
      id: 'registry',
      userId: 'owner',
      items: [
        {id: 'cash', name: 'Cash'},
        {id: 'other', name: 'cash'},
      ],
    }).success,
  ).toBe(false);
});
