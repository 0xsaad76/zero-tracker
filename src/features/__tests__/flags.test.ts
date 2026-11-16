import {
  DEFAULT_FEATURE_FLAGS,
  getFeatureFlags,
  isFeatureEnabled,
  normalizeFeatureFlags,
  setFeatureFlags,
} from '../flags';
import StorageService from '../../utils/asyncStorageService';

describe('feature flags', () => {
  beforeEach(() => StorageService.clearSync());

  it('defaults every optional feature to on', () => {
    expect(getFeatureFlags()).toEqual(DEFAULT_FEATURE_FLAGS);
    expect(Object.values(DEFAULT_FEATURE_FLAGS).every(Boolean)).toBe(true);
  });

  it('keeps known booleans, defaults missing keys, and drops everything else', () => {
    expect(normalizeFeatureFlags({trading: false, debts: 'no', unknown: false})).toEqual({
      ...DEFAULT_FEATURE_FLAGS,
      trading: false,
    });
    expect(normalizeFeatureFlags(null)).toEqual(DEFAULT_FEATURE_FLAGS);
    expect(normalizeFeatureFlags('trading')).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('persists a change and reads it back', () => {
    setFeatureFlags({...DEFAULT_FEATURE_FLAGS, investing: false});
    expect(isFeatureEnabled('investing')).toBe(false);
    expect(isFeatureEnabled('income')).toBe(true);
    // An empty object resets to defaults: used when a cloud account has no saved switches.
    setFeatureFlags({});
    expect(getFeatureFlags()).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('survives corrupt storage', () => {
    StorageService.setItemSync('featureFlags', '{not json');
    expect(getFeatureFlags()).toEqual(DEFAULT_FEATURE_FLAGS);
  });
});
