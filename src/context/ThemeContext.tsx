import React, {createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode} from 'react';
import {useColorScheme} from 'react-native';
import StorageService, {storage} from '../utils/asyncStorageService';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type DarkThemeVariant = 'classic' | 'midnight' | 'ghost';

export const DARK_THEME_VARIANTS: ReadonlyArray<{id: DarkThemeVariant; accent: string}> = [
  {id: 'classic', accent: '#B1FB98'},
  {id: 'midnight', accent: '#5B8DEF'},
  {id: 'ghost', accent: '#E8E8E8'},
];

const DARK_VARIANT_KEY = 'darkThemeVariant';

export const isDarkThemeVariant = (value: unknown): value is DarkThemeVariant =>
  DARK_THEME_VARIANTS.some(variant => variant.id === value);

export interface ThemeColors {
  primaryBackground: string;
  primaryText: string;
  secondaryBackground: string;
  secondaryText: string;
  accentGreen: string;
  accentOrange: string;
  accentBlue: string;
  buttonText: string;
  containerColor: string;
  cardBackground: string;
  secondaryContainerColor: string;
  secondaryAccent: string;
  iconContainer: string;
  sameBlack: string;
  sameWhite: string;
  accentRed: string;
  lightAccent: string;
}

const LightColors: ThemeColors = {
  primaryBackground: '#FAFAF8',
  primaryText: '#1A1A1A',
  secondaryBackground: '#E4E9D8',
  secondaryText: '#505050',
  accentGreen: '#6E8B3D',
  accentOrange: '#B86E00',
  accentBlue: '#1E90FF',
  buttonText: '#FFFFFF',
  containerColor: '#ECEEE7',
  cardBackground: '#E8EAE3',
  secondaryContainerColor: '#E4E9D8',
  iconContainer: '#E4E9D8',
  secondaryAccent: '#EEEFE9',
  sameBlack: '#000000',
  sameWhite: '#FAFBF7',
  accentRed: '#C4503C',
  lightAccent: '#F5F6F2',
};

const DarkColors: ThemeColors = {
  primaryBackground: '#212121',
  primaryText: '#ECECEC',
  secondaryBackground: '#383838',
  secondaryText: '#B4B4B4',
  accentGreen: '#B1FB98',
  accentOrange: '#FFA500',
  accentBlue: '#7AA5FF',
  buttonText: '#000000',
  containerColor: '#2A2A2A',
  cardBackground: '#2F2F2F',
  secondaryContainerColor: '#2A2A2A',
  secondaryAccent: '#383838',
  iconContainer: '#383838',
  sameBlack: '#000000',
  sameWhite: '#FAFBF7',
  accentRed: '#FF6347',
  lightAccent: '#383838',
};

const DarkMidnightColors: ThemeColors = {
  primaryBackground: '#212121',
  primaryText: '#ECECEC',
  secondaryBackground: '#383838',
  secondaryText: '#A8B0C2',
  accentGreen: '#5B8DEF',
  accentOrange: '#FFA500',
  accentBlue: '#8AA9FF',
  buttonText: '#FFFFFF',
  containerColor: '#2A2A2A',
  cardBackground: '#2F2F2F',
  secondaryContainerColor: '#2A2A2A',
  secondaryAccent: '#383838',
  iconContainer: '#383838',
  sameBlack: '#000000',
  sameWhite: '#FAFBF7',
  accentRed: '#FF6347',
  lightAccent: '#383838',
};

const DarkGhostColors: ThemeColors = {
  primaryBackground: '#1A1A1A',
  primaryText: '#ECECEC',
  secondaryBackground: '#383838',
  secondaryText: '#B4B4B4',
  accentGreen: '#E8E8E8',
  accentOrange: '#C9C9C9',
  accentBlue: '#A8A8A8',
  buttonText: '#000000',
  containerColor: '#2A2A2A',
  cardBackground: '#2F2F2F',
  secondaryContainerColor: '#2A2A2A',
  secondaryAccent: '#383838',
  iconContainer: '#383838',
  sameBlack: '#000000',
  sameWhite: '#FAFBF7',
  accentRed: '#FF6347',
  lightAccent: '#383838',
};

export const resolveDarkColors = (variant: DarkThemeVariant): ThemeColors => {
  switch (variant) {
    case 'midnight':
      return DarkMidnightColors;
    case 'ghost':
      return DarkGhostColors;
    case 'classic':
    default:
      return DarkColors;
  }
};

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  darkVariant: DarkThemeVariant;
  setDarkVariant: (variant: DarkThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const getInitialThemeMode = (): ThemeMode => {
  const saved = StorageService.getItemSync('themePreference');
  if (saved && ['light', 'dark', 'system'].includes(saved)) {
    return saved as ThemeMode;
  }
  return 'system';
};

const getInitialDarkVariant = (): DarkThemeVariant => {
  const saved = StorageService.getItemSync(DARK_VARIANT_KEY);
  return isDarkThemeVariant(saved) ? saved : 'classic';
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({children}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);
  const [darkVariant, setDarkVariantState] = useState<DarkThemeVariant>(getInitialDarkVariant);
  useEffect(() => {
    const listener = storage.addOnValueChangedListener(key => {
      if (key === 'themePreference') {
        setThemeModeState(getInitialThemeMode());
      }
      if (key === DARK_VARIANT_KEY) {
        setDarkVariantState(getInitialDarkVariant());
      }
    });
    return () => listener.remove();
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  const colors = useMemo(() => {
    return resolvedTheme === 'dark' ? resolveDarkColors(darkVariant) : LightColors;
  }, [resolvedTheme, darkVariant]);

  const isDark = resolvedTheme === 'dark';

  // No Appearance listener needed: useColorScheme() above already re-renders
  // this provider when the system theme changes.

  const setThemeMode = useCallback((mode: ThemeMode) => {
    StorageService.setItemSync('themePreference', mode);
    setThemeModeState(mode);
  }, []);

  const setDarkVariant = useCallback((variant: DarkThemeVariant) => {
    StorageService.setItemSync(DARK_VARIANT_KEY, variant);
    setDarkVariantState(variant);
  }, []);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      colors,
      isDark,
      setThemeMode,
      darkVariant,
      setDarkVariant,
    }),
    [themeMode, resolvedTheme, colors, isDark, setThemeMode, darkVariant, setDarkVariant],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const useThemeColors = (): ThemeColors => {
  const {colors} = useTheme();
  return colors;
};

export default ThemeContext;
