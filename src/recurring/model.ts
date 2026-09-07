import {z} from 'zod';
import {localDate, monthEnd, shiftMonth} from '../investments/model';

export const scheduleTargetSchema = z.enum(['expense', 'investment', 'debt']);
export type ScheduleTarget = z.infer<typeof scheduleTargetSchema>;

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Enter a valid month (YYYY-MM).');
const moneySchema = z
  .number()
  .finite()
  .min(0.01, 'Enter an amount above zero.')
  .max(1e12)
  .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.01, 'Use at most two decimal places.');

const baseSchedule = {
  id: z.string().min(1).max(160),
  dayOfMonth: z.number().int().min(1).max(31),
  amount: moneySchema,
  paused: z.boolean().default(false),
  startMonth: monthSchema,
  lastPostedMonth: monthSchema.nullable().default(null),
};

export const recurringScheduleSchema = z.discriminatedUnion('target', [
  z.object({
    ...baseSchedule,
    target: z.literal('expense'),
    categoryId: z.string().min(1).max(160),
    title: z.string().trim().min(1, 'Enter a title.').max(80),
    description: z.string().max(200).default(''),
  }),
  z.object({
    ...baseSchedule,
    target: z.literal('investment'),
    investmentId: z.string().min(1).max(160),
  }),
  z.object({
    ...baseSchedule,
    target: z.literal('debt'),
    debtorId: z.string().min(1).max(160),
    debtType: z.enum(['Borrow', 'Lend']),
    description: z.string().max(200).default(''),
  }),
]);
export type RecurringSchedule = z.infer<typeof recurringScheduleSchema> & {userId: string};

/**
 * Backup shape: references travel as names (ids are remapped on restore).
 * Everything else round-trips untouched, so a restore resumes exactly where
 * the backup left off — no duplicate catch-up, no lost paused state.
 */
export const recurringScheduleExportSchema = z.discriminatedUnion('target', [
  z.object({
    ...baseSchedule,
    target: z.literal('expense'),
    categoryName: z.string().min(1).max(160),
    title: z.string().trim().min(1).max(80),
    description: z.string().max(200).default(''),
  }),
  z.object({
    ...baseSchedule,
    target: z.literal('investment'),
    investmentName: z.string().min(1).max(160),
  }),
  z.object({
    ...baseSchedule,
    target: z.literal('debt'),
    debtorTitle: z.string().min(1).max(160),
    debtType: z.enum(['Borrow', 'Lend']),
    description: z.string().max(200).default(''),
  }),
]);
export type RecurringScheduleExport = z.infer<typeof recurringScheduleExportSchema>;

export interface DuePosting {
  month: string;
  date: string;
}

/** Posting date for a month, clamped to short months (a 31st becomes the 28th/30th). */
export function scheduledDate(dayOfMonth: number, month: string): string {
  const lastDay = Number(monthEnd(month).slice(-2));
  return `${month}-${String(Math.min(dayOfMonth, lastDay)).padStart(2, '0')}`;
}

/**
 * Months a schedule must post for, oldest first. Covers every missed month
 * (catch-up) plus the current month once its day arrives. Paused schedules
 * never owe anything. Pure — the service applies the postings.
 */
export function dueMonths(
  schedule: Pick<RecurringSchedule, 'dayOfMonth' | 'startMonth' | 'lastPostedMonth' | 'paused'>,
  today = localDate(),
): string[] {
  if (schedule.paused) return [];
  const current = today.slice(0, 7);
  let month = schedule.lastPostedMonth ? shiftMonth(schedule.lastPostedMonth, 1) : schedule.startMonth;
  if (month > current) return [];
  const due: string[] = [];
  while (month < current) {
    due.push(month);
    month = shiftMonth(month, 1);
  }
  if (scheduledDate(schedule.dayOfMonth, current) <= today) due.push(current);
  return due;
}

export interface PostedEntry {
  scheduleId: string;
  target: ScheduleTarget;
  label: string;
  date: string;
  amount: number;
}

export interface SkippedEntry {
  scheduleId: string;
  label: string;
  reason: string;
}

export interface RunSummary {
  posted: PostedEntry[];
  skipped: SkippedEntry[];
}
