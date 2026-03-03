import { useState, useRef, useEffect, ReactNode, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from './i18n/i18n';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { CurrencyProvider } from './context/CurrencyContext';
import api from './services/api';
import logo from './images/GopherDebt_Mascot.png';
import Avatar from './components/Avatar';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy-loaded page components — each gets its own chunk
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'));
const Suggestions = lazy(() => import('./pages/Suggestions'));
const CurrencyConverter = lazy(() => import('./pages/CurrencyConverter'));
const CurrencyPicker = lazy(() => import('./pages/CurrencyPicker'));
const Members = lazy(() => import('./pages/Members'));
const Settings = lazy(() => import('./pages/Settings'));
const Community = lazy(() => import('./pages/Community'));
const GopherStash = lazy(() => import('./pages/GopherStash'));

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

function Header(): JSX.Element | null {
  const { user, logout } = useAuth();
  const { theme, setTheme, currentTheme, themes } = useTheme();
  const { t, i18n } = useTranslation();
  const [showUserMenu, setShowUserMenu] = useState(false);
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
        <Link to="/" className="logo" onClick={handleLogoClick} title={location.pathname === '/' ? t('header.refreshApp') : t('header.goToDashboard')}>
          <img src={logo} alt="GopherDebt" className="header-logo" />
          <span className="notranslate">
            GopherDebt
            <span className="motto">GopherDebt Good, GoForDebt Bad.</span>
          </span>
        </Link>
        <nav className="nav">
          {/* Language Picker — next to profile button */}
          <select
            value={i18n.language}
            onChange={(e) => {
              i18n.changeLanguage(e.target.value);
              api.updateLanguage(e.target.value).catch(() => {});
            }}
            title={t('settings.language')}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              padding: '4px 8px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              marginRight: '8px',
            }}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
            ))}
          </select>

          {/* User Menu Dropdown — universal menu */}
          <div className="user-menu" ref={menuRef}>
            <button 
              className="user-menu-trigger"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Avatar name={user.name} avatar={user.avatar} size={26} />
                <span className="notranslate">{user.name.split(' ')[0]}</span>
              </span>
              <span className="dropdown-arrow">{showUserMenu ? '▲' : '▼'}</span>
            </button>
            
            {showUserMenu && (
              <div className="user-menu-dropdown">
                {/* Theme Picker */}
                <div className="user-menu-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('header.themeLabel')}</span>
                  <select 
                    className="theme-select-inline" 
                    value={theme} 
                    onChange={(e) => setTheme(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    title={t('header.selectTheme')}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text)',
                      padding: '4px 6px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    <optgroup label={t('header.darkThemes')}>
                      {themes.filter(t => t.category === 'dark').map(t => (
                        <option key={t.id} value={t.id}>
                          {t.icon} {t.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={t('header.lightThemes')}>
                      {themes.filter(t => t.category === 'light').map(t => (
                        <option key={t.id} value={t.id}>
                          {t.icon} {t.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="user-menu-divider"></div>

                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/payment-history')}
                >
                  {t('header.paymentHistory')}
                </button>
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/suggestions')}
                >
                  {t('header.suggestionBox')}
                </button>
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/currency')}
                >
                  {t('header.currencyConverter')}
                </button>
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/community')}
                >
                  {t('header.community')}
                </button>
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/settings')}
                >
                  {t('header.settings')}
                </button>
                <div className="user-menu-divider"></div>
                <button 
                  className="user-menu-item user-menu-logout"
                  onClick={handleLogout}
                >
                  {t('header.signOut')}
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

function AppRoutes(): JSX.Element {
  return (
    <>
      <Header />
      <Suspense fallback={<LoadingSpinner />}>
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
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stash"
            element={
              <ProtectedRoute>
                <GopherStash />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community"
            element={
              <ProtectedRoute>
                <Community />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
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
