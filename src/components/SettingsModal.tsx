import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Settings, X, Globe, Code2, Pencil, FolderOpen, RefreshCw, DownloadCloud } from 'lucide-react';
import i18n from '../i18n';
import { useSettings } from './SettingsProvider';
import { isTauri } from '../utils/isTauri';

interface SettingsModalProps {
  onClose: () => void;
}

// Поддерживаемые языки (см. src/i18n/index.ts), подписи — на родном языке.
const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];

const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
      checked ? 'bg-gold/70' : 'bg-bg-secondary border border-border-default'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

// Секция самообновления (только десктоп). Кнопка тихо проверяет манифест через
// pointer-индирекцию (см. src-tauri/src/updater.rs); если есть новее — предлагает
// скачать и перезапуститься. Утилита тянется динамически, чтобы @tauri-apps/* не
// попал в веб-бандл.
type UpdateStatus = 'idle' | 'checking' | 'available' | 'uptodate' | 'installing' | 'error';

const DesktopUpdatesSection: React.FC = () => {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [version, setVersion] = useState<string>('');

  const onCheck = async () => {
    setStatus('checking');
    try {
      const { checkUpdate } = await import('../utils/updater');
      const info = await checkUpdate();
      if (info.available) {
        setVersion(info.version);
        setStatus('available');
      } else {
        setStatus('uptodate');
      }
    } catch {
      setStatus('error');
    }
  };

  const onInstall = async () => {
    setStatus('installing');
    try {
      const { installUpdate } = await import('../utils/updater');
      // Успех завершается перезапуском приложения — управление сюда не вернётся.
      await installUpdate();
    } catch {
      setStatus('error');
    }
  };

  const busy = status === 'checking' || status === 'installing';

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <DownloadCloud size={16} className="text-gold/70" />
          {t('settings.updates')}
        </div>
        <p className="text-xs text-text-muted mt-1">
          {status === 'available' || status === 'installing'
            ? t('settings.updateAvailable', { version })
            : status === 'uptodate'
            ? t('settings.upToDate')
            : status === 'error'
            ? t('settings.updateError')
            : t('settings.updatesDesc')}
        </p>
      </div>
      {status === 'available' || status === 'installing' ? (
        <button
          onClick={onInstall}
          disabled={busy}
          className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-gold/20 text-gold border border-gold/40 hover:bg-gold/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {status === 'installing' ? t('settings.installing') : t('settings.installRestart')}
        </button>
      ) : (
        <button
          onClick={onCheck}
          disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gold/20 text-gold border border-gold/40 hover:bg-gold/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          <RefreshCw size={14} className={status === 'checking' ? 'animate-spin' : ''} />
          {status === 'checking' ? t('settings.checking') : t('settings.checkUpdates')}
        </button>
      )}
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { t } = useTranslation('common');
  const { devMode, fullEditMode, toggleDevMode, toggleFullEditMode } = useSettings();
  const currentLang = (i18n.language || 'en').split('-')[0];

  // Закрытие по Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-gold/30 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
            <Settings size={22} className="text-gold" />
            {t('settings.title')}
          </h1>
          <button
            onClick={onClose}
            aria-label={t('settings.close')}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Язык */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-text-primary">
              <Globe size={16} className="text-gold/70" />
              {t('settings.language')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map(({ code, label }) => {
                const active = currentLang === code;
                return (
                  <button
                    key={code}
                    onClick={() => i18n.changeLanguage(code)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                      active
                        ? 'bg-gold/20 text-gold border-gold/40'
                        : 'bg-bg-secondary text-text-secondary border-border-default hover:bg-bg-tertiary'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Режим разработчика */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Code2 size={16} className="text-gold/70" />
                {t('settings.devMode')}
              </div>
              <p className="text-xs text-text-muted mt-1">{t('settings.devModeDesc')}</p>
            </div>
            <Toggle checked={devMode} onChange={toggleDevMode} />
          </div>

          {/* Режим полного редактирования */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Pencil size={16} className="text-gold/70" />
                {t('settings.fullEdit')}
              </div>
              <p className="text-xs text-text-muted mt-1">{t('settings.fullEditDesc')}</p>
            </div>
            <Toggle checked={fullEditMode} onChange={toggleFullEditMode} />
          </div>

          {/* Папка с данными (только десктоп) */}
          {isTauri() && (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <FolderOpen size={16} className="text-gold/70" />
                  {t('settings.dataFolder')}
                </div>
                <p className="text-xs text-text-muted mt-1">{t('settings.dataFolderDesc')}</p>
              </div>
              <button
                onClick={() => { void import('../utils/openDataFolder').then((m) => m.openDataFolder()); }}
                className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-gold/20 text-gold border border-gold/40 hover:bg-gold/30 transition-all cursor-pointer"
              >
                {t('settings.openDataFolder')}
              </button>
            </div>
          )}

          {/* Самообновление (только десктоп) */}
          {isTauri() && <DesktopUpdatesSection />}
        </div>
      </div>
    </div>,
    document.body,
  );
};
