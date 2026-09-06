import StorageService from './asyncStorageService';
import {setLocaleOverride} from './locale';
import {getWeekStartDay, setWeekStartDay} from './weekStart';
import {getShowBudgetProgress, setShowBudgetProgress} from './budgetProgressPreference';
import {getTradingCurrency, setTradingCurrency} from './tradingCurrency';
import type {ExportData} from '../backend/export/format';

// Explicit allowlist: never export Redux caches, OAuth credentials, account links, or diagnostics.
export const BACKUP_PREFERENCE_KEYS = [
  'themePreference',
  'user_locale_override',
  'weekStartDay',
  'showBudgetProgress',
  'tradingCurrency',
];

export const getBackupPreferences = (): NonNullable<ExportData['preferences']> => {
  const theme = StorageService.getItemSync('themePreference');
  return {
    theme: theme === 'light' || theme === 'dark' ? theme : 'system',
    locale: StorageService.getItemSync('user_locale_override'),
    weekStart: getWeekStartDay(),
    showBudgetProgress: getShowBudgetProgress(),
    tradingCurrency: getTradingCurrency(),
  };
};

export const restoreBackupPreferences = (preferences: ExportData['preferences']) => {
  if (!preferences) {
    return;
  }
  StorageService.setItemSync('themePreference', preferences.theme);
  setLocaleOverride(preferences.locale);
  setWeekStartDay(preferences.weekStart);
  setShowBudgetProgress(preferences.showBudgetProgress);
  if (preferences.tradingCurrency) setTradingCurrency(preferences.tradingCurrency);
};
