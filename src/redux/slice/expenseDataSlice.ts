import {createAsyncThunk, createEntityAdapter, createSlice} from '@reduxjs/toolkit';
import {RootState} from '../rootReducer';
import {
  ExpenseWithCategory,
  getAllExpensesByUserIdWithCategory,
  getAllExpensesByMonth,
  getAllExpensesByDate,
  getAllExpensesByDateRange,
  getAllExpensesByCategoryAndMonth,
} from '../../cloud';
import {selectUserId} from './userIdSlice';

const expensesAdapter = createEntityAdapter<ExpenseWithCategory>();

const initialState = expensesAdapter.getInitialState({
  isLoading: false,
  error: null as string | null,
  cachedYearMonth: null as string | null,
  filteredExpenses: [] as ExpenseWithCategory[],
  filterKey: null as string | null,
  filteredLoading: false,
  filteredError: null as string | null,
  weeklyExpenses: [] as ExpenseWithCategory[],
  weeklyKey: null as string | null,
  weeklyRequestId: null as string | null,
  weeklyRequestKey: null as string | null,
  weeklyLoading: false,
  weeklyError: null as string | null,
  weeklyRevision: 0,
  requestId: null as string | null,
});

export const fetchExpenses = createAsyncThunk<ExpenseWithCategory[], void, {state: RootState}>(
  'expense/fetchAll',
  async (_, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      const expenses = await getAllExpensesByUserIdWithCategory(userId);
      return expenses;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch expenses');
    }
  },
);

export const fetchExpensesByMonth = createAsyncThunk<
  {expenses: ExpenseWithCategory[]; yearMonth: string},
  string,
  {state: RootState}
>(
  'expense/fetchByMonth',
  async (yearMonth: string, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      const expenses = await getAllExpensesByMonth(userId, yearMonth);
      return {expenses, yearMonth};
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch expenses');
    }
  },
  {
    condition: (yearMonth, {getState}) => {
      const state = getState().expense;
      // Returning to a cached month must supersede an in-flight request for another month.
      return state.cachedYearMonth !== yearMonth || state.requestId !== null;
    },
  },
);

export const fetchEverydayExpenses = createAsyncThunk<ExpenseWithCategory[], string, {state: RootState}>(
  'expense/fetchByDate',
  async (date: string, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      const expenses = await getAllExpensesByDate(userId, date);
      return expenses;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch everyday expenses');
    }
  },
);

export const fetchExpensesByCategory = createAsyncThunk<
  ExpenseWithCategory[],
  {categoryId: string; yearMonth: string},
  {state: RootState}
>('expense/fetchByCategory', async ({categoryId, yearMonth}, {getState, rejectWithValue}) => {
  try {
    const userId = selectUserId(getState());
    const expenses = await getAllExpensesByCategoryAndMonth(userId, categoryId, yearMonth);
    return expenses;
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch category expenses');
  }
});

export const fetchExpensesByDateRange = createAsyncThunk<
  {expenses: ExpenseWithCategory[]; rangeKey: string},
  {startDate: string; endDate: string},
  {state: RootState}
>(
  'expense/fetchByDateRange',
  async ({startDate, endDate}, {getState, rejectWithValue}) => {
    try {
      const userId = selectUserId(getState());
      const expenses = await getAllExpensesByDateRange(userId, startDate, endDate);
      return {expenses, rangeKey: `${startDate}:${endDate}`};
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch weekly expenses');
    }
  },
  {
    condition: ({startDate, endDate}, {getState}) => {
      const state = getState().expense;
      const key = `${startDate}:${endDate}`;
      return (
        (state.weeklyKey !== key || state.weeklyLoading) && !(state.weeklyLoading && state.weeklyRequestKey === key)
      );
    },
  },
);

const expenseDataSlice = createSlice({
  name: 'expense',
  initialState,
  reducers: {
    invalidateExpenseCache: state => {
      state.cachedYearMonth = null;
      state.weeklyKey = null;
      state.weeklyRequestId = null;
      state.weeklyRequestKey = null;
      state.weeklyLoading = false;
      state.weeklyRevision += 1;
      state.requestId = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchExpenses.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchExpenses.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          return;
        }
        state.requestId = null;
        state.isLoading = false;
        state.error = null;
        state.cachedYearMonth = null;
        expensesAdapter.setAll(state, action.payload);
      })
      .addCase(fetchExpenses.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          return;
        }
        state.requestId = null;
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchExpensesByMonth.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchExpensesByMonth.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          return;
        }
        state.requestId = null;
        state.isLoading = false;
        state.error = null;
        state.cachedYearMonth = action.payload.yearMonth;
        expensesAdapter.setAll(state, action.payload.expenses);
      })
      .addCase(fetchExpensesByMonth.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          return;
        }
        state.requestId = null;
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchEverydayExpenses.pending, state => {
        state.filteredLoading = true;
        state.filteredError = null;
      })
      .addCase(fetchEverydayExpenses.fulfilled, (state, action) => {
        state.filteredLoading = false;
        state.filteredError = null;
        state.filterKey = action.meta.arg;
        state.filteredExpenses = action.payload;
      })
      .addCase(fetchEverydayExpenses.rejected, (state, action) => {
        state.filteredLoading = false;
        state.filteredError = action.payload as string;
      })
      .addCase(fetchExpensesByCategory.pending, state => {
        state.filteredLoading = true;
        state.filteredError = null;
      })
      .addCase(fetchExpensesByCategory.fulfilled, (state, action) => {
        state.filteredLoading = false;
        state.filteredError = null;
        state.filterKey = `${action.meta.arg.categoryId}:${action.meta.arg.yearMonth}`;
        state.filteredExpenses = action.payload;
      })
      .addCase(fetchExpensesByCategory.rejected, (state, action) => {
        state.filteredLoading = false;
        state.filteredError = action.payload as string;
      })
      .addCase(fetchExpensesByDateRange.pending, (state, action) => {
        state.weeklyLoading = true;
        state.weeklyError = null;
        state.weeklyRequestId = action.meta.requestId;
        state.weeklyRequestKey = `${action.meta.arg.startDate}:${action.meta.arg.endDate}`;
      })
      .addCase(fetchExpensesByDateRange.fulfilled, (state, action) => {
        if (state.weeklyRequestId !== action.meta.requestId) {
          return;
        }
        state.weeklyExpenses = action.payload.expenses;
        state.weeklyKey = action.payload.rangeKey;
        state.weeklyLoading = false;
        state.weeklyRequestId = null;
      })
      .addCase(fetchExpensesByDateRange.rejected, (state, action) => {
        if (state.weeklyRequestId !== action.meta.requestId) {
          return;
        }
        state.weeklyLoading = false;
        state.weeklyRequestId = null;
        state.weeklyError = action.payload as string;
      });
  },
});

const expenseSelectors = expensesAdapter.getSelectors<RootState>(state => state.expense);

export const selectExpenseData = expenseSelectors.selectAll;
export const selectExpenseDataById = expenseSelectors.selectById;
export const selectExpenseIds = expenseSelectors.selectIds;
export const selectExpenseEntities = expenseSelectors.selectEntities;
export const selectExpenseTotal = expenseSelectors.selectTotal;

export const selectExpenseLoading = (state: RootState) => state.expense.isLoading;
export const selectExpenseError = (state: RootState) => state.expense.error;
export const selectCachedYearMonth = (state: RootState) => state.expense.cachedYearMonth;

export const selectFilteredExpenses = (state: RootState) => state.expense.filteredExpenses;
export const selectFilteredExpenseIds = (state: RootState) => state.expense.filteredExpenses.map(e => e.id);
export const selectFilteredExpenseLoading = (state: RootState) => state.expense.filteredLoading;
export const selectFilteredExpenseError = (state: RootState) => state.expense.filteredError;
export const selectFilterKey = (state: RootState) => state.expense.filterKey;
export const selectWeeklyExpenses = (state: RootState) => state.expense.weeklyExpenses;
export const selectWeeklyKey = (state: RootState) => state.expense.weeklyKey;
export const selectWeeklyLoading = (state: RootState) => state.expense.weeklyLoading;
export const selectWeeklyError = (state: RootState) => state.expense.weeklyError;
export const selectWeeklyRevision = (state: RootState) => state.expense.weeklyRevision;

export const {invalidateExpenseCache} = expenseDataSlice.actions;

export default expenseDataSlice.reducer;
