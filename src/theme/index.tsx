import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Theme, ThemeMode } from '@/types';
import { lightColors, darkColors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius } from './spacing';
import { useAsyncStorage, STORAGE_KEYS } from '@/hooks/useAsyncStorage';

// Create light and dark theme objects
const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  typography,
  spacing,
  borderRadius,
};

const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  typography,
  spacing,
  borderRadius,
};

// Theme context
interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const { data: storedThemeMode, setData: setStoredThemeMode } = useAsyncStorage<ThemeMode>(
    STORAGE_KEYS.THEME_MODE,
    'system'
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Initialize theme mode from storage
  useEffect(() => {
    if (storedThemeMode) {
      setThemeModeState(storedThemeMode);
    }
  }, [storedThemeMode]);

  // Determine effective theme based on mode
  const getEffectiveTheme = (): Theme => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? darkTheme : lightTheme;
    }
    return themeMode === 'dark' ? darkTheme : lightTheme;
  };

  const theme = getEffectiveTheme();
  const isDark = theme.mode === 'dark';

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await setStoredThemeMode(mode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  const value: ThemeContextType = {
    theme,
    themeMode,
    setThemeMode,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use theme
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Export themes and utilities
export { lightTheme, darkTheme };
export * from './colors';
export * from './typography';
export * from './spacing'; 