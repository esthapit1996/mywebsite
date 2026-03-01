import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext';

export default function CurrencyPicker(): JSX.Element {
  const navigate = useNavigate();
  const { displayCurrency, setDisplayCurrency, currencies, ratesLoading } = useCurrency();

  const handleSelect = (code: string) => {
    setDisplayCurrency(code);
    navigate(-1);
  };

  return (
    <div className="container" style={{ maxWidth: '520px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px' }}>💰 Display Currency</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          All amounts in the app will be shown in this currency
        </p>
      </div>

      {ratesLoading ? (
        <div className="text-center" style={{ padding: '2rem' }}>Loading rates...</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: '10px',
        }}>
          {currencies.map(c => (
            <button
              key={c.code}
              onClick={() => handleSelect(c.code)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 8px',
                background: displayCurrency === c.code ? 'var(--primary)' : 'var(--card-bg)',
                color: displayCurrency === c.code ? 'white' : 'var(--text)',
                border: displayCurrency === c.code ? '2px solid var(--primary)' : '2px solid var(--border)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontSize: '1rem',
              }}
              title={c.name}
            >
              <span style={{ fontSize: '1.4rem', fontWeight: 600 }}>{c.symbol}</span>
              <span style={{ fontSize: '0.7rem', marginTop: '4px', opacity: 0.8 }}>{c.code}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    </div>
  );
}
