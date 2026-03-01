import { useState, useRef, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { CurrencyProvider, useCurrency } from './context/CurrencyContext';
import logo from './images/GopherDebt_Mascot.png';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import PaymentHistory from './pages/PaymentHistory';
import Suggestions from './pages/Suggestions';
import CurrencyConverter from './pages/CurrencyConverter';

function ProtectedRoute({ children }) {
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

  return children;
}

function PublicRoute({ children }) {
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

  return children;
}

function Header() {
  const { user, logout } = useAuth();
  const { theme, setTheme, currentTheme, themes } = useTheme();
  const { displayCurrency, setDisplayCurrency, currentCurrency, currencies, ratesLoading } = useCurrency();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const menuRef = useRef(null);
  const currencyMenuRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (currencyMenuRef.current && !currencyMenuRef.current.contains(event.target)) {
        setShowCurrencyMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleNavigation = (path) => {
    setShowUserMenu(false);
    navigate(path);
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
  };

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <img src={logo} alt="GopherDebt" className="header-logo" />
          GopherDebt
        </Link>
        <nav className="nav">
          {/* Currency Display Selector - Grid Dropdown */}
          <div className="currency-grid-dropdown" ref={currencyMenuRef}>
            <button 
              className="currency-trigger"
              onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
              title="Display amounts in"
            >
              <span>{ratesLoading ? '⏳' : currentCurrency.symbol}</span>
              <span style={{ fontSize: '0.7rem', marginLeft: '2px' }}>{showCurrencyMenu ? '▲' : '▼'}</span>
            </button>
            
            {showCurrencyMenu && (
              <div className="currency-grid-menu">
                <div className="currency-grid">
                  {currencies.map(c => (
                    <button
                      key={c.code}
                      className={`currency-grid-item ${displayCurrency === c.code ? 'active' : ''}`}
                      onClick={() => {
                        setDisplayCurrency(c.code);
                        setShowCurrencyMenu(false);
                      }}
                      title={c.name}
                    >
                      <span className="currency-symbol">{c.symbol}</span>
                      <span className="currency-code">{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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
              <span>👤 {user.name}</span>
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
                <button 
                  className="user-menu-item"
                  onClick={() => handleNavigation('/currency')}
                >
                  💱 Currency Converter
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

function AppRoutes() {
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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default function App() {
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
