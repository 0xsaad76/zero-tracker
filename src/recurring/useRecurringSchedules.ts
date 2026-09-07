import {useCallback, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {readCloudData} from '../cloud/records';
import type {RecurringSchedule, ScheduleTarget} from './model';

const refId = (schedule: RecurringSchedule): string =>
  schedule.target === 'expense'
    ? schedule.categoryId
    : schedule.target === 'investment'
      ? schedule.investmentId
      : schedule.debtorId;

/**
 * Schedules for one screen, reloaded every time the screen gains focus so a
 * run at launch or an edit elsewhere is always reflected. Silent on failure:
 * the section simply hides when there is nothing to show.
 */
export function useRecurringSchedules(target: ScheduleTarget) {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const data = await readCloudData();
      setSchedules(
        (data.recurringSchedules ?? [])
          .filter(schedule => schedule.target === target)
          .sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.id.localeCompare(b.id)),
      );
      const map = new Map<string, string>();
      if (target === 'expense') for (const category of data.categories) map.set(category.id, category.name);
      if (target === 'investment')
        for (const investment of data.investments ?? []) map.set(investment.id, investment.name);
      if (target === 'debt') for (const debtor of data.debtors) map.set(debtor.id, debtor.title);
      setNames(map);
    } catch {
      // Offline or signed out: keep whatever was last shown.
    }
  }, [target]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const nameOf = useCallback((schedule: RecurringSchedule) => names.get(refId(schedule)) ?? 'Removed', [names]);

  return {schedules, nameOf, reload: load};
}
