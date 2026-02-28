import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../images/GopherDebt_Mascot.png';

const funGreetings = [
  "The gopher remembers who owes what... 🐹",
  "Back for more debt drama? Let's go!",
  "Your debts missed you! 💸",
  "Money never forgets. Neither do we. 🐹",
  "Time to settle some scores!",
  "Who owes you money today? 🤔",
  "The gopher has been expecting you...",
  "Ready to chase some IOUs? 🏃",
  "Friendships are priceless. Dinners aren't.",
  "Split bills, not friendships! 🤝",
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [greeting] = useState(() => funGreetings[Math.floor(Math.random() * funGreetings.length)]);
  const { login } = useAuth();
  const { theme, setTheme, currentTheme, themes } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
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
          <h1>GopherDebt</h1>
          <p>{greeting}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
