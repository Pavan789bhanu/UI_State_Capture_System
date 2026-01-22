import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'midnight';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectsEnabled: boolean;
  setEffectsEnabled: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'light';
  });
  const [effectsEnabled, setEffectsEnabled] = useState(() => {
    const saved = localStorage.getItem('effectsEnabled');
    return saved !== 'false';
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
    // Trigger login animation
    setIsLoaded(true);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectsEnabled, setEffectsEnabled }}>
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
