import {z} from 'zod';

export const investmentTypeSchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1, 'Enter a type name.').max(40),
});
export type InvestmentType = z.infer<typeof investmentTypeSchema>;

export const defaultInvestmentTypes: InvestmentType[] = [
  {id: 'mutual_fund', name: 'Mutual funds'},
  {id: 'gold', name: 'Gold'},
  {id: 'silver', name: 'Silver'},
  {id: 'emergency_cash', name: 'Emergency cash'},
];

export const investmentTypeRegistrySchema = z
  .object({
    id: z.literal('registry'),
    userId: z.string().min(1).max(160),
    items: z.array(investmentTypeSchema).max(100),
  })
  .superRefine((registry, ctx) => {
    if (new Set(registry.items.map(item => item.id)).size !== registry.items.length) {
      ctx.addIssue({code: 'custom', message: 'Investment type IDs must be unique.'});
    }
    if (new Set(registry.items.map(item => item.name.toLocaleLowerCase())).size !== registry.items.length) {
      ctx.addIssue({code: 'custom', message: 'Investment type names must be unique.'});
    }
  });
export type InvestmentTypeRegistry = z.infer<typeof investmentTypeRegistrySchema>;

export const resolveInvestmentTypes = (registry?: InvestmentTypeRegistry): InvestmentType[] =>
  (registry?.items ?? defaultInvestmentTypes).map(item => ({...item}));

export const investmentTypeLabel = (types: InvestmentType[], id: string | null): string =>
  (id ? types.find(type => type.id === id)?.name : undefined) ?? 'No type';

export const investmentTypeIcon = (id: string | null): string => {
  if (id === 'mutual_fund') return 'trending-up';
  if (id === 'gold' || id === 'silver') return 'coins';
  if (id === 'emergency_cash') return 'wallet';
  return id ? 'tag' : 'circle-dollar-sign';
};
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function validDate(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return y >= 1900 && localDate(new Date(y, m - 1, d)) === value;
}
const dateSchema = z.string().refine(validDate, 'Enter a valid date (YYYY-MM-DD).');
const amountSchema = z
  .number()
  .finite()
  .min(0)
  .max(1e12)
  .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.01, 'Use at most two decimal places.');
export const flowSchema = z.object({
  id: z.string().min(1).max(160),
  date: dateSchema,
  type: z.enum(['contribution', 'withdrawal']),
  amount: amountSchema.refine(n => n > 0, 'Enter an amount above zero.'),
});
export const valuationSchema = z
  .object({month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), date: dateSchema, value: amountSchema})
  .refine(v => v.date.startsWith(v.month), 'Valuation date must belong to the selected month.');
export const investmentBackupSchema = z
  .object({
    id: z.string().min(1).max(160),
    name: z.string().trim().min(1).max(80),
    type: z.string().trim().min(1).max(160).nullable().default(null),
    startDate: dateSchema,
    reviewDay: z.number().int().min(1).max(31),
    reminderEnabled: z.boolean(),
    flows: z.array(flowSchema).max(5000),
    valuations: z.array(valuationSchema).max(1200),
  })
  .superRefine((i, ctx) => {
    if (i.flows.some(f => f.date < i.startDate) || i.valuations.some(v => v.date < i.startDate))
      ctx.addIssue({code: 'custom', message: 'Entries cannot precede the investment start date.'});
    if (
      new Set(i.flows.map(f => f.id)).size !== i.flows.length ||
      new Set(i.valuations.map(v => v.month)).size !== i.valuations.length
    )
      ctx.addIssue({code: 'custom', message: 'Duplicate transaction or monthly valuation.'});
  });
export type Investment = z.infer<typeof investmentBackupSchema> & {userId: string};
export type InvestmentFlow = z.infer<typeof flowSchema>;
export type MonthlyValuation = z.infer<typeof valuationSchema>;
export const money = (amount: number) => Math.round(amount * 100) / 100;
export const total = (amounts: number[]) => amounts.reduce((sum, n) => sum + Math.round(n * 100), 0) / 100;
export function monthEnd(month: string) {
  const [y, m] = month.split('-').map(Number);
  return localDate(new Date(y, m, 0));
}
export function shiftMonth(month: string, offset: number) {
  const [y, m] = month.split('-').map(Number);
  return localDate(new Date(y, m - 1 + offset, 1)).slice(0, 7);
}
export function reviewDate(investment: Pick<Investment, 'reviewDay'>, month: string) {
  return `${month}-${String(Math.min(investment.reviewDay, Number(monthEnd(month).slice(-2)))).padStart(2, '0')}`;
}
export function investmentSummary(i: Investment, month: string, today = localDate()) {
  const end = monthEnd(month) < today ? monthEnd(month) : today;
  const flows = i.flows.filter(f => f.date <= end);
  const contributed = total(flows.filter(f => f.type === 'contribution').map(f => f.amount));
  const withdrawn = total(flows.filter(f => f.type === 'withdrawal').map(f => f.amount));
  const monthlyContributed = total(
    flows.filter(f => f.type === 'contribution' && f.date.startsWith(month)).map(f => f.amount),
  );
  const monthlyWithdrawn = total(
    flows.filter(f => f.type === 'withdrawal' && f.date.startsWith(month)).map(f => f.amount),
  );
  const valuations = i.valuations.filter(v => v.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const latest = valuations.at(-1);
  const closing = valuations.find(v => v.month === month);
  const previous = closing ? valuations.filter(v => v.date < closing.date).at(-1) : undefined;
  const netBetween = (after: string, through: string) =>
    total(
      flows.filter(f => f.date > after && f.date <= through).map(f => (f.type === 'withdrawal' ? -f.amount : f.amount)),
    );
  const value = latest ? money(latest.value + netBetween(latest.date, end)) : null;
  // Never treat an unvalued month as zero growth, or attribute a multi-month
  // change to one month. Each valuation is end-of-day (includes that day's flows).
  const hasBaseline = previous?.month === shiftMonth(month, -1) || (!previous && i.startDate.startsWith(month));
  const cashAfterClosing = !!flows.find(f => f.date > (closing?.date ?? ''));
  const monthlyGain =
    closing && hasBaseline && !cashAfterClosing
      ? money(closing.value - (previous?.value ?? 0) - netBetween(previous?.date ?? '', closing.date))
      : null;
  const gain = latest ? money(latest.value - netBetween('', latest.date)) : null;
  const stale = !closing || cashAfterClosing;
  const status = closing
    ? 'Updated'
    : month < today.slice(0, 7) || reviewDate(i, month) <= today
      ? 'Update due'
      : 'Not updated';
  return {
    contributed,
    withdrawn,
    monthlyContributed,
    monthlyWithdrawn,
    value: value !== null && value >= 0 ? value : null,
    gain,
    monthlyGain,
    latest,
    closing,
    stale,
    status,
    dueDate: reviewDate(i, month),
  };
}
export function portfolioSummary(investments: Investment[], month: string, today = localDate()) {
  const active = investments.filter(i => i.startDate <= (monthEnd(month) < today ? monthEnd(month) : today));
  const rows = active.map(i => investmentSummary(i, month, today));
  return {
    contributed: total(rows.map(r => r.contributed)),
    withdrawn: total(rows.map(r => r.withdrawn)),
    monthlyContributed: total(rows.map(r => r.monthlyContributed)),
    monthlyWithdrawn: total(rows.map(r => r.monthlyWithdrawn)),
    value: rows.length && rows.every(r => r.value !== null) ? total(rows.map(r => r.value!)) : null,
    gain: rows.length && rows.every(r => r.gain !== null) ? total(rows.map(r => r.gain!)) : null,
    monthlyGain:
      rows.length && rows.every(r => r.monthlyGain !== null && !r.stale) ? total(rows.map(r => r.monthlyGain!)) : null,
    complete: rows.length > 0 && rows.every(r => !!r.closing && !r.stale),
    due: rows.filter(r => !r.closing).length,
    count: rows.length,
  };
}
