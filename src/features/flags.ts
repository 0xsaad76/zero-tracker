import {useEffect, useState} from 'react';
import StorageService, {storage} from '../utils/asyncStorageService';

/**
 * Optional parts of the app the owner can switch off in Settings. A switched
 * off feature is hidden, not deleted: its cloud records stay untouched and
 * reappear when it is switched back on. Expenses, categories and reports are
 * the core and cannot be switched off.
 */
export const FEATURE_KEYS = ['income', 'limits', 'automations', 'debts', 'investing', 'trading'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureFlags = Record<FeatureKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  income: true,
  limits: true,
  automations: true,
  debts: true,
  investing: true,
  trading: true,
};

export const FEATURE_FLAGS_KEY = 'featureFlags';

/** Unknown keys are dropped and missing ones default to on, so old backups and newer builds stay compatible. */
export const normalizeFeatureFlags = (value: unknown): FeatureFlags => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const flags = {...DEFAULT_FEATURE_FLAGS};
  for (const key of FEATURE_KEYS) {
    if (typeof source[key] === 'boolean') flags[key] = source[key];
  }
  return flags;
};

export const getFeatureFlags = (): FeatureFlags => {
  const saved = StorageService.getItemSync(FEATURE_FLAGS_KEY);
  if (!saved) return {...DEFAULT_FEATURE_FLAGS};
  try {
    return normalizeFeatureFlags(JSON.parse(saved));
  } catch {
    return {...DEFAULT_FEATURE_FLAGS};
  }
};

export const setFeatureFlags = (flags: unknown): void => {
  StorageService.setItemSync(FEATURE_FLAGS_KEY, JSON.stringify(normalizeFeatureFlags(flags)));
};

export const isFeatureEnabled = (key: FeatureKey): boolean => getFeatureFlags()[key];

/** Live view of the switches: re-renders when Settings (or a cloud restore) changes them. */
export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(getFeatureFlags);
  useEffect(() => {
    // A change may have landed between the first render and this subscription.
    setFlags(getFeatureFlags());
    const listener = storage.addOnValueChangedListener(key => {
      if (key === FEATURE_FLAGS_KEY) setFlags(getFeatureFlags());
    });
    return () => listener.remove();
  }, []);
  return flags;
}
