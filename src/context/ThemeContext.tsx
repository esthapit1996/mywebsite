import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import api from '../services/api';
import type { Theme, ThemeContextType } from '../types';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Themes sorted from darkest to brightest, with category labels
export const THEMES: Theme[] = [
  // Dark themes
  { id: 'darkknight', name: 'Dark Knight', icon: '🦇', category: 'dark' },
  { id: 'espresso', name: 'Espresso', icon: '☕', category: 'dark' },
  { id: 'dracula', name: 'Dracula', icon: '🧛', category: 'dark' },
  { id: 'monokai', name: 'Monokai', icon: '🪵', category: 'dark' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: '🤖', category: 'dark' },
  { id: 'ocean', name: 'Ocean', icon: '🌊', category: 'dark' },
  { id: 'matcha', name: 'Matcha', icon: '🍵', category: 'dark' },
  { id: 'rosegold', name: 'Rose Gold', icon: '🌹', category: 'dark' },
  { id: 'purplehaze', name: 'Purple Haze', icon: '🔮', category: 'dark' },
  // Light themes
  { id: 'lavender', name: 'Lavender', icon: '💜', category: 'light' },
  { id: 'sakura', name: 'Sakura', icon: '🌸', category: 'light' },
  { id: 'cottoncandy', name: 'Cotton Candy', icon: '🍬', category: 'light' },
  { id: 'solarized', name: 'Solarized', icon: '☀️', category: 'light' },
  { id: 'flashbang', name: 'Flashbang', icon: '💥', category: 'light' },
];

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<string>(() => {
    // Default to dark, but check localStorage first
    const saved = localStorage.getItem('gopherdebt-theme');
    return saved || 'darkknight';
  });

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gopherdebt-theme', theme);
  }, [theme]);

  // Function to set theme and optionally sync to backend
  const setTheme = useCallback(async (newTheme: string, syncToBackend: boolean = true): Promise<void> => {
    setThemeState(newTheme);
    
    // Try to sync to backend if user is logged in
    if (syncToBackend && localStorage.getItem('token')) {
      try {
        await api.updateTheme(newTheme);
      } catch (err) {
        // Silently fail - theme still applied locally
        console.log('Failed to sync theme to backend:', err);
      }
    }
  }, []);

  // Function to load theme from user profile (called after login)
  const loadUserTheme = useCallback((userTheme: string): void => {
    if (userTheme && THEMES.some(t => t.id === userTheme)) {
      setThemeState(userTheme);
      localStorage.setItem('gopherdebt-theme', userTheme);
    }
  }, []);

  const currentTheme = useMemo(() => THEMES.find(t => t.id === theme) || THEMES[0], [theme]);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    setTheme,
    loadUserTheme,
    currentTheme,
    themes: THEMES,
  }), [theme, setTheme, loadUserTheme, currentTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
