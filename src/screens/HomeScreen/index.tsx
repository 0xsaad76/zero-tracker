import React, {useCallback, useMemo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import Icon from '../../components/atoms/Icons';
import {navigate} from '../../utils/navigationUtils';
import TransactionList from '../../components/molecules/TransactionList';
import HeaderContainer from '../../components/molecules/HeaderContainer';
import useHome from './useHome';
import useSwipeTutorial from '../../hooks/useSwipeTutorial';
import SwipeTutorialTooltip from '../../components/atoms/SwipeTutorialTooltip';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import EmptyState from '../../components/atoms/EmptyState';
import useFormatAmount from '../../hooks/useFormatAmount';
import {SheetManager} from 'react-native-actions-sheet';
import {gs} from '../../styles/globalStyles';
import Fab from '../../components/atoms/Fab';
import OverviewTiles from './OverviewTiles';
import {useOverview} from './useOverview';
import {useFeatureFlags} from '../../features/flags';
import {monthBalance} from '../../income/model';
import BudgetProgressCard from '../../components/molecules/BudgetProgressCard';
import SchedulesSection from '../../recurring/SchedulesSection';
import {useRecurringSchedules} from '../../recurring/useRecurringSchedules';

const HomeScreen = () => {
  const {
    colors,
    refreshing,
    userName,
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
    weeklyReady,
    monthlyReady,
    weeklyError,
    monthlyError,
    showBudgetProgress,
    handleMonthYearSelect,
  } = useHome();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const features = useFeatureFlags();
  // Row count changes on add/delete and `refreshing` flips on pull-to-refresh: both mean "numbers may be stale".
  const overview = useOverview(yearMonth, `${transactionCount}:${refreshing}`);
  const balance = useMemo(
    () => (overview.income === null ? null : monthBalance(overview.income, totalSpent)),
    [overview.income, totalSpent],
  );
  const {shouldShowTutorial, tutorialRef, dismissTutorial} = useSwipeTutorial({
    screen: 'home',
    itemCount: sortedTransactions.length,
  });
  const {
    schedules: spendingSchedules,
    nameOf: spendingScheduleName,
    reload: reloadSpendingSchedules,
  } = useRecurringSchedules('expense');

  const openMonthPicker = useCallback(() => {
    void SheetManager.show('month-year-picker-sheet', {
      payload: {
        selectedMonth: selectedMonthIndex,
        selectedYear,
        availableYears,
        onSelect: handleMonthYearSelect,
      },
    });
  }, [selectedMonthIndex, selectedYear, availableYears, handleMonthYearSelect]);

  const listHeader = useMemo(
    () => (
      <View style={gs.mx16}>
        <View style={[gs.rounded16, gs.overflowHidden, {backgroundColor: colors.accentGreen}]}>
          <TouchableOpacity
            onPress={openMonthPicker}
            activeOpacity={0.7}
            style={[gs.px14, gs.pt15, gs.pb10]}
            accessibilityRole="button"
            accessibilityLabel={`${selectedMonthName} ${selectedYear}, spent ${formatAmount(totalSpent)}. Change month`}>
            <View style={[gs.rowCenter, gs.gap6]}>
              <PrimaryText size={13} weight="semibold" color={colors.buttonText}>
                {selectedMonthName} {selectedYear}
              </PrimaryText>
              <Icon name="chevron-down" size={14} color={colors.buttonText} />
            </View>
            <PrimaryText size={10} color={colors.buttonText} style={[gs.mt10, {opacity: 0.75}]}>
              SPENT
            </PrimaryText>
            <PrimaryText size={28} weight="bold" variant="number" color={colors.buttonText} numberOfLines={1}>
              {formatAmount(totalSpent)}
            </PrimaryText>
            <View style={[gs.rowCenter, gs.gap8, gs.mt4]}>
              <PrimaryText size={11} color={colors.buttonText} variant="number" style={{opacity: 0.7}}>
                {t('home.transactionCount', {count: transactionCount})}
              </PrimaryText>
              {todayTotal > 0 ? (
                <>
                  <PrimaryText size={11} color={colors.buttonText} style={{opacity: 0.7}}>
                    ·
                  </PrimaryText>
                  <PrimaryText size={11} color={colors.buttonText} variant="number" style={{opacity: 0.7}}>
                    {t('home.today')}: {formatAmount(todayTotal)}
                  </PrimaryText>
                </>
              ) : null}
            </View>
          </TouchableOpacity>
          {balance ? (
            <TouchableOpacity
              onPress={() => navigate('IncomeScreen')}
              activeOpacity={0.7}
              style={[gs.rowCenter, gs.px14, gs.py10, {backgroundColor: 'rgba(0,0,0,0.12)'}]}
              accessibilityRole="button"
              accessibilityLabel={
                balance.income > 0
                  ? `Income ${formatAmount(balance.income)}, ${balance.left < 0 ? 'overspent' : 'left'} ${formatAmount(Math.abs(balance.left))}. Open income`
                  : 'Add income for this month'
              }>
              {balance.income > 0 ? (
                <>
                  <View style={gs.flex1}>
                    <PrimaryText size={10} color={colors.buttonText} style={{opacity: 0.75}}>
                      INCOME
                    </PrimaryText>
                    <PrimaryText
                      size={14}
                      weight="semibold"
                      variant="number"
                      color={colors.buttonText}
                      numberOfLines={1}>
                      {formatAmount(balance.income)}
                    </PrimaryText>
                  </View>
                  <View style={gs.flex1}>
                    <PrimaryText size={10} color={colors.buttonText} style={{opacity: 0.75}}>
                      {balance.left < 0 ? 'OVERSPENT' : 'LEFT'}
                    </PrimaryText>
                    <PrimaryText
                      size={14}
                      weight="semibold"
                      variant="number"
                      color={colors.buttonText}
                      numberOfLines={1}>
                      {formatAmount(Math.abs(balance.left))}
                    </PrimaryText>
                  </View>
                </>
              ) : (
                <View style={[gs.rowCenter, gs.gap6, gs.flex1]}>
                  <Icon name="wallet" size={14} color={colors.buttonText} />
                  <PrimaryText size={12} weight="medium" color={colors.buttonText}>
                    Add this month's income to see what is left
                  </PrimaryText>
                </View>
              )}
              <Icon name="chevron-right" size={16} color={colors.buttonText} />
            </TouchableOpacity>
          ) : null}
        </View>

        <OverviewTiles overview={overview} />

        <BudgetProgressCard
          visible={showBudgetProgress && features.limits}
          monthlyExpenses={sortedTransactions}
          weeklyExpenses={weeklyTransactions}
          weekRange={weekRange}
          weeklyReady={weeklyReady}
          monthlyReady={monthlyReady}
          weeklyError={weeklyError}
          monthlyError={monthlyError}
          budgets={budgets}
          categories={categories}
          todayTotal={todayTotal}
          daysInMonth={daysInMonth}
          isCurrentMonth={isCurrentMonth}
        />
        <SchedulesSection
          title="Scheduled spending"
          subtitle="Auto-added on their day each month. Pause or delete anytime."
          schedules={spendingSchedules}
          describe={schedule =>
            schedule.target === 'expense'
              ? `${schedule.title} → ${spendingScheduleName(schedule)}`
              : spendingScheduleName(schedule)
          }
          onChanged={() => void reloadSpendingSchedules()}
        />
      </View>
    ),
    [
      selectedMonthName,
      selectedYear,
      totalSpent,
      transactionCount,
      todayTotal,
      isCurrentMonth,
      budgets,
      categories,
      weeklyTransactions,
      weekRange,
      weeklyReady,
      monthlyReady,
      weeklyError,
      monthlyError,
      showBudgetProgress,
      features.limits,
      balance,
      overview,
      sortedTransactions,
      daysInMonth,
      spendingSchedules,
      spendingScheduleName,
      reloadSpendingSchedules,
      colors,
      openMonthPicker,
      formatAmount,
      t,
    ],
  );

  const listEmpty = useMemo(
    () => (
      <View style={gs.px16}>
        <EmptyState colors={colors} type={'Transactions'} />
      </View>
    ),
    [colors],
  );

  return (
    <>
      <PrimaryView colors={colors} useBottomPadding={false} useSidePadding={false}>
        <View style={[gs.px16, gs.mb15]}>
          <HeaderContainer headerText={t('home.greeting', {name: userName})} showSearch />
        </View>
        {shouldShowTutorial && <SwipeTutorialTooltip onDismiss={dismissTutorial} />}
        <TransactionList
          allExpenses={sortedTransactions}
          edgeToEdge
          targetMonth={yearMonth}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={gs.pb100}
          tutorialSwipeRef={tutorialRef}
        />
      </PrimaryView>
      <Fab onPress={() => navigate('AddTransactionsScreen')} accessibilityLabel={t('home.addTransaction')} />
    </>
  );
};

export default HomeScreen;
