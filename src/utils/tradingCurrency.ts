import StorageService from './asyncStorageService';
import type {TradingCurrency} from '../trading/model';

/**
 * Display denomination for the trading journal. Most trading happens in USD,
 * so USD is the default — existing users see no change until they opt in to
 * INR. Stored trade numbers are denomination-agnostic; this only changes the
 * lens (1 USD = 105 INR). Synced via display preferences like week start.
 */

const TRADING_CURRENCY_KEY = 'tradingCurrency';
const VALID_VALUES: TradingCurrency[] = ['USD', 'INR'];

export const getTradingCurrency = (): TradingCurrency => {
  const saved = StorageService.getItemSync(TRADING_CURRENCY_KEY);
  if (saved && (VALID_VALUES as string[]).includes(saved)) {
    return saved as TradingCurrency;
  }
  return 'USD';
};

export const setTradingCurrency = (currency: TradingCurrency): void => {
  StorageService.setItemSync(TRADING_CURRENCY_KEY, currency);
};
