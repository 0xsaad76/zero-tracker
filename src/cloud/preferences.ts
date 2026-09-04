import type {ExportData} from '../backend/export/format';
import {mutateCloudData} from './records';
import {getBackupPreferences, restoreBackupPreferences} from '../utils/backupPreferences';

export async function updateCloudPreferences(patch: Partial<NonNullable<ExportData['preferences']>>): Promise<void> {
  const saved = await mutateCloudData(draft => {
    draft.preferences = {...(draft.preferences ?? getBackupPreferences()), ...patch};
    return draft.preferences;
  });
  restoreBackupPreferences(saved);
}
