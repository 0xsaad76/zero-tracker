import {nanoid} from 'nanoid';
import {incomeSyncAvailable, mutateCloudData, requireCloudUser} from '../cloud/records';
import {incomeBackupSchema, type IncomeBackup} from './model';

// The read snapshot runs before this inside mutateCloudData, so the protocol
// is already negotiated. Without the v6 migration the server CHECK constraint
// would reject income rows with a generic connection error.
const assertIncomeSync = () => {
  if (!incomeSyncAvailable()) {
    throw new Error('Income needs a cloud update first. Apply the latest cloud migration, then reload.');
  }
};

export async function saveIncome(input: Omit<IncomeBackup, 'id'>, id?: string): Promise<string> {
  const owner = requireCloudUser();
  const key = id ?? nanoid(24);
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertIncomeSync();
    const item = {...incomeBackupSchema.parse({...input, id: key}), userId: owner};
    const items = (draft.incomes ??= []);
    const index = items.findIndex(income => income.id === key);
    if (id && index < 0) throw new Error('This income entry was removed. Reload and try again.');
    if (index >= 0) items[index] = item;
    else items.push(item);
  });
  return key;
}

export async function deleteIncome(id: string): Promise<void> {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertIncomeSync();
    draft.incomes = (draft.incomes ?? []).filter(income => income.id !== id);
  });
}
