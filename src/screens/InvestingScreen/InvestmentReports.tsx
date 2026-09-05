import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, TouchableOpacity, View} from 'react-native';
import PrimaryText from '../../components/atoms/PrimaryText';
import useThemeColors from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {gs} from '../../styles/globalStyles';
import {investmentSummary, portfolioSummary, shiftMonth, total, type Investment} from '../../investments/model';

const monthName = (month: string) => {
  const [year, number] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {month: 'short'}).format(new Date(year, number - 1, 1));
};

const SignedAmount = ({value}: {value: number | null}) => {
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  if (value === null)
    return (
      <PrimaryText size={13} color={colors.secondaryText}>
        Not enough valuations
      </PrimaryText>
    );
  return (
    <PrimaryText size={13} weight="semibold" variant="number" color={value < 0 ? colors.accentRed : colors.accentGreen}>
      {value > 0 ? '+' : ''}
      {formatAmount(value)}
    </PrimaryText>
  );
};

export default function InvestmentReports({
  investments,
  selectedMonth,
}: {
  investments: Investment[];
  selectedMonth: string;
}) {
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const [scope, setScope] = useState('portfolio');
  const selected = investments.find(item => item.id === scope);
  useEffect(() => {
    if (scope !== 'portfolio' && !selected) setScope('portfolio');
  }, [scope, selected]);
  const months = useMemo(
    () => Array.from({length: 6}, (_, index) => shiftMonth(selectedMonth, index - 5)),
    [selectedMonth],
  );
  const points = months.map(month => {
    if (selected) {
      const summary = investmentSummary(selected, month);
      return {month, value: summary.closing && !summary.stale ? summary.closing.value : null};
    }
    const summary = portfolioSummary(investments, month);
    return {month, value: summary.complete ? summary.value : null};
  });
  const knownValues = points.flatMap(point => (point.value === null ? [] : [point.value]));
  const maximum = Math.max(...knownValues, 1);
  const current = selected ? investmentSummary(selected, selectedMonth) : portfolioSummary(investments, selectedMonth);
  const netInvested = current.contributed - current.withdrawn;
  const allocationRows = investments
    .filter(item => item.startDate.slice(0, 7) <= selectedMonth)
    .map(item => ({item, value: investmentSummary(item, selectedMonth).value}));
  const allocationTotal = total(allocationRows.flatMap(row => (row.value === null ? [] : [row.value])));
  const allocationComplete = allocationRows.length > 0 && allocationRows.every(row => row.value !== null);

  return (
    <View style={[gs.rounded16, gs.p14, gs.mt15, {backgroundColor: colors.containerColor}]}>
      <View style={gs.rowBetweenCenter}>
        <View>
          <PrimaryText size={16} weight="bold">
            Reports
          </PrimaryText>
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mt3}>
            Six-month value trend
          </PrimaryText>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[gs.gap8, gs.py12]}>
        {[{id: 'portfolio', name: 'All investments'}, ...investments.map(item => ({id: item.id, name: item.name}))].map(
          item => {
            const active = item.id === scope;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setScope(item.id)}
                style={[
                  gs.px12,
                  gs.py8,
                  gs.roundedFull,
                  {backgroundColor: active ? colors.primaryText : colors.secondaryAccent},
                ]}
                accessibilityRole="button"
                accessibilityState={{selected: active}}>
                <PrimaryText size={11} color={active ? colors.buttonText : colors.primaryText} numberOfLines={1}>
                  {item.name}
                </PrimaryText>
              </TouchableOpacity>
            );
          },
        )}
      </ScrollView>

      <View style={[gs.p12, gs.rounded12, gs.mb10, {backgroundColor: colors.secondaryAccent}]}>
        <PrimaryText size={11} color={colors.secondaryText}>
          {current.value === null
            ? `${selected?.name ?? 'Your portfolio'} needs a valuation before its performance can be reported.`
            : `${selected?.name ?? 'Your portfolio'} is valued at ${formatAmount(current.value)} against ${formatAmount(netInvested)} net invested${current.gain === null ? '.' : `, with a recorded gain/loss of ${current.gain > 0 ? '+' : ''}${formatAmount(current.gain)}.`}`}
        </PrimaryText>
      </View>

      <View style={[gs.row, gs.itemsEnd, gs.gap8, {height: 142}]} accessibilityLabel="Six month investment value chart">
        {points.map(point => {
          const height = point.value === null ? 8 : Math.max(10, Math.round((point.value / maximum) * 104));
          return (
            <View key={point.month} style={[gs.flex1, gs.itemsCenter, gs.justifyEnd]}>
              <View
                style={[
                  gs.wFull,
                  gs.rounded4,
                  {
                    height,
                    backgroundColor: point.value === null ? colors.secondaryText : colors.accentGreen,
                    opacity: point.value === null ? 0.3 : 1,
                  },
                ]}
                accessibilityLabel={`${monthName(point.month)}: ${point.value === null ? 'valuation missing' : formatAmount(point.value)}`}
              />
              <PrimaryText size={9} color={colors.secondaryText} style={gs.mt6}>
                {monthName(point.month)}
              </PrimaryText>
            </View>
          );
        })}
      </View>
      {knownValues.length === 0 ? (
        <PrimaryText size={11} color={colors.secondaryText} style={[gs.mt8, gs.textCenter]}>
          Add monthly valuations to unlock an honest value trend.
        </PrimaryText>
      ) : null}

      <View style={[gs.row, gs.gap8, gs.mt15]}>
        <View style={[gs.flex1, gs.p12, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
          <PrimaryText size={10} color={colors.secondaryText}>
            NET INVESTED
          </PrimaryText>
          <PrimaryText size={14} weight="bold" variant="number" style={gs.mt5}>
            {formatAmount(netInvested)}
          </PrimaryText>
        </View>
        <View style={[gs.flex1, gs.p12, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
          <PrimaryText size={10} color={colors.secondaryText}>
            TOTAL GAIN / LOSS
          </PrimaryText>
          <View style={gs.mt5}>
            <SignedAmount value={current.gain} />
          </View>
        </View>
      </View>
      <View style={[gs.p12, gs.rounded12, gs.mt8, {backgroundColor: colors.secondaryAccent}]}>
        <View style={gs.rowBetweenCenter}>
          <PrimaryText size={11} color={colors.secondaryText}>
            Selected month gain / loss
          </PrimaryText>
          <SignedAmount value={current.monthlyGain} />
        </View>
        <PrimaryText size={10} color={colors.secondaryText} style={gs.mt6}>
          Contributions and withdrawals are excluded. A prior-month baseline is required.
        </PrimaryText>
      </View>

      {!selected && allocationRows.length > 1 ? (
        <View style={gs.mt15}>
          <PrimaryText size={12} weight="semibold" style={gs.mb8}>
            Portfolio mix
          </PrimaryText>
          {allocationRows.map(({item, value}) => (
            <View key={item.id} style={gs.mb8}>
              <View style={gs.rowBetweenCenter}>
                <PrimaryText size={11} numberOfLines={1} style={gs.flex1}>
                  {item.name}
                </PrimaryText>
                <PrimaryText size={11} variant="number" color={colors.secondaryText}>
                  {!allocationComplete || value === null || allocationTotal <= 0
                    ? 'Valuation needed'
                    : `${Math.round((value / allocationTotal) * 100)}%`}
                </PrimaryText>
              </View>
              <View style={[gs.h4, gs.roundedFull, gs.mt5, {backgroundColor: colors.secondaryAccent}]}>
                {allocationComplete && value !== null && allocationTotal > 0 ? (
                  <View
                    style={[
                      gs.h4,
                      gs.roundedFull,
                      {
                        width: `${Math.min(100, (value / allocationTotal) * 100)}%`,
                        backgroundColor: colors.accentGreen,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <PrimaryText size={10} color={colors.secondaryText} style={gs.mt8}>
        Reports use your entries and are for tracking only, not financial advice or live market prices.
      </PrimaryText>
    </View>
  );
}
