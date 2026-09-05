import {nanoid} from 'nanoid';
import {mutateCloudData, requireCloudUser} from '../cloud/records';
import {
  investmentBackupSchema,
  investmentTypeRegistrySchema,
  investmentTypeSchema,
  localDate,
  resolveInvestmentTypes,
  type Investment,
  type InvestmentFlow,
  type InvestmentTypeRegistry,
  type MonthlyValuation,
} from './model';

const materializeTypeRegistry = (registry: InvestmentTypeRegistry | undefined, owner: string): InvestmentTypeRegistry =>
  investmentTypeRegistrySchema.parse({id: 'registry', userId: owner, items: resolveInvestmentTypes(registry)});

export async function saveInvestment(
  input: Pick<Investment, 'name' | 'type' | 'startDate' | 'reviewDay' | 'reminderEnabled'>,
  id?: string,
) {
  const owner = requireCloudUser();
  const key = id ?? nanoid(24);
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    const types = resolveInvestmentTypes(draft.investmentTypeRegistry);
    if (input.type && !types.some(type => type.id === input.type)) {
      throw new Error('That investment type no longer exists. Choose another type or No type.');
    }
    const items = (draft.investments ??= []);
    const existing = items.find(i => i.id === key);
    if (id && !existing) throw new Error('This investment was removed. Refresh and try again.');
    const item = investmentBackupSchema.parse({
      ...existing,
      ...input,
      id: key,
      flows: existing?.flows ?? [],
      valuations: existing?.valuations ?? [],
    });
    if (item.startDate > localDate()) throw new Error('Start date cannot be in the future.');
    const record = {...item, userId: owner};
    if (existing) items[items.indexOf(existing)] = record;
    else items.push(record);
  });
  return key;
}

export async function saveInvestmentType(name: string, id?: string) {
  const owner = requireCloudUser();
  const key = id ?? nanoid(24);
  return mutateCloudData(draft => {
    requireCloudUser(owner);
    const registry = materializeTypeRegistry(draft.investmentTypeRegistry, owner);
    const candidate = investmentTypeSchema.parse({id: key, name});
    const existing = registry.items.find(type => type.id === key);
    if (id && !existing) throw new Error('This investment type was removed. Refresh and try again.');
    if (registry.items.some(type => type.id !== key && type.name.toLowerCase() === candidate.name.toLowerCase())) {
      throw new Error('An investment type with this name already exists.');
    }
    if (existing) registry.items[registry.items.indexOf(existing)] = candidate;
    else {
      if (registry.items.length >= 100) throw new Error('You can keep up to 100 investment types.');
      registry.items.push(candidate);
    }
    draft.investmentTypeRegistry = investmentTypeRegistrySchema.parse(registry);
    return key;
  });
}

export async function deleteInvestmentType(id: string) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    const registry = materializeTypeRegistry(draft.investmentTypeRegistry, owner);
    if (!registry.items.some(type => type.id === id)) {
      throw new Error('This investment type was already removed.');
    }
    registry.items = registry.items.filter(type => type.id !== id);
    draft.investmentTypeRegistry = investmentTypeRegistrySchema.parse(registry);
    for (const investment of draft.investments ?? []) {
      if (investment.type === id) investment.type = null;
    }
  });
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
