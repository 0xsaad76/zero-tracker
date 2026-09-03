import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {RootState} from '../rootReducer';
import {BudgetData, getBudgetsByMonth} from '../../watermelondb/services/budgetService';
import {selectUserId} from './userIdSlice';

interface BudgetState {
  budgets: BudgetData[];
  isLoading: boolean;
  error: string | null;
}

const initialState: BudgetState = {
  budgets: [],
  isLoading: false,
  error: null,
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
      .addCase(fetchBudgetsByMonth.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBudgetsByMonth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.budgets = action.payload;
      })
      .addCase(fetchBudgetsByMonth.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const selectCurrentBudget = (state: RootState) => {
  const budgets = state.budget.budgets;
  const monthlyBudgets = budgets.filter(b => b.budgetType === 'monthly');
  const monthSpecific = monthlyBudgets.find(b => !b.month.startsWith('recurring'));
  return monthSpecific ?? monthlyBudgets.find(b => b.month.startsWith('recurring')) ?? null;
};

export default budgetDataSlice.reducer;
