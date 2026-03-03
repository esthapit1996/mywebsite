import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n/i18n';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../images/GopherDebt_Mascot.png';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, login } = useAuth();
  const { theme, setTheme, currentTheme, themes } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(email, password, name);
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('register.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div className="theme-dropdown">
          <select
            className="theme-select"
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            title={t('settings.language')}
            style={{ fontSize: '0.85rem' }}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
            ))}
          </select>
        </div>
        <div className="theme-dropdown">
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>{t('header.themeLabel')}</span>
          <span className="theme-icon">{currentTheme.icon}</span>
          <select 
            className="theme-select" 
            value={theme} 
            onChange={(e) => setTheme(e.target.value)}
          >
            {themes.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="auth-card card">
        <div className="auth-header">
          <img src={logo} alt="GopherDebt" className="auth-logo" />
          <h1 className="notranslate">GopherDebt</h1>
          <p className="motto notranslate" style={{ fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.7, marginBottom: '8px' }}>GopherDebt Good, GoForDebt Bad.</p>
          <p>{t('register.subtitle')}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('register.name')}</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('register.namePlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.email')}</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('register.emailPlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.password')}</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('register.passwordPlaceholder')}
              minLength={6}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? t('register.creating') : t('register.createAccount')}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {t('register.hasAccount')}{' '}
            <Link to="/login">{t('register.signIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
