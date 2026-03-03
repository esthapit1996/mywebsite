import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../images/GopherDebt_Mascot.png';

const greetingKeys = [
  'login.greeting1', 'login.greeting2', 'login.greeting3', 'login.greeting4',
  'login.greeting5', 'login.greeting6', 'login.greeting7', 'login.greeting8',
  'login.greeting9', 'login.greeting10',
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [greetingKey] = useState(() => greetingKeys[Math.floor(Math.random() * greetingKeys.length)]);
  const { login } = useAuth();
  const { theme, setTheme, currentTheme, themes } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="theme-dropdown" style={{ position: 'absolute', top: 20, right: 20 }}>
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
      <div className="auth-card card">
        <div className="auth-header">
          <img src={logo} alt="GopherDebt" className="auth-logo" />
          <h1 className="notranslate">GopherDebt</h1>
          <p className="motto notranslate" style={{ fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.7, marginBottom: '8px' }}>GopherDebt Good, GoForDebt Bad.</p>
          <p>{t(greetingKey)}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('login.email')}</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('login.password')}</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {t('login.noAccount')}{' '}
            <Link to="/register">{t('login.createOne')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
