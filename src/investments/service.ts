import {nanoid} from 'nanoid';
import {mutateCloudData, requireCloudUser} from '../cloud/records';
import {investmentBackupSchema, localDate, type Investment, type InvestmentFlow, type MonthlyValuation} from './model';

export async function saveInvestment(input: Pick<Investment, 'name' | 'type' | 'startDate' | 'reviewDay' | 'reminderEnabled'>, id?: string) {
  const owner = requireCloudUser();
  const key = id ?? nanoid(24);
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    const items = draft.investments ??= [];
    const existing = items.find(i => i.id === key);
    if (id && !existing) throw new Error('This investment was removed. Refresh and try again.');
    const item = investmentBackupSchema.parse({...existing, ...input, id: key, flows: existing?.flows ?? [], valuations: existing?.valuations ?? []});
    if (item.startDate > localDate()) throw new Error('Start date cannot be in the future.');
    const record = {...item, userId: owner};
    if (existing) items[items.indexOf(existing)] = record;
    else items.push(record);
  });
  return key;
}
export async function deleteInvestment(id: string) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    draft.investments = (draft.investments ?? []).filter(i => i.id !== id);
  });
}
export async function saveInvestmentEntry(id: string, entry: InvestmentFlow | MonthlyValuation) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    const item = draft.investments?.find(i => i.id === id);
    if (!item) throw new Error('Investment no longer exists.');
    if (entry.date > localDate()) throw new Error('Entries cannot be dated in the future.');
    if ('month' in entry) item.valuations = [...item.valuations.filter(v => v.month !== entry.month), entry];
    else item.flows = [...item.flows.filter(f => f.id !== entry.id), entry];
    investmentBackupSchema.parse(item);
  });
}
export async function deleteInvestmentEntry(id: string, entryId: string, valuation: boolean) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    const item = draft.investments?.find(i => i.id === id);
    if (!item) throw new Error('Investment no longer exists.');
    if (valuation) item.valuations = item.valuations.filter(v => v.month !== entryId);
    else item.flows = item.flows.filter(f => f.id !== entryId);
  });
}
