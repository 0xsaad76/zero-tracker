import {useMemo} from 'react';
import {formatAmountWithSymbol} from '../utils/numberUtils';
import {convertTradingAmount, type TradingCurrency} from './model';

/** Narrow symbols for the journal lens (independent of the account currency). */
export const tradingCurrencySymbol = (currency: TradingCurrency): string => (currency === 'INR' ? '₹' : '$');

/** Display formatter: converts at the fixed journal rate, then formats with the lens currency. */
export const createTradingFormatter =
  (currency: TradingCurrency) =>
  (amount: number): string =>
    formatAmountWithSymbol(convertTradingAmount(amount, currency), currency);

export const useTradingFormat = (currency: TradingCurrency): ((amount: number) => string) =>
  useMemo(() => createTradingFormatter(currency), [currency]);

const priceLocales: Record<TradingCurrency, string> = {USD: 'en-US', INR: 'en-IN'};

/** Average prices keep up to 8 decimals (dust-level crypto prices survive INR conversion). */
export const createTradingPriceFormatter =
  (currency: TradingCurrency) =>
  (amount: number): string => {
    const converted = convertTradingAmount(amount, currency);
    if (!Number.isFinite(converted)) return '0';
    try {
      return new Intl.NumberFormat(priceLocales[currency], {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 8,
      }).format(converted);
    } catch {
      return `${tradingCurrencySymbol(currency)}${converted}`;
    }
  };

export const useTradingPriceFormat = (currency: TradingCurrency): ((amount: number) => string) =>
  useMemo(() => createTradingPriceFormatter(currency), [currency]);
