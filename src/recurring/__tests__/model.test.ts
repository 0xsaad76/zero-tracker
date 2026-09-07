import {dueMonths, recurringScheduleSchema, scheduledDate} from '../model';

const base = {
  id: 's1',
  dayOfMonth: 5,
  amount: 5000,
  paused: false as const,
  startMonth: '2026-06',
  lastPostedMonth: null as string | null,
};

it('clamps the posting day to short months', () => {
  expect(scheduledDate(31, '2026-02')).toBe('2026-02-28');
  expect(scheduledDate(31, '2026-04')).toBe('2026-04-30');
  expect(scheduledDate(5, '2026-09')).toBe('2026-09-05');
});

it('owes every missed month plus the current one once its day arrives', () => {
  expect(dueMonths({...base}, '2026-09-10')).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
});

it('holds the current month until its day arrives', () => {
  expect(dueMonths({...base, lastPostedMonth: '2026-08'}, '2026-09-03')).toEqual([]);
  expect(dueMonths({...base, lastPostedMonth: '2026-08'}, '2026-09-05')).toEqual(['2026-09']);
});

it('owes nothing when paused or fully posted', () => {
  expect(dueMonths({...base, paused: true}, '2026-09-10')).toEqual([]);
  expect(dueMonths({...base, lastPostedMonth: '2026-09'}, '2026-09-10')).toEqual([]);
  expect(dueMonths({...base, startMonth: '2026-10'}, '2026-09-10')).toEqual([]);
});

it('validates each target payload', () => {
  expect(recurringScheduleSchema.safeParse({...base, target: 'expense', categoryId: 'c', title: '  '}).success).toBe(
    false,
  );
  expect(recurringScheduleSchema.safeParse({...base, target: 'investment', investmentId: 'i'}).success).toBe(true);
  expect(recurringScheduleSchema.safeParse({...base, target: 'debt', debtorId: 'd', debtType: 'Lend'}).success).toBe(
    true,
  );
  expect(recurringScheduleSchema.safeParse({...base, target: 'debt', debtorId: 'd', debtType: 'X'}).success).toBe(
    false,
  );
});
