import {useCallback, useMemo, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {readCloudData, type CloudData} from '../../cloud/records';
import {useFeatureFlags} from '../../features/flags';
import {incomeTotal, incomesForMonth} from '../../income/model';
import {portfolioSummary} from '../../investments/model';
import {monthlyTradingSummary, openingBalanceForMonth, type TradingCurrency} from '../../trading/model';
import {getTradingCurrency} from '../../utils/tradingCurrency';

export interface Overview {
  /** Null while the feature is off or nothing has loaded yet. */
  income: number | null;
  debts: {net: number; people: number} | null;
  investing: {value: number | null; count: number; due: number} | null;
  trading: {netPnl: number; count: number; currency: TradingCurrency} | null;
}

type Snapshot = Pick<
  CloudData,
  'incomes' | 'debts' | 'debtors' | 'investments' | 'trades' | 'tradingBalanceRegistry' | 'preferences'
>;

/** Pure so the month maths can be tested without a cloud snapshot round-trip. */
export function buildOverview(
  data: Snapshot,
  month: string,
  features: {income: boolean; debts: boolean; investing: boolean; trading: boolean},
  fallbackCurrency: TradingCurrency = 'USD',
): Overview {
  let debts: Overview['debts'] = null;
  if (features.debts) {
    // Same convention as the Debts tab: borrowed counts against you, lent counts for you.
    const cents = data.debts.reduce(
      (sum, debt) => sum + (debt.type === 'Borrow' ? 1 : -1) * Math.round(debt.amount * 100),
      0,
    );
    debts = {net: cents / 100, people: data.debtors.length};
  }

  let investing: Overview['investing'] = null;
  if (features.investing) {
    const summary = portfolioSummary(data.investments ?? [], month);
    investing = {value: summary.value, count: summary.count, due: summary.due};
  }

  let trading: Overview['trading'] = null;
  if (features.trading) {
    const summary = monthlyTradingSummary(
      data.trades ?? [],
      month,
      openingBalanceForMonth(data.tradingBalanceRegistry, month),
    );
    trading = {
      netPnl: summary.netPnl,
      count: summary.count,
      currency: data.preferences?.tradingCurrency ?? fallbackCurrency,
    };
  }

  return {
    income: features.income ? incomeTotal(incomesForMonth(data.incomes ?? [], month)) : null,
    debts,
    investing,
    trading,
  };
}

const EMPTY: Overview = {income: null, debts: null, investing: null, trading: null};

/**
 * Month-at-a-glance numbers for the optional features, refreshed whenever
 * Home regains focus. Silent on failure: Home keeps the last good numbers
 * instead of replacing them with an error on a flaky connection.
 */
export function useOverview(month: string, refreshKey: unknown): Overview {
  const features = useFeatureFlags();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void readCloudData()
        .then(data => {
          if (alive) setSnapshot(data);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
      // refreshKey changes after a pull-to-refresh or a deleted row.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey]),
  );

  return useMemo(
    () => (snapshot ? buildOverview(snapshot, month, features, getTradingCurrency()) : EMPTY),
    [snapshot, month, features],
  );
}
