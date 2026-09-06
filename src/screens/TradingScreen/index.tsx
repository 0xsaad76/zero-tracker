import React, {useCallback, useMemo, useState} from 'react';
import {Alert, Modal, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import CustomInput from '../../components/atoms/CustomInput';
import HeaderContainer from '../../components/molecules/HeaderContainer';
import Icon from '../../components/atoms/Icons';
import useThemeColors from '../../hooks/useThemeColors';
import {gs, hitSlop} from '../../styles/globalStyles';
import {readCloudData, cloudProtocolVersion} from '../../cloud/records';
import {updateCloudPreferences} from '../../cloud/preferences';
import {getTradingCurrency} from '../../utils/tradingCurrency';
import {useTradingFormat, useTradingPriceFormat} from '../../trading/display';
import {
  filterTrades,
  localDate,
  monthlyTradingSummary,
  monthEnd,
  openingBalanceForMonth,
  resolveTradingPairs,
  resolveTradingStrategies,
  shiftMonth,
  summarizeTrades,
  tradeOutcome,
  tradeRangeBounds,
  tradingPairLabel,
  tradingStrategyLabel,
  type Trade,
  type TradingBalanceRegistry,
  type TradingCurrency,
  type TradingPair,
  type TradingStrategy,
} from '../../trading/model';
import {deleteTrade, saveOpeningBalance} from '../../trading/service';
import TradeEditor from './TradeEditor';
import TradingReports from './TradingReports';
import TradingSetupManager from './TradingSetupManager';

const monthLabel = (month: string) => {
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {month: 'long', year: 'numeric'}).format(new Date(year, value - 1, 1));
};

const Metric = ({label, value, color}: {label: string; value: string; color?: string}) => (
  <View style={styles.metric}>
    <PrimaryText size={10} color={color} style={styles.uppercase}>
      {label}
    </PrimaryText>
    <PrimaryText size={16} weight="bold" variant="number" color={color} numberOfLines={1} style={gs.mt5}>
      {value}
    </PrimaryText>
  </View>
);

const Pnl = ({value, currency}: {value: number; currency: TradingCurrency}) => {
  const colors = useThemeColors();
  const formatTrading = useTradingFormat(currency);
  return (
    <PrimaryText
      size={12}
      weight="semibold"
      variant="number"
      color={value < 0 ? colors.accentRed : value > 0 ? colors.accentGreen : colors.secondaryText}>
      {value > 0 ? '+' : ''}
      {formatTrading(value)}
    </PrimaryText>
  );
};

const shiftAnchor = (anchor: string, days: number) => {
  const time = new Date(`${anchor}T12:00:00`).getTime() + days * 86400000;
  return localDate(new Date(time));
};

const TradingScreen = () => {
  const colors = useThemeColors();
  const currentMonth = localDate().slice(0, 7);
  const today = localDate();
  const [month, setMonth] = useState(currentMonth);
  const [currency, setCurrency] = useState<TradingCurrency>(() => getTradingCurrency());
  const [range, setRange] = useState<'month' | 'week' | 'day'>('month');
  const [anchor, setAnchor] = useState(today);
  const [weekStart, setWeekStart] = useState<'sunday' | 'monday'>('monday');
  const [pairFilter, setPairFilter] = useState<string>('all');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<TradingStrategy[]>(() => resolveTradingStrategies());
  const [pairs, setPairs] = useState<TradingPair[]>(() => resolveTradingPairs());
  const [balances, setBalances] = useState<TradingBalanceRegistry | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tradeEditor, setTradeEditor] = useState<Trade | 'new' | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [syncReady, setSyncReady] = useState(true);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const formatTrading = useTradingFormat(currency);
  const formatPrice = useTradingPriceFormat(currency);

  const load = useCallback(
    async (pull = false) => {
      pull ? setRefreshing(true) : setLoading(true);
      try {
        const data = await readCloudData();
        setTrades([...(data.trades ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)));
        setStrategies(resolveTradingStrategies(data.tradingStrategyRegistry));
        setPairs(resolveTradingPairs(data.tradingPairRegistry));
        setBalances(data.tradingBalanceRegistry);
        setWeekStart(data.preferences?.weekStart ?? 'monday');
        setCurrency(data.preferences?.tradingCurrency ?? getTradingCurrency());
        setSyncReady(cloudProtocolVersion() >= 4);
        if (pairFilter !== 'all' && !resolveTradingPairs(data.tradingPairRegistry).some(pair => pair.id === pairFilter))
          setPairFilter('all');
        setError('');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load trades.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pairFilter],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const changeMonth = (next: string) => {
    setMonth(next);
    setAnchor(next === currentMonth ? today : `${next}-01`);
  };

  const switchCurrency = (next: TradingCurrency) => {
    if (next === currency) return;
    const previous = currency;
    setCurrency(next);
    void updateCloudPreferences({tradingCurrency: next}).catch(() => {
      setCurrency(previous);
      Alert.alert(
        'Could not save currency',
        'Check your connection and try again. Amounts are still shown in ' + previous + '.',
      );
    });
  };

  const opening = openingBalanceForMonth(balances, month);
  const monthly = useMemo(() => monthlyTradingSummary(trades, month, opening), [trades, month, opening]);
  const bounds = useMemo(
    () => tradeRangeBounds({month, range, anchor, weekStart, pair: pairFilter}),
    [month, range, anchor, weekStart, pairFilter],
  );
  const visible = useMemo(
    () => filterTrades(trades, {month, range, anchor, weekStart, pair: pairFilter}),
    [trades, month, range, anchor, weekStart, pairFilter],
  );
  const filteredStats = useMemo(() => summarizeTrades(visible), [visible]);
  const pairName = pairFilter === 'all' ? null : tradingPairLabel(pairs, pairFilter);
  const scopeLabel =
    range === 'month'
      ? `${monthLabel(month)}${pairName ? ` · ${pairName}` : ''}`
      : `${bounds.label}${pairName ? ` · ${pairName}` : ''}`;

  const removeTrade = (trade: Trade) => {
    Alert.alert('Delete this trade?', 'The monthly totals and reports will be recalculated.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteTrade(trade.id)
            .then(() => load())
            .catch(caught =>
              Alert.alert('Could not delete trade', caught instanceof Error ? caught.message : 'Please try again.'),
            );
        },
      },
    ]);
  };

  const openBalanceEditor = () => {
    setBalanceInput(opening ? String(opening) : '');
    setBalanceOpen(true);
  };

  const saveBalance = async () => {
    const numeric = Number(balanceInput);
    if (balanceInput.trim() === '' || !Number.isFinite(numeric) || numeric < 0 || numeric > 1e12) {
      Alert.alert('Check opening balance', 'Enter a balance of 0 or more.');
      return;
    }
    if (Math.abs(Math.round(numeric * 100) - numeric * 100) > 0.01) {
      Alert.alert('Check opening balance', 'Use at most two decimal places.');
      return;
    }
    setBalanceSaving(true);
    try {
      await saveOpeningBalance(month, numeric);
      setBalanceOpen(false);
      await load();
    } catch (caught) {
      Alert.alert('Could not save balance', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBalanceSaving(false);
    }
  };

  const directionColor = (trade: Trade) => (trade.direction === 'long' ? colors.accentGreen : colors.accentOrange);
  const outcome = (trade: Trade) => tradeOutcome(trade.pnl);
  const outcomeColor = (trade: Trade) =>
    outcome(trade) === 'win' ? colors.accentGreen : outcome(trade) === 'loss' ? colors.accentRed : colors.secondaryText;

  return (
    <PrimaryView colors={colors} useBottomPadding={false}>
      <HeaderContainer headerText="Trading" />
      <ScrollView
        style={gs.flex1}
        contentContainerStyle={[gs.pt15, gs.pb100]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
              onPress={() => changeMonth(shiftMonth(month, -1))}
              hitSlop={hitSlop}
              accessibilityLabel="Previous month">
              <Icon name="chevron-left" size={20} color={colors.buttonText} />
            </TouchableOpacity>
            <PrimaryText size={13} weight="semibold" color={colors.buttonText}>
              {monthLabel(month)}
            </PrimaryText>
            <TouchableOpacity
              disabled={month >= currentMonth}
              onPress={() => changeMonth(shiftMonth(month, 1))}
              hitSlop={hitSlop}
              accessibilityLabel="Next month">
              <Icon
                name="chevron-right"
                size={20}
                color={month >= currentMonth ? `${colors.buttonText}66` : colors.buttonText}
              />
            </TouchableOpacity>
          </View>

          <View style={[gs.rowBetweenCenter, gs.mt15]}>
            <PrimaryText size={10} color={colors.buttonText} style={{opacity: 0.75}}>
              1 USD = 105 INR
            </PrimaryText>
            <View
              style={[gs.rowCenter, gs.roundedFull, {backgroundColor: 'rgba(255,255,255,0.22)', padding: 2}]}
              accessibilityLabel="Trading currency">
              {(['USD', 'INR'] as const).map(value => {
                const selected = currency === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => switchCurrency(value)}
                    hitSlop={hitSlop}
                    style={[
                      gs.px10,
                      gs.roundedFull,
                      {paddingVertical: 4, backgroundColor: selected ? colors.buttonText : 'transparent'},
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{selected}}
                    accessibilityLabel={`Show amounts in ${value}`}>
                    <PrimaryText size={10} weight="semibold" color={selected ? colors.accentGreen : colors.buttonText}>
                      {value}
                    </PrimaryText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[gs.row, gs.gap8, gs.mt15]}>
            {(['month', 'week', 'day'] as const).map(value => {
              const selected = range === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    setRange(value);
                    if (value === 'month') setAnchor(month === currentMonth ? today : `${month}-01`);
                    else if (value === 'day' && (anchor.slice(0, 7) !== month || anchor > today))
                      setAnchor(month === currentMonth ? today : monthEnd(month));
                    else if (value === 'week' && (anchor.slice(0, 7) !== month || anchor > today))
                      setAnchor(month === currentMonth ? today : monthEnd(month));
                  }}
                  style={[
                    gs.flex1,
                    gs.py8,
                    gs.roundedFull,
                    gs.center,
                    {backgroundColor: selected ? colors.buttonText : 'rgba(255,255,255,0.22)'},
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{selected}}>
                  <PrimaryText size={11} weight="semibold" color={selected ? colors.accentGreen : colors.buttonText}>
                    {value === 'month' ? 'Month' : value === 'week' ? 'Week' : 'Day'}
                  </PrimaryText>
                </TouchableOpacity>
              );
            })}
          </View>
          {range !== 'month' ? (
            <View style={[gs.rowBetweenCenter, gs.mt10]}>
              <TouchableOpacity
                onPress={() => setAnchor(value => shiftAnchor(value, range === 'week' ? -7 : -1))}
                hitSlop={hitSlop}
                accessibilityLabel={range === 'week' ? 'Previous week' : 'Previous day'}>
                <Icon name="chevron-left" size={18} color={colors.buttonText} />
              </TouchableOpacity>
              <PrimaryText size={11} weight="semibold" color={colors.buttonText}>
                {bounds.label}
              </PrimaryText>
              <TouchableOpacity
                onPress={() => setAnchor(value => shiftAnchor(value, range === 'week' ? 7 : 1))}
                hitSlop={hitSlop}
                accessibilityLabel={range === 'week' ? 'Next week' : 'Next day'}>
                <Icon name="chevron-right" size={18} color={colors.buttonText} />
              </TouchableOpacity>
            </View>
          ) : null}

          <PrimaryText size={10} color={colors.buttonText} style={gs.mt15}>
            MONTHLY ACCOUNT · ALL PAIRS
          </PrimaryText>
          <View style={[gs.row, gs.mt10]}>
            <Metric label="Opening" value={formatTrading(monthly.openingBalance)} color={colors.buttonText} />
            <View style={styles.metricDivider} />
            <Metric label="Closing" value={formatTrading(monthly.closingBalance)} color={colors.buttonText} />
          </View>
          <View style={[gs.row, gs.mt15]}>
            <Metric
              label="Month PnL"
              value={`${monthly.netPnl > 0 ? '+' : ''}${formatTrading(monthly.netPnl)}`}
              color={colors.buttonText}
            />
            <View style={styles.metricDivider} />
            <Metric
              label="Avg plan"
              value={monthly.avgRiskReward === null ? '—' : `1:${monthly.avgRiskReward}`}
              color={colors.buttonText}
            />
          </View>
          <TouchableOpacity
            onPress={openBalanceEditor}
            hitSlop={hitSlop}
            style={[gs.rowCenter, gs.gap6, gs.mt15]}
            accessibilityRole="button"
            accessibilityLabel="Edit opening balance">
            <Icon name="pencil" size={13} color={colors.buttonText} />
            <PrimaryText size={11} weight="semibold" color={colors.buttonText}>
              {opening > 0 ? 'Edit opening balance' : 'Set opening balance'}
            </PrimaryText>
          </TouchableOpacity>
        </View>

        {syncReady ? null : (
          <View
            style={[
              gs.rowCenter,
              gs.gap10,
              gs.p14,
              gs.rounded12,
              gs.mb10,
              {backgroundColor: colors.secondaryBackground},
            ]}>
            <Icon name="alert-triangle" size={18} color={colors.accentOrange} />
            <PrimaryText size={11} color={colors.secondaryText} style={gs.flex1}>
              Trading sync needs a cloud update first. Your other data is unaffected — apply the latest cloud migration,
              then reload to journal trades.
            </PrimaryText>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[gs.gap8, gs.py12]}>
          {[{id: 'all', name: 'All pairs'}, ...pairs.map(pair => ({id: pair.id, name: pair.name}))].map(item => {
            const active = item.id === pairFilter;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setPairFilter(item.id)}
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
          })}
        </ScrollView>

        <View style={[gs.rowBetweenCenter, gs.mb10]}>
          <View style={{flex: 1, minWidth: 0, marginRight: 10}}>
            <PrimaryText size={16} weight="bold">
              Your trades
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText} style={gs.mt3} numberOfLines={2}>
              {range === 'month'
                ? 'Every closed trade in this month.'
                : range === 'week'
                  ? 'Trades in the selected week.'
                  : 'Trades on the selected day.'}
            </PrimaryText>
          </View>
          <View style={[gs.rowCenter, gs.gap8, gs.flexShrink]}>
            <TouchableOpacity
              onPress={() => setSetupOpen(true)}
              style={[
                gs.rowCenter,
                gs.gap6,
                gs.px12,
                gs.rounded12,
                {height: 40, backgroundColor: colors.secondaryAccent},
              ]}
              accessibilityLabel="Manage strategies and pairs"
              accessibilityRole="button">
              <Icon name="sliders-horizontal" size={16} color={colors.primaryText} />
              <PrimaryText size={11} weight="semibold">
                Setup
              </PrimaryText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTradeEditor('new')}
              disabled={!syncReady}
              style={[
                gs.size40,
                gs.center,
                gs.rounded12,
                {backgroundColor: colors.primaryText},
                !syncReady && gs.opacity60,
              ]}
              accessibilityLabel="Add trade"
              accessibilityRole="button">
              <Icon name="plus" size={20} color={colors.buttonText} />
            </TouchableOpacity>
          </View>
        </View>

        {filteredStats.count > 0 ? (
          <View style={[gs.row, gs.gap8, gs.mb10, {flexWrap: 'wrap'}]}>
            <View style={[styles.summaryMetric, gs.p12, gs.rounded12, {backgroundColor: colors.containerColor}]}>
              <PrimaryText size={9} color={colors.secondaryText}>
                TRADES
              </PrimaryText>
              <PrimaryText size={14} weight="bold" variant="number" style={gs.mt3}>
                {filteredStats.count}
              </PrimaryText>
            </View>
            <View style={[styles.summaryMetric, gs.p12, gs.rounded12, {backgroundColor: colors.containerColor}]}>
              <PrimaryText size={9} color={colors.secondaryText}>
                WON
              </PrimaryText>
              <PrimaryText size={14} weight="bold" variant="number" color={colors.accentGreen} style={gs.mt3}>
                {filteredStats.wins}
              </PrimaryText>
            </View>
            <View style={[styles.summaryMetric, gs.p12, gs.rounded12, {backgroundColor: colors.containerColor}]}>
              <PrimaryText size={9} color={colors.secondaryText}>
                LOST
              </PrimaryText>
              <PrimaryText size={14} weight="bold" variant="number" color={colors.accentRed} style={gs.mt3}>
                {filteredStats.losses}
              </PrimaryText>
            </View>
            <View style={[styles.summaryMetric, gs.p12, gs.rounded12, {backgroundColor: colors.containerColor}]}>
              <PrimaryText size={9} color={colors.secondaryText}>
                NET
              </PrimaryText>
              <View style={gs.mt3}>
                <Pnl value={filteredStats.netPnl} currency={currency} />
              </View>
            </View>
          </View>
        ) : null}

        {loading && trades.length === 0 ? (
          <View style={[gs.p20, gs.itemsCenter]}>
            <PrimaryText color={colors.secondaryText}>Loading trades…</PrimaryText>
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
        ) : trades.length === 0 ? (
          <View style={[gs.p20, gs.rounded16, gs.itemsCenter, {backgroundColor: colors.containerColor}]}>
            <View style={[gs.size50, gs.center, gs.rounded16, {backgroundColor: colors.secondaryAccent}]}>
              <Icon name="trending-up" size={24} color={colors.accentGreen} />
            </View>
            <PrimaryText size={15} weight="semibold" style={gs.mt10}>
              Start your trading journal
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText} style={[gs.mt5, gs.textCenter]}>
              Log where you entered, why you took it, and what it made or lost. Reports stay honest from day one.
            </PrimaryText>
            <View style={[gs.wFull, gs.mt15]}>
              <PrimaryButton
                colors={colors}
                buttonTitle={syncReady ? 'Add first trade' : 'Trading sync updating'}
                icon="plus"
                disabled={!syncReady}
                onPress={() => setTradeEditor('new')}
              />
            </View>
          </View>
        ) : visible.length === 0 ? (
          <View style={[gs.p15, gs.rounded12, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={12} color={colors.secondaryText} style={gs.textCenter}>
              No trades match this filter.
            </PrimaryText>
            <View style={gs.mt10}>
              <PrimaryButton
                colors={colors}
                buttonTitle="Show whole month"
                size="sm"
                variant="secondary"
                onPress={() => {
                  setRange('month');
                  setPairFilter('all');
                }}
              />
            </View>
          </View>
        ) : (
          visible.map(trade => {
            const open = expanded === trade.id;
            return (
              <View key={trade.id} style={[gs.rounded16, gs.mb10, {backgroundColor: colors.containerColor}]}>
                <TouchableOpacity
                  onPress={() => setExpanded(open ? null : trade.id)}
                  style={gs.p14}
                  accessibilityRole="button"
                  accessibilityLabel={`${tradingPairLabel(pairs, trade.pair)} ${trade.direction}, ${outcome(trade)}`}
                  accessibilityState={{expanded: open}}>
                  <View style={gs.rowBetweenCenter}>
                    <View style={[gs.rowCenter, gs.gap10, gs.flex1]}>
                      <View style={[gs.size40, gs.center, gs.rounded12, {backgroundColor: colors.secondaryAccent}]}>
                        <Icon
                          name={trade.direction === 'long' ? 'trending-up' : 'trending-down'}
                          size={19}
                          color={directionColor(trade)}
                        />
                      </View>
                      <View style={gs.flex1}>
                        <PrimaryText size={14} weight="semibold" numberOfLines={1}>
                          {tradingPairLabel(pairs, trade.pair)} · {trade.direction === 'long' ? 'Long' : 'Short'}{' '}
                          {trade.leverage}x
                        </PrimaryText>
                        <PrimaryText size={10} color={colors.secondaryText} style={gs.mt3} numberOfLines={1}>
                          {tradingStrategyLabel(strategies, trade.strategy)} · {trade.date} · 1:{trade.riskReward}
                        </PrimaryText>
                      </View>
                    </View>
                    <View style={gs.itemsEnd}>
                      <PrimaryText
                        size={14}
                        weight="bold"
                        variant="number"
                        color={outcomeColor(trade)}
                        numberOfLines={1}>
                        {trade.pnl > 0 ? '+' : ''}
                        {formatTrading(trade.pnl)}
                      </PrimaryText>
                      <View style={[gs.rowCenter, gs.gap4, gs.mt3]}>
                        <View style={[gs.size8, gs.roundedFull, {backgroundColor: outcomeColor(trade)}]} />
                        <PrimaryText size={9} color={outcomeColor(trade)}>
                          {outcome(trade) === 'win' ? 'Win' : outcome(trade) === 'loss' ? 'Loss' : 'Breakeven'}
                        </PrimaryText>
                      </View>
                    </View>
                  </View>
                  <View style={[gs.row, gs.mt15]}>
                    <View style={gs.flex1}>
                      <PrimaryText size={9} color={colors.secondaryText}>
                        AVG PRICE
                      </PrimaryText>
                      <PrimaryText size={12} variant="number" style={gs.mt3} numberOfLines={1}>
                        {formatPrice(trade.avgPrice)}
                      </PrimaryText>
                    </View>
                    <View style={gs.flex1}>
                      <PrimaryText size={9} color={colors.secondaryText}>
                        REASON
                      </PrimaryText>
                      <PrimaryText size={12} style={gs.mt3} numberOfLines={1}>
                        {trade.reason}
                      </PrimaryText>
                    </View>
                    <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} color={colors.secondaryText} />
                  </View>
                </TouchableOpacity>

                {open ? (
                  <View style={[gs.px14, gs.pb20]}>
                    <View style={{height: 1, backgroundColor: colors.secondaryAccent}} />
                    <View style={[gs.p12, gs.rounded12, gs.mt10, {backgroundColor: colors.secondaryAccent}]}>
                      <PrimaryText size={11} color={colors.secondaryText}>
                        {trade.reason}
                      </PrimaryText>
                    </View>
                    <View style={[gs.row, gs.gap8, gs.mt8]}>
                      <View style={gs.flex1}>
                        <PrimaryButton
                          colors={colors}
                          buttonTitle="Edit trade"
                          icon="pencil"
                          size="sm"
                          variant="ghost"
                          onPress={() => setTradeEditor(trade)}
                        />
                      </View>
                      <View style={gs.flex1}>
                        <PrimaryButton
                          colors={colors}
                          buttonTitle="Delete"
                          icon="trash-2"
                          size="sm"
                          variant="ghost"
                          onPress={() => removeTrade(trade)}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {trades.length > 0 ? (
          <TradingReports
            trades={visible}
            scopeLabel={scopeLabel}
            pairs={pairs}
            strategies={strategies}
            currency={currency}
          />
        ) : null}
      </ScrollView>

      <TradeEditor
        visible={tradeEditor !== null}
        trade={tradeEditor === 'new' ? undefined : (tradeEditor ?? undefined)}
        pairs={pairs}
        strategies={strategies}
        currency={currency}
        onClose={() => setTradeEditor(null)}
        onManageSetup={() => {
          setTradeEditor(null);
          setSetupOpen(true);
        }}
        onSaved={() => void load()}
      />
      <TradingSetupManager
        visible={setupOpen}
        strategies={strategies}
        pairs={pairs}
        trades={trades}
        onClose={() => setSetupOpen(false)}
        onSaved={() => load()}
      />
      <Modal visible={balanceOpen} animationType="slide" transparent onRequestClose={() => setBalanceOpen(false)}>
        <View style={[gs.flex1, gs.justifyEnd, {backgroundColor: 'rgba(0,0,0,0.5)'}]}>
          <View style={[gs.p20, gs.roundedTop15, {backgroundColor: colors.primaryBackground}]}>
            <PrimaryText size={16} weight="bold">
              Opening balance · {monthLabel(month)}
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText} style={[gs.mt3, gs.mb15]}>
              Closing is opening plus every trade closed this month. Entered in {currency}.
            </PrimaryText>
            <CustomInput
              input={balanceInput}
              setInput={setBalanceInput}
              colors={colors}
              placeholder="e.g. 10000"
              label={`Opening balance (${currency})`}
              keyboardType="decimal-pad"
              maxLength={15}
            />
            <View style={[gs.row, gs.gap8, gs.mt10]}>
              <View style={gs.flex1}>
                <PrimaryButton
                  colors={colors}
                  buttonTitle="Cancel"
                  variant="secondary"
                  onPress={() => setBalanceOpen(false)}
                />
              </View>
              <View style={gs.flex1}>
                <PrimaryButton
                  colors={colors}
                  buttonTitle="Save"
                  loading={balanceSaving}
                  onPress={() => void saveBalance()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </PrimaryView>
  );
};

const styles = StyleSheet.create({
  summaryMetric: {flexGrow: 1, flexBasis: '40%', minWidth: 0},
  metric: {flex: 1, minWidth: 0},
  metricDivider: {width: 1, marginHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.28)'},
  uppercase: {textTransform: 'uppercase', opacity: 0.75},
});

export default TradingScreen;
