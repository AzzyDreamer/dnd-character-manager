import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ─── Глобальные настройки приложения ───
// Язык хранится отдельно через i18next (LanguageDetector + localStorage),
// здесь — только флаги режимов, которые читают другие части приложения.

export interface AppSettings {
  /** Режим разработчика: расширенная диагностика, отладочная информация. */
  devMode: boolean;
  /** Режим полного редактирования персонажа: можно менять что угодно без ограничений правил. */
  fullEditMode: boolean;
}

interface SettingsContextType extends AppSettings {
  setDevMode: (value: boolean) => void;
  setFullEditMode: (value: boolean) => void;
  toggleDevMode: () => void;
  toggleFullEditMode: () => void;
}

const STORAGE_KEY = 'dnd-settings';

const DEFAULT_SETTINGS: AppSettings = {
  devMode: false,
  fullEditMode: false,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (error) {
    console.error('Ошибка при загрузке настроек:', error);
    return DEFAULT_SETTINGS;
  }
}

const SettingsContext = createContext<SettingsContextType>({
  ...DEFAULT_SETTINGS,
  setDevMode: () => {},
  setFullEditMode: () => {},
  toggleDevMode: () => {},
  toggleFullEditMode: () => {},
});

export const useSettings = () => useContext(SettingsContext);
export { SettingsContext };

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
    }
  }, [settings]);

  const setDevMode = useCallback((value: boolean) => {
    setSettings(s => ({ ...s, devMode: value }));
  }, []);

  const setFullEditMode = useCallback((value: boolean) => {
    setSettings(s => ({ ...s, fullEditMode: value }));
  }, []);

  const toggleDevMode = useCallback(() => {
    setSettings(s => ({ ...s, devMode: !s.devMode }));
  }, []);

  const toggleFullEditMode = useCallback(() => {
    setSettings(s => ({ ...s, fullEditMode: !s.fullEditMode }));
  }, []);

  return (
    <SettingsContext.Provider
      value={{ ...settings, setDevMode, setFullEditMode, toggleDevMode, toggleFullEditMode }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
