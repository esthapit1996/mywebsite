import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../services/api';
import type { CurrencyInfo, CurrencyContextType, FormatOptions } from '../types';

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const DISPLAY_CURRENCIES: CurrencyInfo[] = [
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
];

export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

interface CurrencyProviderProps {
  children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const [displayCurrency, setDisplayCurrencyState] = useState<string>(() => {
    const saved = localStorage.getItem('gopherdebt-display-currency');
    return saved || 'EUR';
  });
  
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesLoading, setRatesLoading] = useState<boolean>(false);

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
      } catch (err) {
        console.error('Failed to fetch rates:', err);
      } finally {
        setRatesLoading(false);
      }
    };

    fetchRates();
  }, [displayCurrency]);

  const setDisplayCurrency = useCallback((currency: string): void => {
    setDisplayCurrencyState(currency);
    localStorage.setItem('gopherdebt-display-currency', currency);
  }, []);

  // Convert EUR amount to display currency
  const convertAmount = useCallback((eurAmount: number): number => {
    if (!eurAmount || displayCurrency === 'EUR') {
      return eurAmount;
    }
    const rate = rates[displayCurrency];
    if (!rate) return eurAmount;
    return eurAmount * rate;
  }, [displayCurrency, rates]);

  // Format amount in display currency
  const formatAmount = useCallback((eurAmount: number, options: FormatOptions = {}): string => {
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

  const value: CurrencyContextType = {
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
