import {performanceDays, performancePlot} from '../performance';
import type {Trade} from '../model';

const trade = (date: string, pnl: number): Trade => ({
  id: `${date}-${pnl}`,
  userId: 'owner',
  pair: 'btc',
  direction: 'long',
  leverage: 1,
  avgPrice: 100,
  date,
  riskReward: 2,
  strategy: 'sfp',
  reason: '',
  pnl,
});

it('sorts without mutation, combines same-day trades and accumulates in cents', () => {
  const trades = [trade('2026-09-04', -0.1), trade('2026-09-01', 0.1), trade('2026-09-01', 0.2)];
  const original = [...trades];
  expect(performanceDays(trades)).toEqual([
    {date: '2026-09-01', pnl: 0.3, cumulative: 0.3, count: 2},
    {date: '2026-09-04', pnl: -0.1, cumulative: 0.2, count: 1},
  ]);
  expect(trades).toEqual(original);
});

it.each([
  ['loss', [-100]],
  ['flat', [0]],
  ['profit', [100]],
  ['mixed', [10, -30, 20]],
])('handles %s without invalid or out-of-bounds geometry', (_label, values) => {
  const days = performanceDays((values as number[]).map((value, index) => trade(`2026-09-0${index + 1}`, value)));
  for (const mode of ['daily', 'cumulative'] as const) {
    const plot = performancePlot(days, mode, 220, 150)!;
    expect(plot.path).not.toMatch(/NaN|Infinity/);
    for (const point of plot.points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(220);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(150);
    }
    expect(plot.ticks.some(tick => tick.value === 0)).toBe(true);
  }
});

it('spaces dates by elapsed calendar time and keeps cumulative P&L flat between closes', () => {
  const days = performanceDays([trade('2026-09-01', 20), trade('2026-09-02', -10), trade('2026-09-04', 30)]);
  const plot = performancePlot(days, 'cumulative', 200, 150)!;
  expect(plot.points.map(point => point.x)).toEqual([50, 100, 200]);
  expect(plot.path).toMatch(/^M 0 .+ H 50 V .+ H 100 V .+ H 200 V/);
  expect(performancePlot([], 'daily', 200, 150)).toBeNull();
});
