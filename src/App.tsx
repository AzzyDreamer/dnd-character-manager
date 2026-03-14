import { useState, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useCharacters } from './hooks/useCharacters';
import { CharacterCreator } from './components/CharacterCreator';
import { CharacterSheet } from './components/CharacterSheet';
import { CharacterList } from './components/CharacterList';
import { HomePage } from './components/HomePage';
import { Glossary } from './components/Glossary';
import { TopNavBar } from './components/ui';
import type { NavTab } from './components/ui';
import { importCharacter } from './utils/storage';
import { PlusCircle, Users, Scroll, Library } from 'lucide-react';

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
          <h1 style={{ color: '#cc4444', fontSize: '24px' }}>Ошибка рендеринга приложения</h1>
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

const MAIN_TABS: NavTab[] = [
  { key: 'main', label: 'Персонажи', icon: Users },
  { key: 'creator', label: 'Создание', icon: Scroll },
  { key: 'glossary', label: 'База знаний', icon: Library },
];

const GLOSSARY_SUB_TABS: NavTab[] = [
  { key: 'spells', label: 'Заклинания' },
  { key: 'classes', label: 'Классы' },
  { key: 'subclasses', label: 'Подклассы' },
  { key: 'species', label: 'Виды' },
  { key: 'backgrounds', label: 'Предыстории' },
  { key: 'feats', label: 'Черты' },
  { key: 'items', label: 'Предметы' },
  { key: 'optionalfeatures', label: 'Способности' },
  { key: 'conditions', label: 'Состояния' },
  { key: 'senses', label: 'Чувства' },
  { key: 'skills', label: 'Навыки' },
  { key: 'rules', label: 'Правила' },
  { key: 'charoptions', label: 'Опции создания' },
];

function AppContent() {
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

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [glossaryCategory, setGlossaryCategory] = useState<string | null>(null);

  const handleImportCharacter = async (file: File) => {
    try {
      const character = await importCharacter(file);
      addCharacter(character);
      alert(`Персонаж "${character.name}" успешно импортирован!`);
    } catch (error) {
      alert('Ошибка импорта персонажа: ' + (error as Error).message);
    }
  };

  const handleSelectCharacter = (id: string) => {
    setActiveCharacter(id);
    setCurrentView('sheet');
  };

  const handleTabChange = (key: string) => {
    if (key === 'sheet') return; // не переключаемся на sheet через таб
    setCurrentView(key as AppView);
    if (key === 'glossary' && !glossaryCategory) {
      setGlossaryCategory('spells');
    }
  };

  const handleGlossarySubTab = (key: string) => {
    setGlossaryCategory(key);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-primary text-2xl font-medieval">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <TopNavBar
        tabs={MAIN_TABS}
        activeTab={currentView === 'sheet' ? 'main' : currentView === 'home' ? '' : currentView}
        onTabChange={handleTabChange}
        onLogoClick={() => setCurrentView('home')}
        subTabs={currentView === 'glossary' ? GLOSSARY_SUB_TABS : undefined}
        activeSubTab={glossaryCategory ?? undefined}
        onSubTabChange={handleGlossarySubTab}
        rightContent={
          currentView === 'main' || currentView === 'sheet' ? (
            <button
              onClick={() => setCurrentView('creator')}
              className="px-3 py-1.5 bg-gold/20 text-gold border border-gold/30 rounded-md hover:bg-gold/30 flex items-center gap-2 text-sm font-medium transition-all"
            >
              <PlusCircle size={16} />
              <span className="hidden sm:inline">Создать</span>
            </button>
          ) : undefined
        }
      />

      {/* Main content */}
      <main className="flex-1 min-h-0">
        {currentView === 'sheet' && activeCharacter ? (
          /* Character Sheet — full screen, no padding */
          <div className="h-full">
            <CharacterSheet
              character={activeCharacter}
              onUpdate={updateCharacter}
            />
          </div>
        ) : currentView === 'home' ? (
          <div className="h-full overflow-y-auto px-4 sm:px-6 py-4 grid place-items-center">
            <HomePage
              characters={characters}
              onNavigate={handleTabChange}
              onSelectCharacter={handleSelectCharacter}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-4 sm:px-6 py-4">
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
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
