import {nanoid} from 'nanoid';
import {z} from 'zod';
import {mutateCloudData, recurringSyncAvailable, requireCloudUser, type CloudData} from '../cloud/records';
import {investmentBackupSchema} from '../investments/model';
import {
  dueMonths,
  recurringScheduleSchema,
  scheduledDate,
  type PostedEntry,
  type RecurringSchedule,
  type RunSummary,
  type SkippedEntry,
} from './model';

type ScheduleInput =
  | Omit<Extract<RecurringSchedule, {target: 'expense'}>, 'id' | 'userId' | 'paused' | 'lastPostedMonth'>
  | Omit<Extract<RecurringSchedule, {target: 'investment'}>, 'id' | 'userId' | 'paused' | 'lastPostedMonth'>
  | Omit<Extract<RecurringSchedule, {target: 'debt'}>, 'id' | 'userId' | 'paused' | 'lastPostedMonth'>;

const assertRecurringSync = () => {
  if (!recurringSyncAvailable()) {
    throw new Error('Automations need a cloud update first. Apply the latest cloud migration, then reload.');
  }
};

export async function saveRecurringSchedule(input: ScheduleInput, id?: string, initial?: {lastPostedMonth?: string}) {
  const owner = requireCloudUser();
  const key = id ?? nanoid(24);
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertRecurringSync();
    const item = recurringScheduleSchema.parse({
      ...input,
      id: key,
      paused: false,
      lastPostedMonth: initial?.lastPostedMonth ?? null,
    });
    assertRefs(draft, item);
    const items = (draft.recurringSchedules ??= []);
    const existing = items.find(schedule => schedule.id === key);
    if (id && !existing) throw new Error('This automation was removed. Reload and try again.');
    const record = existing
      ? {...item, userId: owner, paused: existing.paused, lastPostedMonth: existing.lastPostedMonth}
      : {...item, userId: owner};
    if (existing) items[items.indexOf(existing)] = record;
    else items.push(record);
  });
  return key;
}

export async function updateRecurringSchedule(id: string, patch: {dayOfMonth?: number; amount?: number}) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertRecurringSync();
    const item = draft.recurringSchedules?.find(schedule => schedule.id === id);
    if (!item) throw new Error('This automation was removed. Reload and try again.');
    const next = {...recurringScheduleSchema.parse({...item, ...patch}), userId: item.userId};
    assertRefs(draft, next);
    const schedules = draft.recurringSchedules ?? [];
    schedules[schedules.indexOf(item)] = next;
    draft.recurringSchedules = schedules;
  });
}

export async function setRecurringSchedulePaused(id: string, paused: boolean) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertRecurringSync();
    const item = draft.recurringSchedules?.find(schedule => schedule.id === id);
    if (!item) throw new Error('This automation was removed. Reload and try again.');
    item.paused = paused;
  });
}

export async function deleteRecurringSchedule(id: string) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertRecurringSync();
    draft.recurringSchedules = (draft.recurringSchedules ?? []).filter(schedule => schedule.id !== id);
  });
}

function assertRefs(draft: CloudData, item: z.infer<typeof recurringScheduleSchema>) {
  if (item.target === 'expense' && !draft.categories.some(category => category.id === item.categoryId)) {
    throw new Error('That category no longer exists. Choose another category.');
  }
  if (
    item.target === 'investment' &&
    !(draft.investments ?? []).some(investment => investment.id === item.investmentId)
  ) {
    throw new Error('That investment no longer exists. Choose another investment.');
  }
  if (item.target === 'debt' && !draft.debtors.some(debtor => debtor.id === item.debtorId)) {
    throw new Error('That debtor no longer exists. Choose another debtor.');
  }
}

/**
 * Posts every due automation in ONE cloud transaction: each missed month
 * backdated, current month only once its day arrives. Idempotent — a second
 * run immediately after posts nothing. Skips (never deletes) schedules whose
 * category, investment, or debtor vanished.
 */
export async function runRecurringSchedules(today?: string): Promise<RunSummary> {
  const owner = requireCloudUser();
  const now = today ?? new Date().toISOString().slice(0, 10);
  return mutateCloudData(draft => {
    requireCloudUser(owner);
    const posted: PostedEntry[] = [];
    const skipped: SkippedEntry[] = [];
    for (const schedule of draft.recurringSchedules ?? []) {
      const months = dueMonths(schedule, now);
      if (!months.length) continue;
      const label = labelFor(draft, schedule);
      if (!label) {
        skipped.push({
          scheduleId: schedule.id,
          label: fallbackLabel(schedule),
          reason: 'Its category, investment, or debtor was deleted.',
        });
        continue;
      }
      for (const month of months) {
        const date = scheduledDate(schedule.dayOfMonth, month);
        postOne(draft, owner, schedule, date);
        posted.push({scheduleId: schedule.id, target: schedule.target, label, date, amount: schedule.amount});
      }
      schedule.lastPostedMonth = months[months.length - 1];
    }
    return {posted, skipped};
  });
}

function labelFor(draft: CloudData, schedule: RecurringSchedule): string | null {
  if (schedule.target === 'expense') {
    const category = draft.categories.find(item => item.id === schedule.categoryId);
    return category ? `${schedule.title} → ${category.name}` : null;
  }
  if (schedule.target === 'investment') {
    const investment = (draft.investments ?? []).find(item => item.id === schedule.investmentId);
    return investment ? `SIP → ${investment.name}` : null;
  }
  const debtor = draft.debtors.find(item => item.id === schedule.debtorId);
  return debtor ? `${schedule.debtType} → ${debtor.title}` : null;
}

function fallbackLabel(schedule: RecurringSchedule): string {
  return schedule.target === 'expense' ? schedule.title : schedule.target === 'investment' ? 'Investment' : 'Debt';
}

function postOne(draft: CloudData, owner: string, schedule: RecurringSchedule, date: string) {
  if (schedule.target === 'expense') {
    draft.expenses.push({
      id: nanoid(24),
      userId: owner,
      title: schedule.title,
      amount: schedule.amount,
      description: schedule.description,
      categoryId: schedule.categoryId,
      date,
    });
    return;
  }
  if (schedule.target === 'investment') {
    const investment = (draft.investments ?? []).find(item => item.id === schedule.investmentId);
    if (!investment) throw new Error('That investment no longer exists. Choose another investment.');
    investment.flows.push({id: nanoid(24), date, type: 'contribution', amount: schedule.amount});
    investmentBackupSchema.parse(investment);
    return;
  }
  draft.debts.push({
    id: nanoid(24),
    userId: owner,
    amount: schedule.amount,
    description: schedule.description,
    debtorId: schedule.debtorId,
    date,
    type: schedule.debtType,
  });
}
