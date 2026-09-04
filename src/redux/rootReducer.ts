import {combineReducers, type UnknownAction} from 'redux';
import userOnboardingReducer from './slice/isOnboardedSlice';
import currencyDataReducer from './slice/currencyDataSlice';
import userNameReducer from './slice/userNameSlice';
import userIdReducer from './slice/userIdSlice';
import categoryReducer from './slice/categoryDataSlice';
import expenseReducer from './slice/expenseDataSlice';
import debtorReducer from './slice/debtorDataSlice';
import debtReducer from './slice/debtDataSlice';
import allDataReducer from './slice/allDataSlice';
import individualDebtorReducer from './slice/IndividualDebtorSlice';
import monthSelectionReducer from './slice/monthSelectionSlice';
import budgetReducer from './slice/budgetDataSlice';

const combinedReducer = combineReducers({
  userOnboarding: userOnboardingReducer,
  currencyData: currencyDataReducer,
  userName: userNameReducer,
  userId: userIdReducer,
  category: categoryReducer,
  expense: expenseReducer,
  debtor: debtorReducer,
  debt: debtReducer,
  allData: allDataReducer,
  individualDebtor: individualDebtorReducer,
  monthSelection: monthSelectionReducer,
  budget: budgetReducer,
});

export type RootState = ReturnType<typeof combinedReducer>;

// Late responses from a signed-out account must never repopulate its data.
const pending = new Set<string>();
const discarded = new Set<string>();
const rootReducer = (state: RootState | undefined, action: UnknownAction): RootState => {
  if (action.type === 'cloud/reset') {
    for (const id of pending) discarded.add(id);
    pending.clear();
    return combinedReducer(undefined, action);
  }
  const requestId = (action.meta as {requestId?: string} | undefined)?.requestId;
  if (requestId) {
    if (action.type.endsWith('/pending')) pending.add(requestId);
    else if (action.type.endsWith('/fulfilled') || action.type.endsWith('/rejected')) {
      pending.delete(requestId);
      if (discarded.delete(requestId)) return state ?? combinedReducer(undefined, {type: '@@init'});
    }
  }
  return combinedReducer(state, action);
};

export default rootReducer;
