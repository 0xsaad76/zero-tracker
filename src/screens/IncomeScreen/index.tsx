import React, {useCallback, useMemo, useState} from 'react';
import {Alert, RefreshControl, ScrollView, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import AppHeader from '../../components/atoms/AppHeader';
import Fab from '../../components/atoms/Fab';
import Icon from '../../components/atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {useAppSelector} from '../../redux/hooks';
import {selectMonthIndex, selectYear} from '../../redux/slice/monthSelectionSlice';
import {goBack, navigate} from '../../utils/navigationUtils';
import {formatDate} from '../../utils/dateUtils';
import {gs, hitSlop} from '../../styles/globalStyles';
import {incomeSyncAvailable, readCloudData} from '../../cloud/records';
import {localDate, shiftMonth} from '../../investments/model';
import {incomeTotal, incomesForMonth, monthBalance, sortIncomes, type Income} from '../../income/model';
import {deleteIncome} from '../../income/service';

const monthLabel = (month: string) => {
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {month: 'long', year: 'numeric'}).format(new Date(year, value - 1, 1));
};

const IncomeScreen = () => {
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const insets = useSafeAreaInsets();
  const homeMonthIndex = useAppSelector(selectMonthIndex);
  const homeYear = useAppSelector(selectYear);
  const currentMonth = localDate().slice(0, 7);
  // Opens on the month Home is showing, so the numbers line up with the card that led here.
  const [month, setMonth] = useState(() => `${homeYear}-${String(homeMonthIndex + 1).padStart(2, '0')}`);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<{date: string; amount: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [syncReady, setSyncReady] = useState(true);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await readCloudData();
      setIncomes(sortIncomes(data.incomes ?? []));
      setExpenses(data.expenses.map(expense => ({date: expense.date, amount: expense.amount})));
      setSyncReady(incomeSyncAvailable());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load income.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(() => incomesForMonth(incomes, month), [incomes, month]);
  const balance = useMemo(() => {
    const spent = expenses.reduce((sum, expense) => (expense.date.startsWith(month) ? sum + expense.amount : sum), 0);
    return monthBalance(incomeTotal(visible), Math.round(spent * 100) / 100);
  }, [expenses, visible, month]);

  const remove = (income: Income) => {
    Alert.alert('Delete this income?', `${income.title} · ${formatAmount(income.amount)}`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteIncome(income.id)
            .then(() => load())
            .catch(caught =>
              Alert.alert('Could not delete income', caught instanceof Error ? caught.message : 'Please try again.'),
            );
        },
      },
    ]);
  };

  const edit = (income: Income) =>
    navigate('IncomeEntryScreen', {
      income: {
        id: income.id,
        title: income.title,
        amount: income.amount,
        date: income.date,
        description: income.description,
      },
    });

  const leftColor = balance.left < 0 ? colors.accentRed : colors.buttonText;

  return (
    <PrimaryView colors={colors} useBottomPadding={false}>
      <View style={[gs.mb15, gs.mt20]}>
        <AppHeader onPress={() => goBack()} colors={colors} text="Income" subtitle="Money coming in, month by month." />
      </View>
      <ScrollView
        style={gs.flex1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={gs.pb100}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.accentGreen}
            colors={[colors.accentGreen]}
          />
        }>
        <View style={[gs.rounded16, gs.p15, {backgroundColor: colors.accentGreen}]}>
          <View style={gs.rowBetweenCenter}>
            <TouchableOpacity
              onPress={() => setMonth(value => shiftMonth(value, -1))}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Previous month">
              <Icon name="chevron-left" size={20} color={colors.buttonText} />
            </TouchableOpacity>
            <PrimaryText size={13} weight="semibold" color={colors.buttonText}>
              {monthLabel(month)}
            </PrimaryText>
            <TouchableOpacity
              disabled={month >= currentMonth}
              onPress={() => setMonth(value => shiftMonth(value, 1))}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Next month">
              <Icon
                name="chevron-right"
                size={20}
                color={month >= currentMonth ? `${colors.buttonText}66` : colors.buttonText}
              />
            </TouchableOpacity>
          </View>
          <PrimaryText size={11} color={colors.buttonText} style={[gs.mt15, {opacity: 0.75}]}>
            INCOME
          </PrimaryText>
          <PrimaryText size={26} weight="bold" variant="number" color={colors.buttonText} numberOfLines={1}>
            {formatAmount(balance.income)}
          </PrimaryText>
          <View style={[gs.row, gs.mt15]}>
            <View style={gs.flex1}>
              <PrimaryText size={10} color={colors.buttonText} style={{opacity: 0.75}}>
                SPENT
              </PrimaryText>
              <PrimaryText size={15} weight="semibold" variant="number" color={colors.buttonText} numberOfLines={1}>
                {formatAmount(balance.spent)}
              </PrimaryText>
            </View>
            <View style={gs.flex1}>
              <PrimaryText size={10} color={colors.buttonText} style={{opacity: 0.75}}>
                {balance.left < 0 ? 'OVERSPENT' : 'LEFT'}
              </PrimaryText>
              <PrimaryText size={15} weight="semibold" variant="number" color={leftColor} numberOfLines={1}>
                {formatAmount(Math.abs(balance.left))}
              </PrimaryText>
            </View>
            <View style={gs.flex1}>
              <PrimaryText size={10} color={colors.buttonText} style={{opacity: 0.75}}>
                KEPT
              </PrimaryText>
              <PrimaryText size={15} weight="semibold" variant="number" color={colors.buttonText} numberOfLines={1}>
                {balance.savedPercent === null ? '—' : `${balance.savedPercent}%`}
              </PrimaryText>
            </View>
          </View>
        </View>

        {syncReady ? null : (
          <View
            style={[gs.rowCenter, gs.gap10, gs.p14, gs.rounded12, gs.mt10, {backgroundColor: colors.containerColor}]}>
            <Icon name="alert-triangle" size={18} color={colors.accentOrange} />
            <PrimaryText size={11} color={colors.secondaryText} style={gs.flex1}>
              Income needs a cloud update before it can be saved. Apply the latest cloud migration, then pull down to
              reload. Your other data is unaffected.
            </PrimaryText>
          </View>
        )}

        <PrimaryText size={12} weight="semibold" color={colors.secondaryText} style={[gs.mt20, gs.mb8]}>
          {visible.length === 1 ? '1 ENTRY' : `${visible.length} ENTRIES`}
        </PrimaryText>

        {loading && incomes.length === 0 ? (
          <View style={[gs.p20, gs.itemsCenter]}>
            <PrimaryText color={colors.secondaryText}>Loading income…</PrimaryText>
          </View>
        ) : error ? (
          <View style={[gs.p15, gs.rounded12, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={12} color={colors.accentRed}>
              {error}
            </PrimaryText>
            <View style={gs.mt10}>
              <PrimaryButton colors={colors} buttonTitle="Try again" size="sm" onPress={() => void load()} />
            </View>
          </View>
        ) : visible.length === 0 ? (
          <View style={[gs.p20, gs.rounded16, gs.itemsCenter, {backgroundColor: colors.containerColor}]}>
            <View style={[gs.size50, gs.center, gs.roundedFull, {backgroundColor: colors.secondaryAccent}]}>
              <Icon name="wallet" size={22} color={colors.accentGreen} />
            </View>
            <PrimaryText size={15} weight="semibold" style={gs.mt10}>
              No income in {monthLabel(month)}
            </PrimaryText>
            <PrimaryText size={12} color={colors.secondaryText} style={[gs.mt5, gs.textCenter]}>
              Add your salary or any other money that came in to see what is left after spending.
            </PrimaryText>
            <View style={[gs.wFull, gs.mt15]}>
              <PrimaryButton
                colors={colors}
                buttonTitle="Add income"
                icon="plus"
                disabled={!syncReady}
                onPress={() => navigate('IncomeEntryScreen', {})}
              />
            </View>
          </View>
        ) : (
          visible.map(income => (
            <TouchableOpacity
              key={income.id}
              onPress={() => edit(income)}
              onLongPress={() => remove(income)}
              activeOpacity={0.7}
              style={[
                gs.rounded12,
                gs.rowBetweenCenter,
                gs.px14,
                gs.py12,
                gs.mb5,
                {backgroundColor: colors.containerColor},
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${income.title}, ${formatAmount(income.amount)}`}
              accessibilityHint="Opens this entry for editing. Long press to delete.">
              <View style={[gs.rowCenter, gs.flex1]}>
                <View style={[gs.size36, gs.center, gs.rounded10, gs.mr10, {backgroundColor: colors.iconContainer}]}>
                  <Icon name="wallet" size={18} color={colors.accentGreen} />
                </View>
                <View style={[gs.flex1, gs.gap2]}>
                  <PrimaryText weight="medium" numberOfLines={1}>
                    {income.title}
                  </PrimaryText>
                  <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1}>
                    {formatDate(income.date, 'Do MMM')}
                    {income.description ? ` · ${income.description}` : ''}
                  </PrimaryText>
                </View>
              </View>
              <PrimaryText size={14} weight="semibold" variant="number" color={colors.accentGreen} style={gs.ml10}>
                +{formatAmount(income.amount)}
              </PrimaryText>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      {syncReady && visible.length > 0 ? (
        <Fab
          onPress={() => navigate('IncomeEntryScreen', {})}
          accessibilityLabel="Add income"
          bottom={Math.max(insets.bottom, 15) + 5}
        />
      ) : null}
    </PrimaryView>
  );
};

export default IncomeScreen;
