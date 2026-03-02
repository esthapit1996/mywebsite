import { useState, useRef, useEffect, ReactNode } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { CurrencyProvider, useCurrency } from './context/CurrencyContext';
import api from './services/api';
import logo from './images/GopherDebt_Mascot.png';
import Avatar from './components/Avatar';
import AvatarPicker from './components/AvatarPicker';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import PaymentHistory from './pages/PaymentHistory';
import Suggestions from './pages/Suggestions';
import CurrencyConverter from './pages/CurrencyConverter';
import CurrencyPicker from './pages/CurrencyPicker';
import Members from './pages/Members';

interface RouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: RouteProps): JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-container">
        <div className="card text-center">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: RouteProps): JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-container">
        <div className="card text-center">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function ChangePasswordModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (oldPassword === newPassword) {
      setError('New password must be different from old password');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(oldPassword, newPassword, confirmPassword);
      setSuccess('Password changed successfully!');
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔒 Change Password</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className="form-input"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter current password"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 chars)"
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type new password"
              required
              minLength={6}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Header(): JSX.Element | null {
  const { user, logout, refreshUser } = useAuth();
  const { theme, setTheme, currentTheme, themes } = useTheme();
  const { currentCurrency, ratesLoading } = useCurrency();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleNavigation = (path: string) => {
    setShowUserMenu(false);
    navigate(path);
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      // Clear cached rates
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('gopherdebt-rates-')) {
          localStorage.removeItem(key);
        }
      });
      window.location.reload();
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo" onClick={handleLogoClick} title={location.pathname === '/' ? 'Refresh app' : 'Go to dashboard'}>
          <img src={logo} alt="GopherDebt" className="header-logo" />
          <span>
            GopherDebt
            <span className="motto">GopherDebt Good, GoForDebt Bad.</span>
          </span>
        </Link>
        <nav className="nav">
          {/* Currency Display Selector */}
          <button
            className="currency-trigger"
            onClick={() => navigate('/currency-picker')}
            title="Change display currency"
          >
            <span>{ratesLoading ? '⏳' : currentCurrency.symbol}</span>
          </button>

          <div className="theme-dropdown">
            <select 
              className="theme-select" 
              value={theme} 
              onChange={(e) => setTheme(e.target.value)}
              title="Select theme"
            >
              <optgroup label="🌙 Dark Themes">
                {themes.filter(t => t.category === 'dark').map(t => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="☀️ Light Themes">
                {themes.filter(t => t.category === 'light').map(t => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          
          {/* User Menu Dropdown */}
          <div className="user-menu" ref={menuRef}>
            <button 
              className="user-menu-trigger"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Avatar name={user.name} avatar={user.avatar} size={26} />
                {user.name}
              </span>
              <span className="dropdown-arrow">{showUserMenu ? '▲' : '▼'}</span>
            </button>
            
            {showUserMenu && (
              <div className="user-menu-dropdown">
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/payment-history')}
                >
                  📜 My Payment History
                </button>
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/suggestions')}
                >
                  💡 Suggestion Box
                </button>
                {user.email === 'evansthapit20@gmail.com' && (
                  <button 
                    className="user-menu-item"
                    onClick={() => handleNavigation('/members')}
                  >
                    👥 Members
                  </button>
                )}
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/currency')}
                >
                  💱 Currency Converter
                </button>
                <button 
                  className="user-menu-item"
                  onClick={() => { setShowUserMenu(false); setShowAvatarPicker(true); }}
                >
                  🖼️ Change Avatar
                </button>
                <button 
                  className="user-menu-item"
                  onClick={() => { setShowUserMenu(false); setShowPasswordModal(true); }}
                >
                  🔒 Reset Password
                </button>
                <div className="user-menu-divider"></div>
                <button 
                  className="user-menu-item user-menu-logout"
                  onClick={handleLogout}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showAvatarPicker && (
        <AvatarPicker
          currentAvatar={user.avatar}
          userName={user.name}
          onClose={() => setShowAvatarPicker(false)}
          onAvatarChange={() => refreshUser()}
        />
      )}
    </header>
  );
}

function AppRoutes(): JSX.Element {
  return (
    <>
      <Header />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:id"
          element={
            <ProtectedRoute>
              <GroupDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment-history"
          element={
            <ProtectedRoute>
              <PaymentHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suggestions"
          element={
            <ProtectedRoute>
              <Suggestions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/currency"
          element={
            <ProtectedRoute>
              <CurrencyConverter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/currency-picker"
          element={
            <ProtectedRoute>
              <CurrencyPicker />
            </ProtectedRoute>
          }
        />
        <Route
          path="/members"
          element={
            <ProtectedRoute>
              <Members />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <CurrencyProvider>
        <div className="app">
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </div>
      </CurrencyProvider>
    </ThemeProvider>
  );
}
