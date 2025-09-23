import { Store } from './store';
import { DocState } from './types';

// This is a placeholder for the actual AppSettings type
export type PanelPercentPosition = { xPct: number; yPct: number };

export type AppSettings = {
  theme: 'light' | 'dark' | 'system';
  panelPositions: Record<string, PanelPercentPosition>;
};

type GlobalState = {
  doc: DocState | null;
  settings: AppSettings;
};

const defaultSettings: AppSettings = {
  theme: 'system',
  panelPositions: {},
};

const STORAGE_KEY = 'app-settings';

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AppSettings;
      return { ...defaultSettings, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error);
  }
  
  return defaultSettings;
}

function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
  }
}


class SettingsStore extends Store<GlobalState> {
  constructor() {
    super({
      doc: null,
      settings: loadSettings(),
    });
  }
  
  setTheme(theme: 'light' | 'dark' | 'system') {
    const newSettings = { ...this.getState().settings, theme };
    this.setState({ settings: newSettings });
    saveSettings(newSettings);
    
    // Apply theme to document
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  
  setPanelPosition(key: string, pos: PanelPercentPosition) {
    const { settings } = this.getState();
    const newPositions = { ...settings.panelPositions, [key]: pos };
    const newSettings = { ...settings, panelPositions: newPositions };
    this.setState({ settings: newSettings });
    saveSettings(newSettings);
  }
}

export const settingsStore = new SettingsStore();

// Initialize theme and system theme changes listener
if (typeof window !== 'undefined') {
  const settings = settingsStore.getState().settings;
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const currentSettings = settingsStore.getState().settings;
    if (currentSettings.theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
}
