import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const CurrencyContext = createContext();

export const DISPLAY_CURRENCIES = [
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
];

export function useCurrency() {
  return useContext(CurrencyContext);
}

export function CurrencyProvider({ children }) {
  const [displayCurrency, setDisplayCurrencyState] = useState(() => {
    const saved = localStorage.getItem('gopherdebt-display-currency');
    return saved || 'EUR';
  });
  
  const [rates, setRates] = useState({});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);

  // Fetch rates when display currency changes (if not EUR)
  useEffect(() => {
    const fetchRates = async () => {
      if (displayCurrency === 'EUR') {
        setRates({});
        return;
      }

      // Cache rates for 1 hour
      const cacheKey = `gopherdebt-rates-EUR-${displayCurrency}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { rate, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) { // 1 hour
          setRates({ [displayCurrency]: rate });
          return;
        }
      }

      setRatesLoading(true);
      try {
        const result = await api.convertCurrency('EUR', displayCurrency, 1);
        setRates({ [displayCurrency]: result.rate });
        localStorage.setItem(cacheKey, JSON.stringify({
          rate: result.rate,
          timestamp: Date.now()
        }));
        setLastFetched(Date.now());
      } catch (err) {
        console.error('Failed to fetch rates:', err);
      } finally {
        setRatesLoading(false);
      }
    };

    fetchRates();
  }, [displayCurrency]);

  const setDisplayCurrency = useCallback((currency) => {
    setDisplayCurrencyState(currency);
    localStorage.setItem('gopherdebt-display-currency', currency);
  }, []);

  // Convert EUR amount to display currency
  const convertAmount = useCallback((eurAmount) => {
    if (!eurAmount || displayCurrency === 'EUR') {
      return eurAmount;
    }
    const rate = rates[displayCurrency];
    if (!rate) return eurAmount;
    return eurAmount * rate;
  }, [displayCurrency, rates]);

  // Format amount in display currency
  const formatAmount = useCallback((eurAmount, options = {}) => {
    const { showCode = false, decimals = 2 } = options;
    const currentCurrency = DISPLAY_CURRENCIES.find(c => c.code === displayCurrency) || DISPLAY_CURRENCIES[0];
    
    if (displayCurrency === 'EUR') {
      const formatted = Number(eurAmount).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      return showCode ? `€${formatted} EUR` : `€${formatted}`;
    }

    const rate = rates[displayCurrency];
    if (!rate) {
      // Fallback to EUR if no rate available
      const formatted = Number(eurAmount).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      return showCode ? `€${formatted} EUR` : `€${formatted}`;
    }

    const converted = eurAmount * rate;
    const formatted = Number(converted).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    
    return showCode 
      ? `${currentCurrency.symbol}${formatted} ${displayCurrency}`
      : `${currentCurrency.symbol}${formatted}`;
  }, [displayCurrency, rates]);

  const currentCurrency = DISPLAY_CURRENCIES.find(c => c.code === displayCurrency) || DISPLAY_CURRENCIES[0];

  const value = {
    displayCurrency,
    setDisplayCurrency,
    currentCurrency,
    currencies: DISPLAY_CURRENCIES,
    convertAmount,
    formatAmount,
    ratesLoading,
    hasRate: displayCurrency === 'EUR' || !!rates[displayCurrency],
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}
