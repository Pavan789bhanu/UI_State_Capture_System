import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'midnight';
type AccentColor = 'indigo' | 'purple' | 'blue' | 'emerald' | 'rose' | 'amber';
type FontSize = 'small' | 'medium' | 'large';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectsEnabled: boolean;
  setEffectsEnabled: (enabled: boolean) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
  compactMode: boolean;
  setCompactMode: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'midnight';
  });
  const [effectsEnabled, setEffectsEnabled] = useState(() => {
    const saved = localStorage.getItem('effectsEnabled');
    return saved !== 'false';
  });
  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    const saved = localStorage.getItem('accentColor');
    return (saved as AccentColor) || 'indigo';
  });
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const saved = localStorage.getItem('fontSize');
    return (saved as FontSize) || 'medium';
  });
  const [reducedMotion, setReducedMotion] = useState(() => {
    const saved = localStorage.getItem('reducedMotion');
    return saved === 'true';
  });
  const [compactMode, setCompactMode] = useState(() => {
    const saved = localStorage.getItem('compactMode');
    return saved === 'true';
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('effectsEnabled', String(effectsEnabled));
  }, [effectsEnabled]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
    localStorage.setItem('accentColor', accentColor);
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion));
    localStorage.setItem('reducedMotion', String(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    document.documentElement.setAttribute('data-compact', String(compactMode));
    localStorage.setItem('compactMode', String(compactMode));
  }, [compactMode]);

  useEffect(() => {
    // Trigger login animation
    setIsLoaded(true);
  }, []);

  return (
    <ThemeContext.Provider value={{ 
      theme, setTheme, 
      effectsEnabled, setEffectsEnabled,
      accentColor, setAccentColor,
      fontSize, setFontSize,
      reducedMotion, setReducedMotion,
      compactMode, setCompactMode
    }}>
      <div className={isLoaded ? 'animate-fade-in-up' : 'opacity-0'}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
