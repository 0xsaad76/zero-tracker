import {useCallback, useEffect, useMemo, useState} from 'react';
import {AppState} from 'react-native';
import useThemeColors from '../../hooks/useThemeColors';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {
  fetchExpensesByMonth,
  invalidateExpenseCache,
  selectExpenseData,
  fetchExpensesByDateRange,
  selectWeeklyExpenses,
  selectWeeklyKey,
  selectWeeklyError,
  selectWeeklyRevision,
  selectCachedYearMonth,
  selectExpenseError,
} from '../../redux/slice/expenseDataSlice';
import {selectMonthIndex, selectYear, setMonthSelection} from '../../redux/slice/monthSelectionSlice';
import {selectUserName} from '../../redux/slice/userNameSlice';
import {fetchUserData, selectUserId} from '../../redux/slice/userIdSlice';
import {fetchCurrency} from '../../redux/slice/currencyDataSlice';
import {fetchCategories, selectActiveCategories} from '../../redux/slice/categoryDataSlice';
import {
  fetchBudgetsByMonth,
  selectBudgets,
  selectBudgetMonth,
  selectBudgetError,
} from '../../redux/slice/budgetDataSlice';
import {
  getCurrentYear,
  getMonthNumber,
  getMonthNames,
  getDaysInMonth,
  sortByDateDesc,
  formatDate,
} from '../../utils/dateUtils';
import {ExpenseData as Expense} from '../../cloud';
import {loadAvailableYears} from '../../utils/availableYearsCache';
import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {getWeekDateRange} from '../../utils/budgetTracking';
import {getWeekStartDay} from '../../utils/weekStart';
import {getShowBudgetProgress} from '../../utils/budgetProgressPreference';

const useHome = () => {
  const colors = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([getCurrentYear()]);
  const [showBudgetProgress, setShowBudgetProgress] = useState(getShowBudgetProgress);
  const [todayDate, setTodayDate] = useState(() => formatDate(new Date(), 'YYYY-MM-DD'));
  const [weekStart, setWeekStart] = useState(getWeekStartDay);
  const focused = useIsFocused();

  const dispatch = useAppDispatch();

  const selectedMonthIndex = useAppSelector(selectMonthIndex);
  const selectedYear = useAppSelector(selectYear);

  const allTransactions = useAppSelector(selectExpenseData);
  const weeklyTransactions = useAppSelector(selectWeeklyExpenses);
  const weeklyKey = useAppSelector(selectWeeklyKey);
  const weeklyError = useAppSelector(selectWeeklyError);
  const weeklyRevision = useAppSelector(selectWeeklyRevision);
  const cachedMonth = useAppSelector(selectCachedYearMonth);
  const monthlyError = useAppSelector(selectExpenseError);
  const budgetMonth = useAppSelector(selectBudgetMonth);
  const budgetError = useAppSelector(selectBudgetError);
  const sortedTransactions = useMemo(() => sortByDateDesc(allTransactions as Expense[]), [allTransactions]);

  const userName = useAppSelector(selectUserName);
  const userId = useAppSelector(selectUserId);

  const selectedMonthName = getMonthNames()[selectedMonthIndex];
  const yearMonth = `${selectedYear}-${getMonthNumber(selectedMonthName)}`;
  const isCurrentMonth = yearMonth === todayDate.slice(0, 7);
  const weekAnchor = useMemo(
    () => (isCurrentMonth ? todayDate : new Date(selectedYear, selectedMonthIndex + 1, 0)),
    [isCurrentMonth, todayDate, selectedMonthIndex, selectedYear],
  );
  const weekRange = useMemo(() => getWeekDateRange(weekAnchor, weekStart), [weekAnchor, weekStart]);

  useFocusEffect(
    useCallback(() => {
      const updateCalendar = () => {
        setTodayDate(formatDate(new Date(), 'YYYY-MM-DD'));
        setWeekStart(getWeekStartDay());
        setShowBudgetProgress(getShowBudgetProgress());
      };
      updateCalendar();
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') {
          updateCalendar();
        }
      });
      const timer = setInterval(updateCalendar, 60_000);
      return () => {
        subscription.remove();
        clearInterval(timer);
      };
    }, []),
  );

  useEffect(() => {
    // Auth bootstrap already hydrates this from its cloud snapshot. Keep this
    // fallback for onboarding/legacy routes that can mount without it.
    if (!userId) dispatch(fetchUserData());
  }, [dispatch, userId]);

  useEffect(() => {
    if (userId) {
      dispatch(fetchCurrency());
      dispatch(fetchCategories());
      loadAvailableYears(userId).then(years => {
        if (years.length > 0) {
          setAvailableYears(years);
        }
      });
    }
  }, [dispatch, userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        dispatch(invalidateExpenseCache());
        dispatch(fetchExpensesByMonth(yearMonth));
        dispatch(fetchBudgetsByMonth(yearMonth));
      }
    }, [dispatch, userId, yearMonth]),
  );

  // Invalidations include swipe-delete and edits while Home remains mounted.
  // Depend on the revision, not request state, so a failure cannot cause a retry loop.
  useEffect(() => {
    if (focused && userId) {
      dispatch(fetchExpensesByDateRange(weekRange));
    }
  }, [dispatch, focused, userId, weekRange, weeklyRevision]);

  const budgets = useAppSelector(selectBudgets);
  const categories = useAppSelector(selectActiveCategories);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  useEffect(() => {
    if (!refreshing) return;

    dispatch(invalidateExpenseCache());
    Promise.all([
      dispatch(fetchExpensesByMonth(yearMonth)),
      dispatch(fetchExpensesByDateRange(weekRange)),
      dispatch(fetchBudgetsByMonth(yearMonth)),
    ]).finally(() => setRefreshing(false));
  }, [dispatch, refreshing, weekRange, yearMonth]);

  const {totalSpent, transactionCount, todayTotal} = useMemo(() => {
    const total = (allTransactions ?? []).reduce((sum: number, t: Expense) => sum + t.amount, 0);
    const count = (allTransactions ?? []).length;

    const today = isCurrentMonth
      ? (allTransactions ?? []).reduce(
          (sum: number, t: Expense) => (t.date.startsWith(todayDate) ? sum + t.amount : sum),
          0,
        )
      : 0;

    return {totalSpent: total, transactionCount: count, todayTotal: today};
  }, [allTransactions, isCurrentMonth, todayDate]);

  const daysInMonth = useMemo(() => getDaysInMonth(selectedYear, selectedMonthName), [selectedYear, selectedMonthName]);

  const handleMonthYearSelect = useCallback(
    (monthIndex: number, year: number) => {
      dispatch(setMonthSelection({monthIndex, year}));
    },
    [dispatch],
  );

  return {
    colors,
    refreshing,
    allTransactions,
    userName,
    userId,
    onRefresh,
    sortedTransactions,
    selectedYear,
    selectedMonthIndex,
    selectedMonthName,
    yearMonth,
    availableYears,
    totalSpent,
    transactionCount,
    todayTotal,
    isCurrentMonth,
    daysInMonth,
    budgets,
    categories,
    weeklyTransactions,
    weekRange,
    weeklyReady: weeklyKey === `${weekRange.startDate}:${weekRange.endDate}` && budgetMonth === yearMonth,
    monthlyReady: cachedMonth === yearMonth && budgetMonth === yearMonth,
    weeklyError: weeklyError ?? budgetError,
    monthlyError: monthlyError ?? budgetError,
    showBudgetProgress,
    handleMonthYearSelect,
  };
};

export default useHome;
