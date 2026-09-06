import {z} from 'zod';

export const tradingStrategySchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1, 'Enter a strategy name.').max(40),
});
export type TradingStrategy = z.infer<typeof tradingStrategySchema>;

export const defaultTradingStrategies: TradingStrategy[] = [
  {id: 'sfp', name: 'SFP'},
  {id: 'trendline', name: 'Trendline'},
  {id: 'bullish_divergence', name: 'Bullish Divergence'},
  {id: 'bearish_divergence', name: 'Bearish Divergence'},
];

export const tradingStrategyRegistrySchema = z
  .object({
    id: z.literal('registry'),
    userId: z.string().min(1).max(160),
    items: z.array(tradingStrategySchema).max(100),
  })
  .superRefine((registry, ctx) => {
    if (new Set(registry.items.map(item => item.id)).size !== registry.items.length) {
      ctx.addIssue({code: 'custom', message: 'Strategy IDs must be unique.'});
    }
    if (new Set(registry.items.map(item => item.name.toLocaleLowerCase())).size !== registry.items.length) {
      ctx.addIssue({code: 'custom', message: 'Strategy names must be unique.'});
    }
  });
export type TradingStrategyRegistry = z.infer<typeof tradingStrategyRegistrySchema>;

export const resolveTradingStrategies = (registry?: TradingStrategyRegistry): TradingStrategy[] =>
  (registry?.items ?? defaultTradingStrategies).map(item => ({...item}));

export const tradingStrategyLabel = (strategies: TradingStrategy[], id: string): string =>
  strategies.find(item => item.id === id)?.name ?? 'Unknown strategy';

export const tradingPairSchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1, 'Enter a pair name.').max(20),
});
export type TradingPair = z.infer<typeof tradingPairSchema>;

export const defaultTradingPairs: TradingPair[] = [
  {id: 'btc', name: 'BTC'},
  {id: 'eth', name: 'ETH'},
];

export const tradingPairRegistrySchema = z
  .object({
    id: z.literal('registry'),
    userId: z.string().min(1).max(160),
    items: z.array(tradingPairSchema).max(100),
  })
  .superRefine((registry, ctx) => {
    if (new Set(registry.items.map(item => item.id)).size !== registry.items.length) {
      ctx.addIssue({code: 'custom', message: 'Pair IDs must be unique.'});
    }
    if (new Set(registry.items.map(item => item.name.toLocaleLowerCase())).size !== registry.items.length) {
      ctx.addIssue({code: 'custom', message: 'Pair names must be unique.'});
    }
  });
export type TradingPairRegistry = z.infer<typeof tradingPairRegistrySchema>;

export const resolveTradingPairs = (registry?: TradingPairRegistry): TradingPair[] =>
  (registry?.items ?? defaultTradingPairs).map(item => ({...item}));

export const tradingPairLabel = (pairs: TradingPair[], id: string): string =>
  pairs.find(item => item.id === id)?.name ?? 'Unknown pair';

export const tradingBalanceSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Enter a valid month (YYYY-MM).'),
  openingBalance: z
    .number()
    .finite()
    .min(0)
    .max(1e12)
    .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.01, 'Use at most two decimal places.'),
});
export type TradingBalance = z.infer<typeof tradingBalanceSchema>;

export const tradingBalanceRegistrySchema = z
  .object({
    id: z.literal('registry'),
    userId: z.string().min(1).max(160),
    items: z.array(tradingBalanceSchema).max(1200),
  })
  .superRefine((registry, ctx) => {
    if (new Set(registry.items.map(item => item.month)).size !== registry.items.length) {
      ctx.addIssue({code: 'custom', message: 'Duplicate opening balance month.'});
    }
  });
export type TradingBalanceRegistry = z.infer<typeof tradingBalanceRegistrySchema>;

export const openingBalanceForMonth = (registry: TradingBalanceRegistry | undefined, month: string): number =>
  registry?.items.find(item => item.month === month)?.openingBalance ?? 0;

export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function validDate(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return y >= 1900 && localDate(new Date(y, m - 1, d)) === value;
}
const dateSchema = z.string().refine(validDate, 'Enter a valid date (YYYY-MM-DD).');
const pnlSchema = z
  .number()
  .finite()
  .min(-1e12)
  .max(1e12)
  .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.01, 'Use at most two decimal places.');
const priceSchema = z
  .number()
  .finite()
  .min(0)
  .max(1e12)
  .refine(n => n > 0, 'Enter a price above zero.')
  .refine(n => {
    const scaled = n * 1e8;
    return Math.abs(scaled - Math.round(scaled)) < 0.01;
  }, 'Use at most eight decimal places.');

export const tradeBackupSchema = z.object({
  id: z.string().min(1).max(160),
  pair: z.string().trim().min(1).max(160),
  direction: z.enum(['long', 'short']),
  leverage: z.number().int().min(1).max(125),
  avgPrice: priceSchema,
  date: dateSchema,
  riskReward: z
    .number()
    .finite()
    .min(0.05)
    .max(100)
    .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.01, 'Use at most two decimal places.'),
  strategy: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1, 'Add a short reason for this trade.').max(500),
  pnl: pnlSchema,
});
export type Trade = z.infer<typeof tradeBackupSchema> & {userId: string};

export const tradeOutcome = (pnl: number): 'win' | 'loss' | 'breakeven' =>
  pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven';

export const money = (amount: number) => Math.round(amount * 100) / 100;
export const total = (amounts: number[]) => amounts.reduce((sum, n) => sum + Math.round(n * 100), 0) / 100;

export type TradingCurrency = 'USD' | 'INR';
/** Display-only rate. Stored trade numbers are denomination-agnostic; the toggle only changes the lens. */
export const USD_TO_INR_RATE = 105;
export const convertTradingAmount = (amount: number, currency: TradingCurrency): number =>
  currency === 'INR' ? money(amount * USD_TO_INR_RATE) : amount;

export function monthEnd(month: string) {
  const [y, m] = month.split('-').map(Number);
  return localDate(new Date(y, m, 0));
}
export function shiftMonth(month: string, offset: number) {
  const [y, m] = month.split('-').map(Number);
  return localDate(new Date(y, m - 1 + offset, 1)).slice(0, 7);
}

export interface TradeFilter {
  month: string;
  range: 'month' | 'week' | 'day';
  /** Anchor date (YYYY-MM-DD) for week/day ranges. Ignored for month. */
  anchor?: string;
  weekStart?: 'sunday' | 'monday';
  pair?: string | 'all';
}

const dayOfWeek = (date: string) => new Date(`${date}T12:00:00`).getDay();

export function tradeRangeBounds(filter: TradeFilter): {start: string; end: string; label: string} {
  if (filter.range === 'day') {
    const day = (filter.anchor ?? `${filter.month}-01`).slice(0, 10);
    return {start: day, end: day, label: day};
  }
  if (filter.range === 'week') {
    const anchor = (filter.anchor ?? `${filter.month}-01`).slice(0, 10);
    const startOffset = (dayOfWeek(anchor) - (filter.weekStart === 'sunday' ? 0 : 1) + 7) % 7;
    const start = localDate(new Date(new Date(`${anchor}T12:00:00`).getTime() - startOffset * 86400000));
    const end = localDate(new Date(new Date(`${start}T12:00:00`).getTime() + 6 * 86400000));
    return {start, end, label: `${start} – ${end}`};
  }
  return {start: `${filter.month}-01`, end: monthEnd(filter.month), label: filter.month};
}

export function filterTrades(trades: Trade[], filter: TradeFilter): Trade[] {
  const {start, end} = tradeRangeBounds(filter);
  return trades
    .filter(trade => trade.date >= start && trade.date <= end)
    .filter(trade => !filter.pair || filter.pair === 'all' || trade.pair === filter.pair)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export interface TradeStats {
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  netPnl: number;
  grossWin: number;
  grossLoss: number;
  profitFactor: number | null;
  avgRiskReward: number | null;
  best: number | null;
  worst: number | null;
}

export function summarizeTrades(trades: Trade[]): TradeStats {
  const count = trades.length;
  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl < 0).length;
  const breakeven = count - wins - losses;
  const netPnl = total(trades.map(t => t.pnl));
  const grossWin = total(trades.filter(t => t.pnl > 0).map(t => t.pnl));
  const grossLoss = total(trades.filter(t => t.pnl < 0).map(t => Math.abs(t.pnl)));
  const closed = wins + losses;
  return {
    count,
    wins,
    losses,
    breakeven,
    winRate: closed ? Math.round((wins / closed) * 1000) / 10 : null,
    netPnl,
    grossWin,
    grossLoss,
    profitFactor:
      grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : grossWin > 0 ? Number.POSITIVE_INFINITY : null,
    avgRiskReward:
      count > 0 ? Math.round((trades.reduce((sum, t) => sum + t.riskReward, 0) / count) * 100) / 100 : null,
    best: count ? Math.max(...trades.map(t => t.pnl)) : null,
    worst: count ? Math.min(...trades.map(t => t.pnl)) : null,
  };
}

export interface MonthlyTradingSummary extends TradeStats {
  month: string;
  openingBalance: number;
  closingBalance: number;
}

export function monthlyTradingSummary(trades: Trade[], month: string, openingBalance: number): MonthlyTradingSummary {
  // A journal month always covers the whole calendar month: backfilled and
  // month-end trades belong to the month they closed in, never to the device clock.
  const monthly = trades.filter(t => t.date.startsWith(month));
  const stats = summarizeTrades(monthly);
  return {month, openingBalance: money(openingBalance), closingBalance: money(openingBalance + stats.netPnl), ...stats};
}

export function equityCurve(trades: Trade[]): {date: string; pnl: number; cumulative: number}[] {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let running = 0;
  return sorted.map(t => {
    running = money(running + t.pnl);
    return {date: t.date, pnl: t.pnl, cumulative: running};
  });
}
