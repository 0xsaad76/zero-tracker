import React, {memo, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import PrimaryText from '../atoms/PrimaryText';
import Icon from '../atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {navigate} from '../../utils/navigationUtils';
import {findBudget} from '../../redux/slice/budgetDataSlice';
import type {BudgetData, BudgetPeriod} from '../../cloud/budgets';
import type {CategoryData, ExpenseWithCategory} from '../../cloud';
import {sumAmounts, sumAmountsByCategory} from '../../utils/budgetTracking';
import {gs} from '../../styles/globalStyles';
import {formatDate} from '../../utils/dateUtils';

interface BudgetProgressCardProps {
  visible: boolean;
  monthlyExpenses: ExpenseWithCategory[];
  weeklyExpenses: ExpenseWithCategory[];
  budgets: BudgetData[];
  categories: CategoryData[];
  todayTotal: number;
  daysInMonth: number;
  isCurrentMonth: boolean;
  weekRange: {startDate: string; endDate: string};
  weeklyReady: boolean;
  monthlyReady: boolean;
  weeklyError: string | null;
  monthlyError: string | null;
}

const BudgetProgressCard: React.FC<BudgetProgressCardProps> = ({
  visible,
  monthlyExpenses,
  weeklyExpenses,
  budgets,
  categories,
  weekRange,
  weeklyReady,
  monthlyReady,
  weeklyError,
  monthlyError,
}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const [period, setPeriod] = useState<BudgetPeriod>('monthly');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Partial<Record<BudgetPeriod, string>>>({});

  const expenses = period === 'monthly' ? monthlyExpenses : weeklyExpenses;
  const spent = useMemo(() => sumAmounts(expenses), [expenses]);
  const categorySpent = useMemo(() => sumAmountsByCategory(expenses), [expenses]);
  const overallBudget = findBudget(budgets, period);

  const categoryLimits = useMemo(
    () =>
      categories
        .map(category => ({category, budget: findBudget(budgets, period, category.id)}))
        .filter((item): item is {category: CategoryData; budget: BudgetData} => item.budget !== null),
    [budgets, categories, period],
  );
  // Fall back safely when a category/limit is removed or is absent this period.
  const selectedLimit =
    categoryLimits.find(item => item.category.id === selectedCategoryIds[period]) ?? categoryLimits[0];
  const selectedTotal = selectedLimit ? (categorySpent.get(selectedLimit.category.id) ?? 0) : 0;
  const selectedPercentage = selectedLimit ? Math.min((selectedTotal / selectedLimit.budget.amount) * 100, 100) : 0;
  const selectedExceeded = selectedLimit ? selectedTotal > selectedLimit.budget.amount : false;
  const canChooseCategory = categoryLimits.length > 1;

  if (!visible) {
    return null;
  }

  const percentage = overallBudget ? Math.min(Math.round((spent / overallBudget.amount) * 100), 999) : 0;
  const exceeded = overallBudget ? spent > overallBudget.amount : false;
  const ready = period === 'monthly' ? monthlyReady : weeklyReady;
  const error = period === 'monthly' ? monthlyError : weeklyError;

  return (
    <View style={[gs.px14, gs.py10, gs.rounded12, gs.mt6, {backgroundColor: colors.secondaryAccent}]}>
      <View style={gs.rowBetweenCenter}>
        <View style={[gs.rowCenter, gs.gap4]}>
          {(['monthly', 'weekly'] as BudgetPeriod[]).map(option => {
            const active = option === period;
            return (
              <TouchableOpacity
                key={option}
                onPress={() => {
                  setPeriod(option);
                  setCategoryMenuOpen(false);
                }}
                accessibilityRole="tab"
                accessibilityState={{selected: active}}
                style={[
                  gs.px10,
                  gs.py8,
                  gs.rounded8,
                  {backgroundColor: active ? colors.containerColor : 'transparent'},
                ]}>
                <PrimaryText
                  size={11}
                  weight={active ? 'semibold' : 'regular'}
                  color={active ? colors.primaryText : colors.secondaryText}>
                  {t(option === 'monthly' ? 'limits.monthlyShort' : 'limits.weeklyShort')}
                </PrimaryText>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={() => navigate('SpendingLimitsScreen')} accessibilityLabel={t('limits.manage')}>
          <Icon name="settings" size={15} color={colors.secondaryText} />
        </TouchableOpacity>
      </View>

      {period === 'weekly' ? (
        <PrimaryText size={10} color={colors.secondaryText} style={gs.mt6}>
          {formatDate(weekRange.startDate, 'D MMM')} – {formatDate(weekRange.endDate, 'D MMM YYYY')}
        </PrimaryText>
      ) : null}
      {!ready ? (
        <PrimaryText size={11} color={colors.secondaryText} style={gs.mt10}>
          {t(error ? 'limits.loadFailed' : 'limits.loading')}
        </PrimaryText>
      ) : overallBudget ? (
        <View style={gs.mt10}>
          <View style={gs.rowBetweenCenter}>
            <PrimaryText
              size={12}
              weight="semibold"
              variant="number"
              color={exceeded ? colors.accentOrange : colors.primaryText}>
              {formatAmount(Math.max(overallBudget.amount - spent, 0))} {t('home.remaining')}
            </PrimaryText>
            <PrimaryText size={11} variant="number" color={colors.secondaryText}>
              {percentage}%
            </PrimaryText>
          </View>
          <View style={[gs.rounded4, gs.h4, gs.mt8, {backgroundColor: colors.secondaryContainerColor}]}>
            <View
              style={[
                gs.rounded4,
                gs.h4,
                {
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: exceeded ? colors.accentOrange : colors.accentGreen,
                },
              ]}
            />
          </View>
          <PrimaryText size={10} variant="number" color={colors.secondaryText} style={gs.mt4}>
            {t('limits.spentOf', {spent: formatAmount(spent), limit: formatAmount(overallBudget.amount)})}
          </PrimaryText>
        </View>
      ) : (
        <TouchableOpacity onPress={() => navigate('SpendingLimitsScreen')} style={gs.mt10}>
          <PrimaryText size={11} color={colors.secondaryText}>
            {t('limits.noOverallLimit', {
              period: t(period === 'monthly' ? 'limits.monthlyShort' : 'limits.weeklyShort').toLowerCase(),
            })}
          </PrimaryText>
        </TouchableOpacity>
      )}

      {ready && selectedLimit ? (
        <View style={gs.mt10}>
          <PrimaryText size={10} weight="semibold" color={colors.secondaryText}>
            {t('limits.categoryProgress')}
          </PrimaryText>
          <TouchableOpacity
            onPress={() => setCategoryMenuOpen(open => !open)}
            disabled={!canChooseCategory}
            accessibilityRole="button"
            accessibilityLabel={t('limits.chooseCategory', {category: selectedLimit.category.name})}
            accessibilityState={{expanded: canChooseCategory && categoryMenuOpen, disabled: !canChooseCategory}}
            style={[gs.rowBetweenCenter, gs.gap8, styles.categoryRow]}>
            <View style={[gs.rowCenter, gs.gap6, gs.flex1]}>
              <View style={[styles.categoryDot, {backgroundColor: selectedLimit.category.color}]} />
              <PrimaryText size={12} numberOfLines={1} style={gs.flex1}>
                {selectedLimit.category.name}
              </PrimaryText>
              {canChooseCategory ? (
                <View style={categoryMenuOpen ? styles.chevronOpen : undefined}>
                  <Icon name="chevron-down" size={14} color={colors.secondaryText} />
                </View>
              ) : null}
            </View>
            <PrimaryText
              size={10}
              variant="number"
              color={selectedExceeded ? colors.accentOrange : colors.secondaryText}>
              {formatAmount(selectedTotal)} / {formatAmount(selectedLimit.budget.amount)}
            </PrimaryText>
          </TouchableOpacity>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={selectedLimit.category.name}
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(selectedPercentage),
              text: t('limits.spentOf', {
                spent: formatAmount(selectedTotal),
                limit: formatAmount(selectedLimit.budget.amount),
              }),
            }}
            style={[gs.rounded2, gs.minH2, {backgroundColor: colors.secondaryContainerColor}]}>
            <View
              style={[
                gs.rounded2,
                {
                  height: 2,
                  width: `${selectedPercentage}%`,
                  backgroundColor: selectedExceeded ? colors.accentOrange : selectedLimit.category.color,
                },
              ]}
            />
          </View>
          {categoryMenuOpen && canChooseCategory ? (
            <View style={[gs.mt8, gs.rounded8, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
              <ScrollView nestedScrollEnabled style={styles.categoryMenu}>
                {categoryLimits.map(({category, budget}) => {
                  const selected = category.id === selectedLimit.category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityLabel={category.name}
                      accessibilityState={{selected}}
                      onPress={() => {
                        setSelectedCategoryIds(ids => ({...ids, [period]: category.id}));
                        setCategoryMenuOpen(false);
                      }}
                      style={[
                        gs.rowBetweenCenter,
                        gs.gap8,
                        gs.px10,
                        gs.py8,
                        styles.categoryRow,
                        {backgroundColor: selected ? colors.secondaryContainerColor : 'transparent'},
                      ]}>
                      <View style={[gs.rowCenter, gs.gap6, gs.flex1]}>
                        <View style={[styles.categoryDot, {backgroundColor: category.color}]} />
                        <PrimaryText size={12} numberOfLines={1} style={gs.flex1}>
                          {category.name}
                        </PrimaryText>
                        {selected ? <Icon name="check" size={13} color={colors.accentGreen} /> : null}
                      </View>
                      <PrimaryText size={10} variant="number" color={colors.secondaryText}>
                        {formatAmount(categorySpent.get(category.id) ?? 0)} / {formatAmount(budget.amount)}
                      </PrimaryText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  categoryRow: {minHeight: 44},
  categoryMenu: {maxHeight: 176},
  categoryDot: {width: 6, height: 6, borderRadius: 3},
  chevronOpen: {transform: [{rotate: '180deg'}]},
});

export default memo(BudgetProgressCard);
