import { useState, useEffect, useCallback, useRef, Component, lazy, Suspense } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { useCharacters } from './hooks/useCharacters';
import { CharacterCreator } from './components/CharacterCreator';
import { CharacterSheet } from './components/CharacterSheet';
import { CharacterList } from './components/CharacterList';
import { HomePage } from './components/HomePage';
import { Glossary } from './components/Glossary';
import { TopNavBar } from './components/ui';
import type { NavTab } from './components/ui';
import { importCharacter, localCharacterStore } from './utils/storage';
import type { CharacterStore } from './utils/storage';
import { isTauri } from './utils/isTauri';
import { initRegistry, reloadForLocale, isInitialized } from './data/registry';
import type { LoadProgress } from './data/registry';
import { PlusCircle, Users, Scroll, Library, Settings } from 'lucide-react';
import { DiceRollProvider } from './components/DiceRollProvider';
import { SettingsProvider } from './components/SettingsProvider';
import { SettingsModal } from './components/SettingsModal';
import { FilterNavContext } from './components/FilterNavContext';
import type { FilterNavRequest } from './components/FilterNavContext';
import { setViewRestoreHandler, replaceView, pushView } from './utils/navStack';
import { useBackDismiss } from './hooks/useBackDismiss';

// Десктоп-онли хром окна (кастомный тайтлбар + ресайз-хендлы frameless-окна).
// Грузится лениво только под Tauri, чтобы @tauri-apps/* (window API) не попадал
// в веб-бандл.
const TitleBar = lazy(() => import('./components/desktop/TitleBar'));
const WindowResizers = lazy(() => import('./components/desktop/WindowResizers'));

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
          <h1 style={{ color: '#cc4444', fontSize: '24px' }}>{i18n.t('errors.renderError')}</h1>
          <pre style={{ marginTop: '16px', padding: '16px', background: '#1a1a24', color: '#e8e6e3', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

type AppView = 'home' | 'main' | 'sheet' | 'creator' | 'glossary';

const GLOSSARY_SUB_TAB_KEYS = [
  'spells', 'classes', 'subclasses', 'species', 'backgrounds',
  'feats', 'items', 'optionalfeatures', 'conditions', 'senses',
  'skills', 'rules', 'charoptions', 'actions',
] as const;

// --- Hash-based routing for top-level views -----------------------------------
// Views are reflected in the URL hash so Back/Forward, refresh and bookmarks work.
interface NavLoc {
  view: AppView;
  characterId: string | null;
  glossaryCategory: string | null;
}

function urlForLoc(loc: NavLoc): string {
  switch (loc.view) {
    case 'main': return '#/characters';
    case 'creator': return '#/create';
    case 'sheet': return loc.characterId ? `#/sheet/${encodeURIComponent(loc.characterId)}` : '#/sheet';
    case 'glossary': return loc.glossaryCategory ? `#/glossary/${loc.glossaryCategory}` : '#/glossary';
    case 'home':
    default: return '#/';
  }
}

function parseLocFromHash(): NavLoc {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [seg, ...restParts] = raw.split('/');
  const rest = restParts.join('/');
  switch (seg) {
    case 'characters': return { view: 'main', characterId: null, glossaryCategory: null };
    case 'create': return { view: 'creator', characterId: null, glossaryCategory: null };
    case 'sheet': return { view: 'sheet', characterId: rest ? decodeURIComponent(rest) : null, glossaryCategory: null };
    case 'glossary': return { view: 'glossary', characterId: null, glossaryCategory: rest || 'spells' };
    default: return { view: 'home', characterId: null, glossaryCategory: null };
  }
}

// Only the view-relevant sub-state contributes to the key, so unrelated
// background changes don't spawn phantom history entries.
function navKeyFor(loc: NavLoc): string {
  return loc.view === 'sheet' ? `sheet|${loc.characterId ?? ''}`
    : loc.view === 'glossary' ? `glossary|${loc.glossaryCategory ?? ''}`
    : loc.view;
}

function LoadingScreen({ progress }: { progress: LoadProgress | null }) {
  const { t } = useTranslation('common');
  const percent = progress ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <div className="h-full bg-bg-primary flex flex-col items-center justify-center gap-6">
      <h1 className="text-text-primary text-3xl font-medieval">D&D Character Manager</h1>
      <div className="w-80 flex flex-col gap-3">
        <div className="w-full h-3 bg-bg-secondary rounded-full overflow-hidden border border-border-primary">
          <div
            className="h-full bg-gold transition-all duration-300 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-text-secondary text-sm text-center">
          {progress ? t('loading.progress', { phase: progress.phase, loaded: progress.loaded, total: progress.total }) : t('loading.initializing')}
        </div>
      </div>
    </div>
  );
}

function AppContent({ store, onOpenSettings }: { store: CharacterStore; onOpenSettings: () => void }) {
  const { t } = useTranslation('common');

  const {
    characters,
    activeCharacter,
    activeCharacterId,
    loading,
    addCharacter,
    updateCharacter,
    removeCharacter,
    setActiveCharacter,
  } = useCharacters(store);

  const [registryReady, setRegistryReady] = useState(false);
  const [registryProgress, setRegistryProgress] = useState<LoadProgress | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  // Перезагрузка игровых данных под новую локаль (см. эффект ниже).
  const [reloadingLang, setReloadingLang] = useState(false);
  const lastLangRef = useRef((i18n.language || 'en').split('-')[0]);

  const initialLocRef = useRef<NavLoc>(parseLocFromHash());
  const [currentView, setCurrentView] = useState<AppView>(initialLocRef.current.view);
  const [glossaryCategory, setGlossaryCategory] = useState<string | null>(
    initialLocRef.current.view === 'glossary' ? initialLocRef.current.glossaryCategory : null,
  );
  const [glossaryPrefilter, setGlossaryPrefilter] = useState<FilterNavRequest | null>(null);

  const mainTabs: NavTab[] = [
    { key: 'main', label: t('nav.characters'), icon: Users },
    { key: 'creator', label: t('nav.creation'), icon: Scroll },
    { key: 'glossary', label: t('nav.glossary'), icon: Library },
  ];

  const glossarySubTabs: NavTab[] = GLOSSARY_SUB_TAB_KEYS.map(key => ({
    key,
    label: t(`glossaryTabs.${key}`),
  }));

  useEffect(() => {
    initRegistry(setRegistryProgress)
      .then(() => setRegistryReady(true))
      .catch((e) => setRegistryError(String(e)));
  }, []);

  // Смена языка в рантайме. Игровые данные (spells/classes/…) переводятся
  // оверлеем на месте при загрузке, поэтому при 'languageChanged' их нужно
  // перезагрузить под новую локаль. На время перезагрузки показываем экран
  // загрузки (ранний return ниже): контентная часть размонтируется и затем
  // монтируется заново, перечитывая обновлённые данные. Сам AppContent
  // остаётся смонтированным, поэтому текущий вид и история навигации
  // сохраняются. См. data/registry.reloadForLocale.
  useEffect(() => {
    const handler = (lng: string) => {
      const base = (lng || 'en').split('-')[0];
      if (base === lastLangRef.current) return;
      lastLangRef.current = base;
      // До завершения первичной инициализации перезагрузка не нужна:
      // initRegistry сам прочитает актуальный i18n.language.
      if (isInitialized()) setReloadingLang(true);
    };
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, []);

  // Запускаем перезагрузку только после того, как экран загрузки отрисован,
  // чтобы дочерние компоненты не прочитали полупустые массивы данных в момент
  // сброса модулей.
  useEffect(() => {
    if (!reloadingLang) return;
    let cancelled = false;
    reloadForLocale()
      .catch((e) => console.error('Failed to reload data for locale:', e))
      .finally(() => { if (!cancelled) setReloadingLang(false); });
    return () => { cancelled = true; };
  }, [reloadingLang]);

  // --- Browser Back/Forward integration ---------------------------------
  // The app is a single page with state-driven views and no router. We mirror
  // the current view into the History API (hash URL + entry) so Back/Forward,
  // refresh and bookmarks work. Overlays and the creation wizard layer their own
  // dismissible entries on top via the shared navStack.
  const lastNavKeyRef = useRef<string | null>(null);
  const navLoc: NavLoc = { view: currentView, characterId: activeCharacterId, glossaryCategory };
  const navKey = navKeyFor(navLoc);

  // Apply a character requested via a deep-linked #/sheet/<id> URL once loaded.
  const appliedInitialCharRef = useRef(false);
  useEffect(() => {
    if (appliedInitialCharRef.current || loading) return;
    appliedInitialCharRef.current = true;
    const init = initialLocRef.current;
    if (init.view === 'sheet' && init.characterId) setActiveCharacter(init.characterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Sync the current view into history whenever it changes.
  useEffect(() => {
    if (lastNavKeyRef.current === null) {
      // Anchor to the URL-derived initial location (preserves deep-linked id/category).
      const init = initialLocRef.current;
      replaceView(init, urlForLoc(init));
      lastNavKeyRef.current = navKeyFor(init);
    } else if (lastNavKeyRef.current !== navKey) {
      pushView(navLoc, urlForLoc(navLoc));
      lastNavKeyRef.current = navKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navKey]);

  // Restore the view when Back/Forward reaches the base (non-overlay) level.
  useEffect(() => {
    setViewRestoreHandler((rawLoc) => {
      const loc = (rawLoc ?? { view: 'home', characterId: null, glossaryCategory: null }) as NavLoc;
      lastNavKeyRef.current = navKeyFor(loc);
      if (loc.view === 'sheet' && loc.characterId) setActiveCharacter(loc.characterId);
      setGlossaryPrefilter(null);
      setGlossaryCategory(loc.view === 'glossary' ? (loc.glossaryCategory ?? 'spells') : null);
      setCurrentView(loc.view);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImportCharacter = async (file: File) => {
    try {
      const character = await importCharacter(file);
      await addCharacter(character);
      alert(t('alerts.importSuccess', { name: character.name }));
    } catch (error) {
      alert(t('errors.importError', { error: (error as Error).message }));
    }
  };

  const handleSelectCharacter = (id: string) => {
    setActiveCharacter(id);
    setCurrentView('sheet');
  };

  const handleTabChange = (key: string) => {
    if (key === 'sheet') return;
    setCurrentView(key as AppView);
    if (key === 'glossary' && !glossaryCategory) {
      setGlossaryCategory('spells');
    }
  };

  const handleGlossarySubTab = (key: string) => {
    setGlossaryPrefilter(null); // ручная смена вкладки сбрасывает префильтр из @filter
    setGlossaryCategory(key);
  };

  // Переход по тегу {@filter}: открыть глоссарий на нужной категории с префильтром.
  const handleFilterNav = useCallback((req: FilterNavRequest) => {
    setCurrentView('glossary');
    setGlossaryCategory(req.category);
    setGlossaryPrefilter(req);
  }, []);

  if (!registryReady || loading || reloadingLang) {
    if (registryError) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center">
          <div className="text-red-400 text-lg">{t('errors.loadError', { error: registryError })}</div>
        </div>
      );
    }
    return <LoadingScreen progress={reloadingLang ? null : registryProgress} />;
  }

  return (
    <FilterNavContext.Provider value={handleFilterNav}>
    <div className="flex flex-col h-full bg-bg-primary">
      <TopNavBar
        tabs={mainTabs}
        activeTab={currentView === 'sheet' ? 'main' : currentView === 'home' ? '' : currentView}
        onTabChange={handleTabChange}
        onLogoClick={() => setCurrentView('home')}
        subTabs={currentView === 'glossary' ? glossarySubTabs : undefined}
        activeSubTab={glossaryCategory ?? undefined}
        onSubTabChange={handleGlossarySubTab}
        rightContent={
          <>
            {(currentView === 'main' || currentView === 'sheet') && (
              <button
                onClick={() => setCurrentView('creator')}
                className="px-3 py-1.5 bg-gold/20 text-gold border border-gold/30 rounded-md hover:bg-gold/30 flex items-center gap-2 text-sm font-medium transition-all"
              >
                <PlusCircle size={16} />
                <span className="hidden sm:inline">{t('buttons.create')}</span>
              </button>
            )}
            {!isTauri() && (
              <button
                onClick={onOpenSettings}
                aria-label={t('settings.title')}
                title={t('settings.title')}
                className="p-1.5 text-text-secondary hover:text-gold transition-colors cursor-pointer"
              >
                <Settings size={18} />
              </button>
            )}
          </>
        }
      />

      {/* Main content */}
      <main className="flex-1 min-h-0 px-4 sm:px-6">
        {currentView === 'sheet' && activeCharacter ? (
          <div className="h-full py-4">
            <CharacterSheet
              character={activeCharacter}
              onUpdate={updateCharacter}
            />
          </div>
        ) : currentView === 'home' ? (
          <div className="h-full overflow-y-auto py-4 grid place-items-center">
            <HomePage
              characters={characters}
              onNavigate={handleTabChange}
              onSelectCharacter={handleSelectCharacter}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto py-4">
            {currentView === 'creator' ? (
              <CharacterCreator
                onSave={async (character) => {
                  try {
                    await addCharacter(character);
                    setCurrentView('main');
                  } catch {
                    // ошибка уже залогирована в хуке; остаёмся в редакторе
                  }
                }}
                onCancel={() => setCurrentView('main')}
              />
            ) : currentView === 'glossary' ? (
              <Glossary
                onBack={() => setCurrentView('main')}
                activeCategory={glossaryCategory}
                onCategoryChange={setGlossaryCategory}
                prefilter={glossaryPrefilter}
              />
            ) : (
              /* Character selection screen — Dota 2 style */
              <div className="w-full h-full flex flex-col">
                <CharacterList
                  characters={characters}
                  activeCharacterId={activeCharacterId}
                  onSelectCharacter={handleSelectCharacter}
                  onDeleteCharacter={removeCharacter}
                  onImportCharacter={handleImportCharacter}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
    </FilterNavContext.Provider>
  );
}

function App() {
  // Веб-режим берёт localStorage сразу (синхронно, без мигания загрузки).
  // Под Tauri подменяем на файловый стор через динамический импорт — так
  // @tauri-apps/* не попадает в веб-бандл (см. utils/fileCharacterStore).
  const [store, setStore] = useState<CharacterStore | null>(
    () => (isTauri() ? null : localCharacterStore),
  );
  useEffect(() => {
    if (store) return;
    let cancelled = false;
    import('./utils/fileCharacterStore').then(({ fileCharacterStore }) => {
      if (!cancelled) setStore(fileCharacterStore);
    });
    return () => { cancelled = true; };
  }, [store]);

  // Состояние модалки настроек поднято в App: на десктопе шестерёнка живёт в
  // тайтлбаре (вне AppContent), на вебе — в навбаре. Браузерный Back закрывает её.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);
  useBackDismiss(settingsOpen, () => setSettingsOpen(false));

  const tauri = isTauri();
  const content = store
    ? <AppContent store={store} onOpenSettings={openSettings} />
    : <LoadingScreen progress={null} />;

  return (
    <ErrorBoundary>
      <SettingsProvider>
        <DiceRollProvider>
          <div className="flex flex-col h-screen overflow-hidden">
            {tauri && (
              <Suspense
                fallback={<div className="h-9 shrink-0 bg-bg-secondary border-b border-border-default" />}
              >
                <TitleBar onOpenSettings={openSettings} />
              </Suspense>
            )}
            <div className="flex-1 min-h-0">{content}</div>
          </div>
          {tauri && (
            <Suspense fallback={null}>
              <WindowResizers />
            </Suspense>
          )}
          {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
        </DiceRollProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
