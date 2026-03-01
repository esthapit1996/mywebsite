import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const POPULAR_CURRENCIES = [
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
];

export default function CurrencyConverter() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('1');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyData, setHistoryData] = useState([]);
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
      setError(err.message || 'Failed to convert currency');
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

  // Fetch history when currencies or period change
  useEffect(() => {
    const fetchHistory = async () => {
      if (fromCurrency === toCurrency) {
        setHistoryData([]);
        return;
      }
      setHistoryLoading(true);
      try {
        const data = await api.getCurrencyHistory(fromCurrency, toCurrency, historyPeriod);
        setHistoryData(data.history || []);
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setHistoryData([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [fromCurrency, toCurrency, historyPeriod]);

  const getCurrencySymbol = (code) => {
    const currency = POPULAR_CURRENCIES.find(c => c.code === code);
    return currency ? currency.symbol : '';
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <button className="btn-back" onClick={() => navigate('/')} style={{ position: 'absolute', left: '1rem' }}>
          ← Back to Dashboard
        </button>
        <h1>💱 Currency Converter</h1>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">From</label>
              <select
                className="form-input"
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                style={{ fontSize: '1.1rem', padding: '0.75rem' }}
              >
                {POPULAR_CURRENCIES.map(currency => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn"
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
                {POPULAR_CURRENCIES.map(currency => (
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
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {getCurrencySymbol(toCurrency)} {result.converted.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4
                })}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>📈 {fromCurrency}/{toCurrency} Trend</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${historyPeriod === 7 ? 'btn-primary' : ''}`}
                onClick={() => setHistoryPeriod(7)}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                7D
              </button>
              <button
                className={`btn ${historyPeriod === 30 ? 'btn-primary' : ''}`}
                onClick={() => setHistoryPeriod(30)}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                1M
              </button>
              <button
                className={`btn ${historyPeriod === 90 ? 'btn-primary' : ''}`}
                onClick={() => setHistoryPeriod(90)}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                3M
              </button>
              <button
                className={`btn ${historyPeriod === 365 ? 'btn-primary' : ''}`}
                onClick={() => setHistoryPeriod(365)}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                1Y
              </button>
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
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading trend data...</span>
            </div>
          ) : historyData.length > 0 ? (
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={historyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => {
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
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.toFixed(4)}
                    width={60}
                  />
                  <Tooltip 
                    formatter={(value) => [value.toFixed(6), 'Rate']}
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
              No historical data available for this currency pair
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
