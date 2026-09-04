import {useState, useCallback, useRef} from 'react';
import useThemeColors from '../../hooks/useThemeColors';
import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import {selectUserId} from '../../redux/slice/userIdSlice';
import {createCurrency} from '../../cloud';
import {setIsOnboarded} from '../../redux/slice/isOnboardedSlice';
import currencies from '../../../assets/jsons/currencies.json';
import {useDialog} from '../../context/DialogContext';

interface CurrencySelection {
  code: string;
  symbol: string;
  name: string;
}

const useChooseCurrency = () => {
  const colors = useThemeColors();
  const {showAlert} = useDialog();
  const [search, setSearch] = useState('');
  const [filteredCurrencies, setFilteredCurrencies] = useState(currencies);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencySelection | null>(null);
  const userId = useAppSelector(selectUserId);
  const dispatch = useAppDispatch();

  // Guards a double-tap on Continue, which would otherwise create two currency
  // rows before the stack swaps away from onboarding.
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCurrencySubmit = useCallback(async () => {
    if (!selectedCurrency || isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await createCurrency(selectedCurrency.code, selectedCurrency.symbol, selectedCurrency.name, userId);

      dispatch(setIsOnboarded(true));
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving currency:', error);
      }
      // Let the user retry rather than stranding them pre-onboarding.
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      await showAlert({type: 'error', message: 'Currency could not be saved. Check your connection and try again.'});
    }
  }, [selectedCurrency, userId, dispatch, showAlert]);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    const filtered = currencies.filter(currency => {
      const {code, name, symbol} = currency;
      const searchItem = text.toLowerCase();

      return (
        code.toLowerCase().includes(searchItem) ||
        name.toLowerCase().includes(searchItem) ||
        symbol.toLowerCase().includes(searchItem)
      );
    });
    setFilteredCurrencies(filtered);
  }, []);

  const handleCurrencySelect = useCallback((currency: CurrencySelection) => {
    setSelectedCurrency(currency);
  }, []);

  return {
    colors,
    search,
    filteredCurrencies,
    selectedCurrency,
    isSubmitting,
    handleCurrencySubmit,
    handleSearch,
    handleCurrencySelect,
  };
};

export default useChooseCurrency;
