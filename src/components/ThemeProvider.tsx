/**
 * Theme Provider - resolves light/dark/system and toggles the `.dark` class
 * on <html> so both Tailwind `dark:` utilities and the `.dark .foo` component
 * styles respond to the user's choice.
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useSettingsStore } from '@/store/quizStore';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, animationsEnabled, setTheme: setThemeStore } = useSettingsStore();
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.anim = animationsEnabled ? 'on' : 'off';
    }
  }, [animationsEnabled]);

  const apply = useCallback((t: Theme) => {
    const dark = t === 'dark' || (t === 'system' && systemPrefersDark());
    setResolvedTheme(dark ? 'dark' : 'light');
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.toggle('dark', dark);
      root.classList.toggle('light', t === 'light');
    }
  }, []);

  useEffect(() => {
    // Resolving the theme on mount / on an explicit user change is the whole
    // job of this provider; the one state write per theme change is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    apply(theme);
  }, [theme, apply]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, apply]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: setThemeStore }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
