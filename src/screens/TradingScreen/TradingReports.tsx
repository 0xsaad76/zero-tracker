import React, {useMemo} from 'react';
import {View} from 'react-native';
import PrimaryText from '../../components/atoms/PrimaryText';
import useThemeColors from '../../hooks/useThemeColors';
import {gs} from '../../styles/globalStyles';
import {useTradingFormat} from '../../trading/display';
import {
  summarizeTrades,
  type Trade,
  type TradingCurrency,
  type TradingPair,
  type TradingStrategy,
} from '../../trading/model';
import TradingPerformanceChart from './TradingPerformanceChart';

const SignedPnl = ({value, currency}: {value: number; currency: TradingCurrency}) => {
  const colors = useThemeColors();
  const format = useTradingFormat(currency);
  return (
    <PrimaryText
      size={14}
      weight="semibold"
      variant="number"
      color={value < 0 ? colors.accentRed : value > 0 ? colors.accentGreen : colors.primaryText}>
      {value > 0 ? '+' : ''}
      {format(value)}
    </PrimaryText>
  );
};

// Bucket once, rather than filtering the complete journal for every pair/setup.
function breakdown(trades: Trade[], key: 'pair' | 'strategy', registry: {id: string; name: string}[]) {
  const groups = new Map<string, Trade[]>();
  const names = new Map(registry.map(item => [item.id, item.name]));
  for (const trade of trades) {
    const group = groups.get(trade[key]) ?? [];
    group.push(trade);
    groups.set(trade[key], group);
  }
  return [...groups]
    .map(([id, group]) => ({id, name: names.get(id) ?? id, stats: summarizeTrades(group)}))
    .sort((a, b) => b.stats.netPnl - a.stats.netPnl || a.name.localeCompare(b.name));
}

export default function TradingReports({
  trades,
  scopeLabel,
  pairs,
  strategies,
  currency,
}: {
  trades: Trade[];
  scopeLabel: string;
  pairs: TradingPair[];
  strategies: TradingStrategy[];
  currency: TradingCurrency;
}) {
  const colors = useThemeColors();
  const stats = useMemo(() => summarizeTrades(trades), [trades]);
  const perPair = useMemo(() => breakdown(trades, 'pair', pairs), [trades, pairs]);
  const perStrategy = useMemo(() => breakdown(trades, 'strategy', strategies), [trades, strategies]);
  return (
    <View style={[gs.rounded16, gs.p14, gs.mt15, {backgroundColor: colors.containerColor}]}>
      <PrimaryText size={18} weight="bold">
        Performance
      </PrimaryText>
      <PrimaryText size={11} color={colors.secondaryText} style={gs.mt5}>
        {scopeLabel}
      </PrimaryText>
      <TradingPerformanceChart trades={trades} currency={currency} />

      {trades.length > 0 && (
        <>
          <View style={[gs.row, gs.gap8, gs.mt15]}>
            <View style={[gs.flex1, gs.p12, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
              <PrimaryText size={10} color={colors.secondaryText}>
                NET P&L · {currency}
              </PrimaryText>
              <View style={gs.mt5}>
                <SignedPnl value={stats.netPnl} currency={currency} />
              </View>
            </View>
            <View style={[gs.flex1, gs.p12, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
              <PrimaryText size={10} color={colors.secondaryText}>
                WIN RATE
              </PrimaryText>
              <PrimaryText size={14} weight="semibold" variant="number" style={gs.mt5}>
                {stats.winRate === null ? '—' : `${stats.winRate}%`}
              </PrimaryText>
            </View>
          </View>
          <View style={[gs.row, gs.gap8, gs.mt8]}>
            {[
              {
                label: 'PROFIT FACTOR',
                value:
                  stats.profitFactor === null
                    ? '—'
                    : Number.isFinite(stats.profitFactor)
                      ? String(stats.profitFactor)
                      : 'No losses',
              },
              {label: 'PLANNED RISK : REWARD', value: stats.avgRiskReward === null ? '—' : `1:${stats.avgRiskReward}`},
            ].map(item => (
              <View
                key={item.label}
                style={[gs.flex1, gs.p12, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
                <PrimaryText size={10} color={colors.secondaryText}>
                  {item.label}
                </PrimaryText>
                <PrimaryText size={14} weight="semibold" variant="number" style={gs.mt5}>
                  {item.value}
                </PrimaryText>
              </View>
            ))}
          </View>
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mt10}>
            {stats.count} closed {stats.count === 1 ? 'trade' : 'trades'} · {stats.wins} won · {stats.losses} lost
            {stats.breakeven ? ` · ${stats.breakeven} breakeven` : ''}. Win rate excludes breakeven trades.
          </PrimaryText>
          {[
            {title: 'By pair', rows: perPair},
            {title: 'By setup', rows: perStrategy},
          ].map(section => (
            <View key={section.title} style={gs.mt20}>
              <View style={gs.rowBetweenCenter}>
                <PrimaryText size={13} weight="semibold">
                  {section.title}
                </PrimaryText>
                <PrimaryText size={10} color={colors.secondaryText}>
                  Net P&L
                </PrimaryText>
              </View>
              {section.rows.map(row => (
                <View
                  key={row.id}
                  style={[
                    gs.rowBetweenCenter,
                    gs.py12,
                    gs.gap12,
                    {borderBottomWidth: 1, borderBottomColor: colors.secondaryAccent},
                  ]}>
                  <View style={gs.flex1}>
                    <PrimaryText size={12} weight="semibold">
                      {row.name}
                    </PrimaryText>
                    <PrimaryText size={10} color={colors.secondaryText} style={gs.mt3}>
                      {row.stats.count} {row.stats.count === 1 ? 'trade' : 'trades'} ·{' '}
                      {row.stats.winRate === null ? 'No wins or losses' : `${row.stats.winRate}% win rate`}
                    </PrimaryText>
                  </View>
                  <View style={{maxWidth: '50%'}}>
                    <SignedPnl value={row.stats.netPnl} currency={currency} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
      <PrimaryText size={10} color={colors.secondaryText} style={gs.mt15}>
        Based on recorded closed trades only, not live market prices. Planned risk/reward is not realized return.
      </PrimaryText>
    </View>
  );
}
