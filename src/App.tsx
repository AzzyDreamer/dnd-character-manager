import { useState, useEffect, useCallback, Component } from 'react';
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
import { importCharacter } from './utils/storage';
import { initRegistry } from './data/registry';
import type { LoadProgress } from './data/registry';
import { PlusCircle, Users, Scroll, Library } from 'lucide-react';
import { DiceRollProvider } from './components/DiceRollProvider';
import { FilterNavContext } from './components/FilterNavContext';
import type { FilterNavRequest } from './components/FilterNavContext';

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

function LoadingScreen({ progress }: { progress: LoadProgress | null }) {
  const { t } = useTranslation('common');
  const percent = progress ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center gap-6">
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

function AppContent() {
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
  } = useCharacters();

  const [registryReady, setRegistryReady] = useState(false);
  const [registryProgress, setRegistryProgress] = useState<LoadProgress | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [glossaryCategory, setGlossaryCategory] = useState<string | null>(null);
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

  const handleImportCharacter = async (file: File) => {
    try {
      const character = await importCharacter(file);
      addCharacter(character);
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

  if (!registryReady || loading) {
    if (registryError) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center">
          <div className="text-red-400 text-lg">{t('errors.loadError', { error: registryError })}</div>
        </div>
      );
    }
    return <LoadingScreen progress={registryProgress} />;
  }

  return (
    <FilterNavContext.Provider value={handleFilterNav}>
    <div className="flex flex-col h-screen bg-bg-primary">
      <TopNavBar
        tabs={mainTabs}
        activeTab={currentView === 'sheet' ? 'main' : currentView === 'home' ? '' : currentView}
        onTabChange={handleTabChange}
        onLogoClick={() => setCurrentView('home')}
        subTabs={currentView === 'glossary' ? glossarySubTabs : undefined}
        activeSubTab={glossaryCategory ?? undefined}
        onSubTabChange={handleGlossarySubTab}
        rightContent={
          currentView === 'main' || currentView === 'sheet' ? (
            <button
              onClick={() => setCurrentView('creator')}
              className="px-3 py-1.5 bg-gold/20 text-gold border border-gold/30 rounded-md hover:bg-gold/30 flex items-center gap-2 text-sm font-medium transition-all"
            >
              <PlusCircle size={16} />
              <span className="hidden sm:inline">{t('buttons.create')}</span>
            </button>
          ) : undefined
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
                onSave={(character) => {
                  addCharacter(character);
                  setCurrentView('main');
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
  return (
    <ErrorBoundary>
      <DiceRollProvider>
        <AppContent />
      </DiceRollProvider>
    </ErrorBoundary>
  );
}

export default App;
