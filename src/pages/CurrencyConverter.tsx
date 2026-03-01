import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { useCurrency, DISPLAY_CURRENCIES } from '../context/CurrencyContext';
import type { CurrencyConvertResponse, CurrencyHistoryPoint } from '../types';

const CURRENCIES = DISPLAY_CURRENCIES;

export default function CurrencyConverter() {
  const navigate = useNavigate();
  const { displayCurrency } = useCurrency();
  const [amount, setAmount] = useState('1');
  const [fromCurrency, setFromCurrency] = useState(() => displayCurrency);
  const [toCurrency, setToCurrency] = useState(() => displayCurrency === 'USD' ? 'EUR' : 'USD');
  const [result, setResult] = useState<CurrencyConvertResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<CurrencyHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState(7);

  const convert = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.convertCurrency(fromCurrency, toCurrency, amount);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert currency');
    } finally {
      setLoading(false);
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setResult(null);
  };

  // Auto-convert when currencies or amount change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (amount && parseFloat(amount) > 0) {
        convert();
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [amount, fromCurrency, toCurrency]);

  const [historyError, setHistoryError] = useState<string>('');

  // Fetch history when currencies or period change
  useEffect(() => {
    const fetchHistory = async () => {
      if (fromCurrency === toCurrency) {
        setHistoryData([]);
        setHistoryError('');
        return;
      }
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const data = await api.getCurrencyHistory(fromCurrency, toCurrency, historyPeriod);
        setHistoryData(data.history || []);
        setHistoryError((data as any).error || '');
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setHistoryData([]);
        setHistoryError('');
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [fromCurrency, toCurrency, historyPeriod]);

  const getCurrencySymbol = (code: string): string => {
    const currency = CURRENCIES.find(c => c.code === code);
    return currency ? currency.symbol : '';
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0 }}>💱 Currency Converter</h1>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/')}
          >
            ← Back
          </button>
        </div>
        <p className="subtitle">Convert between currencies with live exchange rates</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {error && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Amount Input */}
          <div className="form-group">
            <label className="form-label">Amount</label>
            <input
              type="number"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min="0"
              step="0.01"
              style={{ fontSize: '1.5rem', padding: '1rem' }}
            />
          </div>

          {/* Currency Selection */}
          <div className="currency-select-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">From</label>
              <select
                className="form-input"
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                style={{ fontSize: '1.1rem', padding: '0.75rem' }}
              >
                {CURRENCIES.filter(c => c.code !== toCurrency).map(currency => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn currency-swap-btn"
              onClick={swapCurrencies}
              style={{ 
                marginTop: '1.5rem', 
                padding: '0.75rem 1rem',
                fontSize: '1.2rem',
                background: 'var(--secondary)',
              }}
              title="Swap currencies"
            >
              ⇄
            </button>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">To</label>
              <select
                className="form-input"
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                style={{ fontSize: '1.1rem', padding: '0.75rem' }}
              >
                {CURRENCIES.filter(c => c.code !== fromCurrency).map(currency => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Result Display */}
          {loading ? (
            <div className="text-center" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Converting...</span>
            </div>
          ) : result && (
            <div style={{ 
              background: 'var(--bg-secondary)', 
              padding: '1.5rem', 
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div className="converter-result" style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {getCurrencySymbol(toCurrency)} {result.converted.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4
                })}
              </div>
              <div className="converter-rate-detail" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {getCurrencySymbol(fromCurrency)} {parseFloat(amount).toLocaleString()} {fromCurrency} = {getCurrencySymbol(toCurrency)} {result.converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {toCurrency}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Rate: 1 {fromCurrency} = {result.rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} {toCurrency}
              </div>
            </div>
          )}

          {/* Convert Button */}
          <button
            className="btn btn-primary"
            onClick={convert}
            disabled={loading || !amount}
            style={{ padding: '1rem', fontSize: '1.1rem' }}
          >
            {loading ? 'Converting...' : 'Convert'}
          </button>
        </div>
        <div style={{ textAlign: 'right', marginTop: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
          Powered by <a href="https://open.er-api.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Open Exchange Rates</a>
        </div>
      </div>

      {/* Historical Trend Chart */}
      {fromCurrency !== toCurrency && (
        <div className="card" style={{ maxWidth: '600px', margin: '1.5rem auto' }}>
          <div className="trend-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>📈 {fromCurrency}/{toCurrency} Trend</h3>
            <div className="trend-periods" style={{ display: 'flex', gap: '0.5rem' }}>
              {[7, 30, 90, 365].map(period => (
                <button
                  key={period}
                  className={`btn ${historyPeriod === period ? 'btn-primary' : ''}`}
                  onClick={() => setHistoryPeriod(period)}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  {period === 7 ? '7D' : period === 30 ? '1M' : period === 90 ? '3M' : '1Y'}
                </button>
              ))}
            </div>
          </div>

          {historyLoading ? (
            <div className="text-center" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading trend data...</span>
            </div>
          ) : historyData.length > 0 ? (
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={historyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: '#ffffff' }}
                    stroke="#ffffff"
                    tickFormatter={(value: string) => {
                      const date = new Date(value);
                      if (historyPeriod >= 365) {
                        return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
                      }
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                    interval={historyPeriod >= 365 ? 30 : historyPeriod >= 90 ? 10 : 'preserveStartEnd'}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11, fill: '#ffffff' }}
                    stroke="#ffffff"
                    tickFormatter={(value: number) => value.toFixed(4)}
                    width={60}
                  />
                  <Tooltip 
                    formatter={(value) => [typeof value === 'number' ? value.toFixed(6) : value, 'Rate']}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{ 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="var(--primary)" 
                    strokeWidth={2}
                    dot={historyPeriod <= 7}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
              <div>No historical data available</div>
              {historyError ? (
                <div style={{ fontSize: '0.85rem', marginTop: '6px', color: 'var(--warning)' }}>
                  {historyError}
                </div>
              ) : (() => {
                const ecbCurrencies = ['AUD','BRL','CAD','CHF','CNY','CZK','DKK','EUR','GBP','HKD','HUF','IDR','ILS','INR','ISK','JPY','KRW','MXN','MYR','NOK','NZD','PHP','PLN','RON','SEK','SGD','THB','TRY','USD','ZAR'];
                const unsupported = [fromCurrency, toCurrency].filter(c => !ecbCurrencies.includes(c));
                return unsupported.length > 0 ? (
                  <div style={{ fontSize: '0.85rem', marginTop: '6px', color: 'var(--warning)' }}>
                    {unsupported.join(', ')} {unsupported.length === 1 ? 'is' : 'are'} not supported by the ECB for trend data
                  </div>
                ) : null;
              })()}
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
            Data by <a href="https://www.frankfurter.app" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Frankfurter</a> · <a href="https://www.ecb.europa.eu" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>European Central Bank</a>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: '600px', margin: '1.5rem auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          💡 Live rates cached for 1 hour · Historical data cached for 24 hours
        </p>
      </div>
    </div>
  );
}
