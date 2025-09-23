import { useState, useEffect } from 'react';
import { settingsStore, AppSettings } from './settingsStore';

const defaultColors = {
  primary: '#3b82f6',
  primaryForeground: '#ffffff',
  badgeText: '#ffffff',
  border: '#e5e7eb',
  shadow: 'rgba(0,0,0,0.4)',
  background: '#ffffff',
  dots: '#e5e7eb',
};

function getCanvasColors(): typeof defaultColors {
    if (typeof window === 'undefined') {
        return defaultColors;
    }
    const styles = getComputedStyle(document.documentElement);
    const getColor = (name: string) => styles.getPropertyValue(name).trim();
    
    return {
      primary: getColor('--canvas-primary') || defaultColors.primary,
      primaryForeground: getColor('--canvas-primary-foreground') || defaultColors.primaryForeground,
      badgeText: getColor('--canvas-badge-text') || defaultColors.badgeText,
      border: getColor('--canvas-border') || defaultColors.border,
      shadow: getColor('--canvas-shadow') || defaultColors.shadow,
      background: getColor('--canvas-background') || defaultColors.background,
      dots: getColor('--canvas-dots') || defaultColors.dots,
    };
}

export function useTheme() {
  const [settings, setSettings] = useState<AppSettings>(settingsStore.getState().settings);
  const [colors, setColors] = useState(getCanvasColors);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    const unsubscribe = settingsStore.subscribe(state => {
      setSettings(state.settings);
      // Force update colors when theme changes
      const timeoutId = setTimeout(() => {
        setColors(getCanvasColors());
      }, 10); // Small delay to ensure DOM is updated
      return () => clearTimeout(timeoutId);
    });
    return unsubscribe;
  }, []);

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    settingsStore.setTheme(theme);
  };

  const toggleTheme = () => {
    const currentTheme = settings.theme;
    if (currentTheme === 'light') {
      setTheme('dark');
    } else if (currentTheme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const isDarkMode = isHydrated && (settings.theme === 'dark' || 
    (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches));

  return { 
    isDarkMode: isHydrated ? isDarkMode : false, 
    theme: isHydrated ? settings.theme : 'system',
    isHydrated,
    toggleTheme,
    setTheme,
    colors,
  };
}
