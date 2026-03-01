import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { useTheme } from './ThemeContext';
import type { User, AuthContextType, ApiResponse, LoginResponse } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { loadUserTheme } = useTheme();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (): Promise<void> => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await api.getProfile();
        if (response.data) {
          setUser(response.data);
          // Load user's saved theme preference
          if (response.data.theme_preference) {
            loadUserTheme(response.data.theme_preference);
          }
        }
      } catch {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const login = async (email: string, password: string): Promise<ApiResponse<LoginResponse>> => {
    const response = await api.login(email, password);
    if (response.data?.user) {
      setUser(response.data.user);
      // Load user's saved theme preference
      if (response.data.user.theme_preference) {
        loadUserTheme(response.data.user.theme_preference);
      }
    }
    return response;
  };

  const register = async (email: string, password: string, name: string): Promise<ApiResponse> => {
    const response = await api.register(email, password, name);
    return response;
  };

  const logout = (): void => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
