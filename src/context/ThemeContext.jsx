import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const ThemeContext = createContext();

// Themes sorted from darkest to brightest, with category labels
export const THEMES = [
  // Dark themes
  { id: 'dark', name: 'Dark', icon: '🌙', category: 'dark' },
  { id: 'espresso', name: 'Espresso', icon: '☕', category: 'dark' },
  { id: 'dracula', name: 'Dracula', icon: '🧛', category: 'dark' },
  { id: 'monokai', name: 'Monokai', icon: '🪵', category: 'dark' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: '🤖', category: 'dark' },
  { id: 'ocean', name: 'Ocean', icon: '🌊', category: 'dark' },
  { id: 'matcha', name: 'Matcha', icon: '🍵', category: 'dark' },
  { id: 'rosegold', name: 'Rose Gold', icon: '🌹', category: 'dark' },
  // Light themes
  { id: 'lavender', name: 'Lavender', icon: '💜', category: 'light' },
  { id: 'sakura', name: 'Sakura', icon: '🌸', category: 'light' },
  { id: 'solarized', name: 'Solarized', icon: '☀️', category: 'light' },
  { id: 'light', name: 'Light', icon: '🌤️', category: 'light' },
];

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // Default to dark, but check localStorage first
    const saved = localStorage.getItem('gopherdebt-theme');
    return saved || 'dark';
  });

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gopherdebt-theme', theme);
  }, [theme]);

  // Function to set theme and optionally sync to backend
  const setTheme = useCallback(async (newTheme, syncToBackend = true) => {
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
  const loadUserTheme = useCallback((userTheme) => {
    if (userTheme && THEMES.some(t => t.id === userTheme)) {
      setThemeState(userTheme);
      localStorage.setItem('gopherdebt-theme', userTheme);
    }
  }, []);

  const currentTheme = THEMES.find(t => t.id === theme) || THEMES[1];

  const value = {
    theme,
    setTheme,
    loadUserTheme,
    currentTheme,
    themes: THEMES,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
