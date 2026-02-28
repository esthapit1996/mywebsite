import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useTheme } from './ThemeContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { loadUserTheme } = useTheme();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await api.getProfile();
        setUser(response.data);
        // Load user's saved theme preference
        if (response.data?.theme_preference) {
          loadUserTheme(response.data.theme_preference);
        }
      } catch (err) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const response = await api.login(email, password);
    setUser(response.data.user);
    // Load user's saved theme preference
    if (response.data.user?.theme_preference) {
      loadUserTheme(response.data.user.theme_preference);
    }
    return response;
  };

  const register = async (email, password, name) => {
    const response = await api.register(email, password, name);
    return response;
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
