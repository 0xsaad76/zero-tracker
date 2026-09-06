import {total, type Trade} from './model';

export type PerformanceDay = {date: string; pnl: number; cumulative: number; count: number};

// End-of-day totals avoid inventing an order for trades recorded on the same date.
export function performanceDays(trades: Trade[]): PerformanceDay[] {
  const days = new Map<string, {amounts: number[]; count: number}>();
  for (const trade of trades) {
    const day = days.get(trade.date) ?? {amounts: [], count: 0};
    day.amounts.push(trade.pnl);
    day.count++;
    days.set(trade.date, day);
  }
  let cumulative = 0;
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      const pnl = total(day.amounts);
      cumulative = total([cumulative, pnl]);
      return {date, pnl, cumulative, count: day.count};
    });
}

export const calendarTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function performancePlot(days: PerformanceDay[], mode: 'cumulative' | 'daily', width: number, height: number) {
  if (!days.length) return null;
  const values = days.map(day => (mode === 'cumulative' ? day.cumulative : day.pnl));
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const padding = (high - low || 1) * 0.12;
  const min = low - padding;
  const max = high + padding;
  const first = calendarTime(days[0].date);
  const last = calendarTime(days[days.length - 1].date);
  // Cumulative mode includes a genuine zero baseline before the first closed-trade day.
  const start = mode === 'cumulative' ? first - 86400000 : first;
  const x = (time: number) => (last === start ? width / 2 : ((time - start) / (last - start)) * width);
  const y = (value: number) => height - ((value - min) / (max - min)) * height;
  const points = days.map((day, index) => ({...day, x: x(calendarTime(day.date)), y: y(values[index])}));
  const path =
    mode === 'cumulative'
      ? `M 0 ${y(0)} ${points.map(point => `H ${point.x} V ${point.y}`).join(' ')}`
      : points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  return {points, path, zeroY: y(0), ticks: [...new Set([high, 0, low])].map(value => ({value, y: y(value)}))};
}
