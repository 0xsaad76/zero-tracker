import {
  convertTradingAmount,
  equityCurve,
  filterTrades,
  monthlyTradingSummary,
  openingBalanceForMonth,
  resolveTradingPairs,
  resolveTradingStrategies,
  summarizeTrades,
  tradeBackupSchema,
  tradeRangeBounds,
  USD_TO_INR_RATE,
  type Trade,
} from '../model';

const trade = (overrides: Partial<Trade> = {}): Trade => ({
  id: 't1',
  userId: 'owner',
  pair: 'btc',
  direction: 'long',
  leverage: 10,
  avgPrice: 67250.5,
  date: '2026-09-05',
  riskReward: 2,
  strategy: 'sfp',
  reason: 'Sweep of prior high with displacement.',
  pnl: 250,
  ...overrides,
});

it('derives win rate, profit factor, and average risk/reward', () => {
  const stats = summarizeTrades([
    trade({id: 'a', pnl: 200, riskReward: 2}),
    trade({id: 'b', pnl: -100, riskReward: 3}),
    trade({id: 'c', pnl: 0, riskReward: 1}),
  ]);
  expect(stats.count).toBe(3);
  expect(stats.wins).toBe(1);
  expect(stats.losses).toBe(1);
  expect(stats.breakeven).toBe(1);
  expect(stats.winRate).toBe(50);
  expect(stats.netPnl).toBe(100);
  expect(stats.profitFactor).toBe(2);
  expect(stats.avgRiskReward).toBe(2);
});

it('computes monthly closing balance from opening balance plus month pnl', () => {
  const summary = monthlyTradingSummary(
    [
      trade({id: 'a', date: '2026-09-04', pnl: 200}),
      trade({id: 'b', date: '2026-08-30', pnl: 999}),
      trade({id: 'c', date: '2026-09-30', pnl: 50}),
    ],
    '2026-09',
    1000,
  );
  expect(summary.openingBalance).toBe(1000);
  expect(summary.closingBalance).toBe(1250);
  expect(summary.count).toBe(2);
});

it('filters by week and pair', () => {
  const trades = [
    trade({id: 'mon', date: '2026-09-01', pair: 'btc'}),
    trade({id: 'sun', date: '2026-09-07', pair: 'eth'}),
  ];
  const week = filterTrades(trades, {month: '2026-09', range: 'week', anchor: '2026-09-03', weekStart: 'monday'});
  expect(week.map(t => t.id)).toEqual(['mon']);
  const pair = filterTrades(trades, {month: '2026-09', range: 'month', pair: 'eth'});
  expect(pair.map(t => t.id)).toEqual(['sun']);
  expect(tradeRangeBounds({month: '2026-09', range: 'month'}).start).toBe('2026-09-01');
});

it('builds a cumulative equity curve in date order', () => {
  const curve = equityCurve([
    trade({id: 'b', date: '2026-09-06', pnl: -50}),
    trade({id: 'a', date: '2026-09-05', pnl: 100}),
  ]);
  expect(curve.map(point => point.cumulative)).toEqual([100, 50]);
});

it('falls back to BTC/ETH and zero opening balance', () => {
  expect(resolveTradingStrategies().map(s => s.id)).toEqual([
    'sfp',
    'trendline',
    'bullish_divergence',
    'bearish_divergence',
  ]);
  expect(resolveTradingPairs().map(p => p.id)).toEqual(['btc', 'eth']);
  expect(openingBalanceForMonth(undefined, '2026-09')).toBe(0);
});

it('rejects future-invalid trade fields', () => {
  expect(tradeBackupSchema.safeParse(trade({leverage: 0})).success).toBe(false);
  expect(tradeBackupSchema.safeParse(trade({reason: '  '})).success).toBe(false);
  expect(tradeBackupSchema.safeParse(trade({riskReward: 0})).success).toBe(false);
});

it('converts display amounts at the fixed journal rate', () => {
  expect(USD_TO_INR_RATE).toBe(105);
  expect(convertTradingAmount(100, 'USD')).toBe(100);
  expect(convertTradingAmount(100, 'INR')).toBe(10500);
  expect(convertTradingAmount(-570, 'INR')).toBe(-59850);
});
