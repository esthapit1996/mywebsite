import { useState, useRef, useEffect, ReactNode } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { CurrencyProvider } from './context/CurrencyContext';
import logo from './images/GopherDebt_Mascot.png';
import Avatar from './components/Avatar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import PaymentHistory from './pages/PaymentHistory';
import Suggestions from './pages/Suggestions';
import CurrencyConverter from './pages/CurrencyConverter';
import CurrencyPicker from './pages/CurrencyPicker';
import Members from './pages/Members';
import Settings from './pages/Settings';
import Community from './pages/Community';

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
        <Link to="/" className="logo" onClick={handleLogoClick} title={location.pathname === '/' ? 'Refresh app' : 'Go to dashboard'}>
          <img src={logo} alt="GopherDebt" className="header-logo" />
          <span>
            GopherDebt
            <span className="motto">GopherDebt Good, GoForDebt Bad.</span>
          </span>
        </Link>
        <nav className="nav">
          {/* User Menu Dropdown — universal menu */}
          <div className="user-menu" ref={menuRef}>
            <button 
              className="user-menu-trigger"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Avatar name={user.name} avatar={user.avatar} size={26} />
                {user.name.split(' ')[0]}
              </span>
              <span className="dropdown-arrow">{showUserMenu ? '▲' : '▼'}</span>
            </button>
            
            {showUserMenu && (
              <div className="user-menu-dropdown">
                {/* Theme Picker */}
                <div className="user-menu-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default' }}>
                  <select 
                    className="theme-select-inline" 
                    value={theme} 
                    onChange={(e) => setTheme(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    title="Select theme"
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

                <div className="user-menu-divider"></div>

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
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/currency')}
                >
                  💱 Currency Converter
                </button>
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/community')}
                >
                  🐹 GopherDebt Community
                </button>
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/settings')}
                >
                  ⚙️ Settings
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
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
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
