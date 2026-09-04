import React, {memo, useCallback, useMemo} from 'react';
import {ScrollView, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import PrimaryView from '../../components/atoms/PrimaryView';
import AppHeader from '../../components/atoms/AppHeader';
import PrimaryText from '../../components/atoms/PrimaryText';
import Icon from '../../components/atoms/Icons';
import {goBack} from '../../utils/navigationUtils';
import useThemeColors, {type Colors} from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {selectUserId} from '../../redux/slice/userIdSlice';
import {selectMonthIndex, selectYear} from '../../redux/slice/monthSelectionSlice';
import {selectCurrencyCode, selectCurrencySymbol} from '../../redux/slice/currencyDataSlice';
import {fetchCategories, selectActiveCategories} from '../../redux/slice/categoryDataSlice';
import {
  fetchBudgetsByMonth,
  findBudget,
  selectBudgets,
  selectBudgetMonth,
  selectBudgetLoading,
  selectBudgetError,
} from '../../redux/slice/budgetDataSlice';
import {
  deleteBudget,
  upsertBudget,
  type BudgetData,
  type BudgetPeriod,
} from '../../cloud/budgets';
import {formatDate, parseDate} from '../../utils/dateUtils';
import {getWeeklyRecurringKey} from '../../utils/budgetTracking';
import {getWeekStartDay} from '../../utils/weekStart';
import {hexToRgba} from '../../utils/colorUtils';
import {gs} from '../../styles/globalStyles';
import {appendErrorLog} from '../../utils/errorLog';

interface LimitRowProps {
  label: string;
  budget: BudgetData | null;
  colors: Colors;
  formatAmount: (amount: number) => string;
  onPress: () => void;
}

const LimitRow = memo(({label, budget, colors, formatAmount, onPress}: LimitRowProps) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <View style={[gs.rowBetweenCenter, gs.py10, gs.gap10]}>
      <PrimaryText size={13} weight="medium">
        {label}
      </PrimaryText>
      <View style={[gs.rowCenter, gs.gap6]}>
        <PrimaryText size={12} variant="number" color={budget ? colors.primaryText : colors.secondaryText}>
          {budget ? formatAmount(budget.amount) : '—'}
        </PrimaryText>
        <Icon name="chevron-right" size={14} color={colors.secondaryText} />
      </View>
    </View>
  </TouchableOpacity>
));

const SpendingLimitsScreen = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const dispatch = useAppDispatch();
  const userId = useAppSelector(selectUserId);
  const currencySymbol = useAppSelector(selectCurrencySymbol);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const categories = useAppSelector(selectActiveCategories);
  const budgets = useAppSelector(selectBudgets);
  const budgetMonth = useAppSelector(selectBudgetMonth);
  const loading = useAppSelector(selectBudgetLoading);
  const error = useAppSelector(selectBudgetError);
  const selectedYear = useAppSelector(selectYear);
  const selectedMonth = useAppSelector(selectMonthIndex);
  const yearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const monthLabel = formatDate(`${yearMonth}-01`, 'MMMM YYYY');

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        dispatch(fetchCategories());
        dispatch(fetchBudgetsByMonth(yearMonth));
      }
    }, [dispatch, userId, yearMonth]),
  );

  const refresh = useCallback(() => {
    dispatch(fetchBudgetsByMonth(yearMonth));
  }, [dispatch, yearMonth]);

  const openLimit = useCallback(
    (period: BudgetPeriod, categoryId: string = '', categoryName?: string) => {
      if (!userId || loading || error || budgetMonth !== yearMonth) {
        return;
      }
      const current = findBudget(budgets, period, categoryId);
      void SheetManager.show('budget-sheet', {
        payload: {
          currentAmount: current?.amount,
          currencySymbol,
          currencyCode,
          period,
          scopeLabel: categoryName ?? t('limits.overall'),
          monthLabel,
          isRecurring: period === 'weekly' || current?.month.startsWith('recurring') || false,
          onSave: async (amount: number, everyMonth: boolean) => {
            const periodKey =
              period === 'weekly'
                ? getWeeklyRecurringKey(
                    yearMonth === formatDate(new Date(), 'YYYY-MM')
                      ? new Date()
                      : parseDate(`${yearMonth}-01`).endOf('month'),
                    getWeekStartDay(),
                  )
                : everyMonth
                  ? `recurring:${yearMonth}`
                  : yearMonth;
            try {
              await upsertBudget(userId, amount, periodKey, period, categoryId);
              refresh();
            } catch (error) {
              appendErrorLog(error instanceof Error ? error : new Error(String(error)), false);
              throw error;
            }
          },
          onRemove: current
            ? async () => {
                try {
                  await deleteBudget(current.id);
                  refresh();
                } catch (error) {
                  appendErrorLog(error instanceof Error ? error : new Error(String(error)), false);
                  throw error;
                }
              }
            : undefined,
        },
      });
    },
    [budgets, budgetMonth, loading, error, currencyCode, currencySymbol, monthLabel, refresh, t, userId, yearMonth],
  );

  const overallMonthly = useMemo(() => findBudget(budgets, 'monthly'), [budgets]);
  const overallWeekly = useMemo(() => findBudget(budgets, 'weekly'), [budgets]);

  return (
    <PrimaryView colors={colors} useSidePadding={false}>
      <View style={[gs.px16, gs.mt10, gs.mb15]}>
        <AppHeader onPress={goBack} colors={colors} text={t('limits.title')} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[gs.px16, gs.pb80]}>
        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb10}>
          {t('limits.subtitle')}
        </PrimaryText>
        <PrimaryText size={12} weight="semibold" style={gs.mb10}>
          {monthLabel}
        </PrimaryText>

        {error ? (
          <TouchableOpacity accessibilityRole="button" onPress={refresh} style={gs.mb10}>
            <PrimaryText size={12} color={colors.accentOrange}>
              {t('limits.retryLoad')}
            </PrimaryText>
          </TouchableOpacity>
        ) : loading || budgetMonth !== yearMonth ? (
          <PrimaryText size={12} style={gs.mb10}>
            {t('limits.loading')}
          </PrimaryText>
        ) : null}

        {budgetMonth === yearMonth ? (
          <View pointerEvents={loading || !!error ? 'none' : 'auto'}>
            <PrimaryText size={11} weight="semibold" color={colors.accentGreen} style={gs.mb6}>
              {t('limits.overall').toUpperCase()}
            </PrimaryText>
            <View style={[gs.rounded12, gs.px14, {backgroundColor: colors.containerColor}]}>
              <LimitRow
                label={t('limits.monthly')}
                budget={overallMonthly}
                colors={colors}
                formatAmount={formatAmount}
                onPress={() => openLimit('monthly')}
              />
              <View style={{height: 1, backgroundColor: colors.secondaryAccent}} />
              <LimitRow
                label={t('limits.weekly')}
                budget={overallWeekly}
                colors={colors}
                formatAmount={formatAmount}
                onPress={() => openLimit('weekly')}
              />
            </View>

            <PrimaryText size={11} weight="semibold" color={colors.accentGreen} style={[gs.mt20, gs.mb6]}>
              {t('limits.byCategory').toUpperCase()}
            </PrimaryText>
            {categories.map(category => {
              const monthly = findBudget(budgets, 'monthly', category.id);
              const weekly = findBudget(budgets, 'weekly', category.id);
              return (
                <View
                  key={category.id}
                  style={[gs.rounded12, gs.px14, gs.mb8, {backgroundColor: colors.containerColor}]}>
                  <View style={[gs.rowCenter, gs.gap8, gs.pt12, gs.pb5]}>
                    <View
                      style={[gs.size32, gs.rounded8, gs.center, {backgroundColor: hexToRgba(category.color, 0.12)}]}>
                      <Icon name={category.icon || 'shapes'} size={16} color={category.color} />
                    </View>
                    <PrimaryText size={14} weight="semibold">
                      {category.name}
                    </PrimaryText>
                  </View>
                  <LimitRow
                    label={t('limits.monthly')}
                    budget={monthly}
                    colors={colors}
                    formatAmount={formatAmount}
                    onPress={() => openLimit('monthly', category.id, category.name)}
                  />
                  <View style={{height: 1, backgroundColor: colors.secondaryAccent}} />
                  <LimitRow
                    label={t('limits.weekly')}
                    budget={weekly}
                    colors={colors}
                    formatAmount={formatAmount}
                    onPress={() => openLimit('weekly', category.id, category.name)}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </PrimaryView>
  );
};

export default SpendingLimitsScreen;
