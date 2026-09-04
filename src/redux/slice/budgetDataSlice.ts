import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {RootState} from '../rootReducer';
import {BudgetData, getBudgetsByMonth} from '../../cloud/budgets';
import {selectUserId} from './userIdSlice';

interface BudgetState {
  budgets: BudgetData[];
  isLoading: boolean;
  error: string | null;
  yearMonth: string | null;
  requestId: string | null;
}

const initialState: BudgetState = {
  budgets: [],
  isLoading: false,
  error: null,
  yearMonth: null,
  requestId: null,
};

export const fetchBudgetsByMonth = createAsyncThunk<BudgetData[], string, {state: RootState}>(
  'budget/fetchByMonth',
  async (yearMonth: string, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      const budgets = await getBudgetsByMonth(userId, yearMonth);
      return budgets;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch budgets');
    }
  },
);

const budgetDataSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchBudgetsByMonth.pending, (state, action) => {
        state.isLoading = true;
        state.error = null;
        state.requestId = action.meta.requestId;
      })
      .addCase(fetchBudgetsByMonth.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          return;
        }
        state.isLoading = false;
        state.error = null;
        state.budgets = action.payload;
        state.yearMonth = action.meta.arg;
        state.requestId = null;
      })
      .addCase(fetchBudgetsByMonth.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          return;
        }
        state.isLoading = false;
        state.error = action.payload as string;
        state.requestId = null;
      });
  },
});

export const selectCurrentBudget = (state: RootState) => findBudget(state.budget.budgets, 'monthly');

export const selectOverallWeeklyBudget = (state: RootState) => findBudget(state.budget.budgets, 'weekly');

export const selectBudgets = (state: RootState) => state.budget.budgets;
export const selectBudgetMonth = (state: RootState) => state.budget.yearMonth;
export const selectBudgetLoading = (state: RootState) => state.budget.isLoading;
export const selectBudgetError = (state: RootState) => state.budget.error;

export const findBudget = (
  budgets: BudgetData[],
  budgetType: BudgetData['budgetType'],
  categoryId: string = '',
): BudgetData | null => {
  const matches = budgets
    .filter(
      b => b.budgetType === budgetType && b.categoryId === categoryId && Number.isFinite(b.amount) && b.amount > 0,
    )
    .sort((a, b) => b.month.localeCompare(a.month));
  if (budgetType === 'monthly') {
    return (
      matches.find(b => !b.month.startsWith('recurring')) ?? matches.find(b => b.month.startsWith('recurring')) ?? null
    );
  }
  return matches[0] ?? null;
};

export default budgetDataSlice.reducer;
