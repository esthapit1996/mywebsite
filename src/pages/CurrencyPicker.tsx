import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../context/CurrencyContext';

export default function CurrencyPicker(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { displayCurrency, setDisplayCurrency, currencies, ratesLoading } = useCurrency();

  const handleSelect = (code: string) => {
    setDisplayCurrency(code);
    navigate(-1);
  };

  return (
    <div className="container" style={{ maxWidth: '520px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
          {t('common.backToDashboard')}
        </Link>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px' }}>{t('currencyPicker.title')}</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          {t('currencyPicker.subtitle')}
        </p>
      </div>

      {ratesLoading ? (
        <div className="text-center" style={{ padding: '2rem' }}>{t('currencyPicker.loadingRates')}</div>
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
              <span style={{ fontSize: '0.7rem', marginTop: '4px', opacity: 0.8 }} className="notranslate">{c.code}</span>
            </button>
          ))}
        </div>
      )}


    </div>
  );
}
