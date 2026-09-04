import {configureStore} from '@reduxjs/toolkit';
import rootReducer from '../src/redux/rootReducer';
import {fetchExpensesByMonth} from '../src/redux/slice/expenseDataSlice';
import {getAllExpensesByMonth} from '../src/cloud';
import type {ExpenseWithCategory} from '../src/cloud';

jest.mock('../src/watermelondb/database', () => ({database: {}}));
jest.mock('../src/cloud', () => ({getAllExpensesByMonth: jest.fn()}));

it('returning to a cached month supersedes a slow request for another month', async () => {
  const store = configureStore({reducer: rootReducer});
  const fetchMonth = jest.mocked(getAllExpensesByMonth);
  fetchMonth.mockResolvedValueOnce([]);
  await store.dispatch(fetchExpensesByMonth('2026-09'));
  let finishAugust!: (expenses: ExpenseWithCategory[]) => void;
  fetchMonth.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finishAugust = resolve;
      }),
  );
  const august = store.dispatch(fetchExpensesByMonth('2026-08'));
  fetchMonth.mockResolvedValueOnce([]);
  await store.dispatch(fetchExpensesByMonth('2026-09'));
  finishAugust([]);
  await august;
  expect(fetchMonth).toHaveBeenCalledTimes(3);
  expect(store.getState().expense.cachedYearMonth).toBe('2026-09');
});

it('ignores an old account response arriving after cloud/reset', async () => {
  const store = configureStore({reducer: rootReducer});
  let finish!: (expenses: ExpenseWithCategory[]) => void;
  jest.mocked(getAllExpensesByMonth).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const request = store.dispatch(fetchExpensesByMonth('2026-09'));
  store.dispatch({type: 'cloud/reset'});
  finish([
    {id: 'old-private-record', userId: 'old', title: 'Private', amount: 20, categoryId: 'food', date: '2026-09-01'},
  ]);
  await request;
  expect(store.getState().expense.ids).toEqual([]);
  expect(store.getState().expense.cachedYearMonth).toBeNull();
});
