import StorageService from './asyncStorageService';

const SHOW_BUDGET_PROGRESS_KEY = 'showBudgetProgress';

export const getShowBudgetProgress = (): boolean => {
  if (!StorageService.contains(SHOW_BUDGET_PROGRESS_KEY)) {
    return true;
  }
  return StorageService.getBoolean(SHOW_BUDGET_PROGRESS_KEY);
};

export const setShowBudgetProgress = (visible: boolean): void => {
  StorageService.setBoolean(SHOW_BUDGET_PROGRESS_KEY, visible);
};
