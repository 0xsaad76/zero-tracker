import {nanoid} from 'nanoid';
import {mutateCloudData, requireCloudUser, tradingSyncAvailable} from '../cloud/records';
import {
  localDate,
  resolveTradingPairs,
  resolveTradingStrategies,
  tradeBackupSchema,
  tradingBalanceRegistrySchema,
  tradingPairRegistrySchema,
  tradingPairSchema,
  tradingStrategyRegistrySchema,
  tradingStrategySchema,
  type Trade,
  type TradingBalanceRegistry,
  type TradingPairRegistry,
  type TradingStrategyRegistry,
} from './model';

const materializeStrategyRegistry = (
  registry: TradingStrategyRegistry | undefined,
  owner: string,
): TradingStrategyRegistry =>
  tradingStrategyRegistrySchema.parse({id: 'registry', userId: owner, items: resolveTradingStrategies(registry)});

const materializePairRegistry = (registry: TradingPairRegistry | undefined, owner: string): TradingPairRegistry =>
  tradingPairRegistrySchema.parse({id: 'registry', userId: owner, items: resolveTradingPairs(registry)});

const materializeBalanceRegistry = (
  registry: TradingBalanceRegistry | undefined,
  owner: string,
): TradingBalanceRegistry =>
  tradingBalanceRegistrySchema.parse({
    id: 'registry',
    userId: owner,
    items: (registry?.items ?? []).map(item => ({...item})),
  });

// The read snapshot runs before this inside mutateCloudData, so the protocol
// is already negotiated here. Without the v4 migration the server CHECK
// constraint would reject trading rows with a generic connection error.
const assertTradingSync = () => {
  if (!tradingSyncAvailable()) {
    throw new Error('Trading sync needs a cloud update first. Apply the latest cloud migration, then reload.');
  }
};

export async function saveTrade(input: Omit<Trade, 'id' | 'userId'>, id?: string) {
  const owner = requireCloudUser();
  const key = id ?? nanoid(24);
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertTradingSync();
    const strategies = resolveTradingStrategies(draft.tradingStrategyRegistry);
    const pairs = resolveTradingPairs(draft.tradingPairRegistry);
    if (!pairs.some(pair => pair.id === input.pair)) {
      throw new Error('That trading pair no longer exists. Choose another pair.');
    }
    if (!strategies.some(strategy => strategy.id === input.strategy)) {
      throw new Error('That strategy no longer exists. Choose another strategy.');
    }
    const items = (draft.trades ??= []);
    const existing = items.find(trade => trade.id === key);
    if (id && !existing) throw new Error('This trade was removed. Refresh and try again.');
    const item = tradeBackupSchema.parse({...existing, ...input, id: key});
    if (item.date > localDate()) throw new Error('Trade date cannot be in the future.');
    const record = {...item, userId: owner};
    if (existing) items[items.indexOf(existing)] = record;
    else items.push(record);
  });
  return key;
}

export async function deleteTrade(id: string) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertTradingSync();
    draft.trades = (draft.trades ?? []).filter(trade => trade.id !== id);
  });
}

export async function saveTradingStrategy(name: string, id?: string) {
  const owner = requireCloudUser();
  const key = id ?? nanoid(24);
  return mutateCloudData(draft => {
    requireCloudUser(owner);
    assertTradingSync();
    const registry = materializeStrategyRegistry(draft.tradingStrategyRegistry, owner);
    const candidate = tradingStrategySchema.parse({id: key, name});
    const existing = registry.items.find(strategy => strategy.id === key);
    if (id && !existing) throw new Error('This strategy was removed. Refresh and try again.');
    if (
      registry.items.some(
        strategy => strategy.id !== key && strategy.name.toLowerCase() === candidate.name.toLowerCase(),
      )
    ) {
      throw new Error('A strategy with this name already exists.');
    }
    if (existing) registry.items[registry.items.indexOf(existing)] = candidate;
    else {
      if (registry.items.length >= 100) throw new Error('You can keep up to 100 strategies.');
      registry.items.push(candidate);
    }
    draft.tradingStrategyRegistry = tradingStrategyRegistrySchema.parse(registry);
    return key;
  });
}

export async function deleteTradingStrategy(id: string) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertTradingSync();
    const registry = materializeStrategyRegistry(draft.tradingStrategyRegistry, owner);
    if (!registry.items.some(strategy => strategy.id === id)) {
      throw new Error('This strategy was already removed.');
    }
    const inUse = (draft.trades ?? []).filter(trade => trade.strategy === id).length;
    if (inUse > 0) {
      throw new Error(
        `${inUse} ${inUse === 1 ? 'trade still uses' : 'trades still use'} this strategy. Edit or delete those trades first so your history stays accurate.`,
      );
    }
    registry.items = registry.items.filter(strategy => strategy.id !== id);
    draft.tradingStrategyRegistry = tradingStrategyRegistrySchema.parse(registry);
  });
}

export async function saveTradingPair(name: string, id?: string) {
  const owner = requireCloudUser();
  const key = id ?? nanoid(24);
  return mutateCloudData(draft => {
    requireCloudUser(owner);
    assertTradingSync();
    const registry = materializePairRegistry(draft.tradingPairRegistry, owner);
    const candidate = tradingPairSchema.parse({id: key, name: name.toUpperCase()});
    const existing = registry.items.find(pair => pair.id === key);
    if (id && !existing) throw new Error('This pair was removed. Refresh and try again.');
    if (registry.items.some(pair => pair.id !== key && pair.name.toLowerCase() === candidate.name.toLowerCase())) {
      throw new Error('This pair already exists.');
    }
    if (existing) registry.items[registry.items.indexOf(existing)] = candidate;
    else {
      if (registry.items.length >= 100) throw new Error('You can keep up to 100 pairs.');
      registry.items.push(candidate);
    }
    draft.tradingPairRegistry = tradingPairRegistrySchema.parse(registry);
    return key;
  });
}

export async function deleteTradingPair(id: string) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertTradingSync();
    const registry = materializePairRegistry(draft.tradingPairRegistry, owner);
    if (!registry.items.some(pair => pair.id === id)) {
      throw new Error('This pair was already removed.');
    }
    if (registry.items.length <= 1) {
      throw new Error('Keep at least one trading pair.');
    }
    const inUse = (draft.trades ?? []).filter(trade => trade.pair === id).length;
    if (inUse > 0) {
      throw new Error(
        `${inUse} ${inUse === 1 ? 'trade still uses' : 'trades still use'} this pair. Edit or delete those trades first so your history stays accurate.`,
      );
    }
    registry.items = registry.items.filter(pair => pair.id !== id);
    draft.tradingPairRegistry = tradingPairRegistrySchema.parse(registry);
  });
}

export async function saveOpeningBalance(month: string, openingBalance: number) {
  const owner = requireCloudUser();
  await mutateCloudData(draft => {
    requireCloudUser(owner);
    assertTradingSync();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Enter a valid month (YYYY-MM).');
    if (month.slice(0, 7) > localDate().slice(0, 7))
      throw new Error('Opening balance cannot be set for a future month.');
    const registry = materializeBalanceRegistry(draft.tradingBalanceRegistry, owner);
    const candidate = {month, openingBalance};
    const parsed = tradingBalanceRegistrySchema.parse({
      id: 'registry',
      userId: owner,
      items: [...registry.items.filter(item => item.month !== month), candidate],
    });
    draft.tradingBalanceRegistry = parsed;
  });
}
