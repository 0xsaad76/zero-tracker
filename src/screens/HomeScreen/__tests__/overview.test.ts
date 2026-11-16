import {buildOverview} from '../useOverview';

const all = {income: true, debts: true, investing: true, trading: true};
const none = {income: false, debts: false, investing: false, trading: false};

const snapshot = () => ({
  incomes: [
    {id: 'i1', userId: 'u', title: 'Salary', amount: 50000, date: '2026-11-01', description: ''},
    {id: 'i2', userId: 'u', title: 'Old', amount: 999, date: '2026-10-01', description: ''},
  ],
  debtors: [{id: 'd1', userId: 'u', title: 'Sam', type: 'Person', debtorStatus: true, icon: 'user', color: '#000000'}],
  debts: [
    {id: 'x1', userId: 'u', amount: 500.1, description: '', debtorId: 'd1', date: '2026-11-02', type: 'Borrow'},
    {id: 'x2', userId: 'u', amount: 200.2, description: '', debtorId: 'd1', date: '2026-11-03', type: 'Lend'},
  ],
  investments: [],
  trades: [
    {
      id: 't1',
      userId: 'u',
      pair: 'btc',
      direction: 'long' as const,
      leverage: 1,
      avgPrice: 100,
      date: '2026-11-05',
      riskReward: 2,
      strategy: 'sfp',
      reason: 'Test',
      pnl: 120,
    },
    {
      id: 't2',
      userId: 'u',
      pair: 'btc',
      direction: 'short' as const,
      leverage: 1,
      avgPrice: 100,
      date: '2026-10-05',
      riskReward: 2,
      strategy: 'sfp',
      reason: 'Last month',
      pnl: -999,
    },
  ],
  tradingBalanceRegistry: undefined,
  preferences: undefined,
});

describe('buildOverview', () => {
  it('summarises only the selected month', () => {
    const overview = buildOverview(snapshot(), '2026-11', all, 'INR');
    expect(overview.income).toBe(50000);
    expect(overview.debts).toEqual({net: 299.9, people: 1});
    expect(overview.investing).toEqual({value: null, count: 0, due: 0});
    expect(overview.trading).toEqual({netPnl: 120, count: 1, currency: 'INR'});
  });

  it('hides every switched-off feature', () => {
    expect(buildOverview(snapshot(), '2026-11', none)).toEqual({
      income: null,
      debts: null,
      investing: null,
      trading: null,
    });
  });

  it('reports a negative net when more is owed to you than you owe', () => {
    const data = snapshot();
    data.debts = [{...data.debts[1], amount: 800}];
    expect(buildOverview(data, '2026-11', all).debts?.net).toBe(-800);
  });

  it('copes with an account that has none of the optional data', () => {
    const overview = buildOverview({debts: [], debtors: []}, '2026-11', all);
    expect(overview).toEqual({
      income: 0,
      debts: {net: 0, people: 0},
      investing: {value: null, count: 0, due: 0},
      trading: {netPnl: 0, count: 0, currency: 'USD'},
    });
  });
});
