import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/utils/theme';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  theme: typeof colors.light | typeof colors.dark;
  isFirstLaunch: boolean;
  setIsFirstLaunch: (value: boolean) => void;
}

const defaultValue: ThemeContextType = {
  isDarkMode: false,
  toggleTheme: () => {},
  theme: colors.light,
  isFirstLaunch: true,
  setIsFirstLaunch: () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaultValue);

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);

  useEffect(() => {
    const initializeTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('isDarkMode');
        if (storedTheme !== null) {
          setIsDarkMode(storedTheme === 'true');
        } else {
          setIsDarkMode(systemColorScheme === 'dark');
        }

        const firstLaunch = await AsyncStorage.getItem('isFirstLaunch');
        if (firstLaunch === null) {
          setIsFirstLaunch(true);
          await AsyncStorage.setItem('isFirstLaunch', 'false');
        } else {
          setIsFirstLaunch(false);
        }
      } catch (error) {
        console.error('Error reading theme from storage:', error);
      }
    };

    initializeTheme();
  }, [systemColorScheme]);

  const toggleTheme = async () => {
    try {
      const newValue = !isDarkMode;
      setIsDarkMode(newValue);
      await AsyncStorage.setItem('isDarkMode', String(newValue));
    } catch (error) {
      console.error('Error saving theme to storage:', error);
    }
  };

  const theme = isDarkMode ? colors.dark : colors.light;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme, isFirstLaunch, setIsFirstLaunch }}>
      {children}
    </ThemeContext.Provider>
  );
};