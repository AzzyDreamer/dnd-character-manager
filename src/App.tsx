import { useState, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useCharacters } from './hooks/useCharacters';
import { CharacterCreator } from './components/CharacterCreator';
import { CharacterSheet } from './components/CharacterSheet';
import { CharacterList } from './components/CharacterList';
import { importCharacter } from './utils/storage';
import { PlusCircle, BookOpen, ArrowLeft } from 'lucide-react';

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
          <h1 style={{ color: 'red', fontSize: '24px' }}>Ошибка рендеринга приложения</h1>
          <pre style={{ marginTop: '16px', padding: '16px', background: '#f5f5f5', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
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

  const [showCreator, setShowCreator] = useState(false);

  const handleImportCharacter = async (file: File) => {
    try {
      const character = await importCharacter(file);
      addCharacter(character);
      alert(`Персонаж "${character.name}" успешно импортирован!`);
    } catch (error) {
      alert('Ошибка импорта персонажа: ' + (error as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dnd-dark to-gray-800 flex items-center justify-center">
        <div className="text-white text-2xl font-medieval">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-dnd-dark to-gray-800">
      {/* Заголовок */}
      <header className="bg-dnd-primary shadow-lg border-b-4 border-dnd-secondary">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center relative">
            {/* Back button - shows when viewing a character or in creator */}
            {(showCreator || activeCharacter) && !showCreator && (
              <button
                onClick={() => setActiveCharacter('')}
                className="absolute left-0 flex items-center gap-2 text-white/70 hover:text-white transition-colors sm:flex hidden"
              >
                <ArrowLeft size={18} />
                <span className="text-sm">Список</span>
              </button>
            )}

            <div className="flex items-center gap-3">
              <BookOpen className="text-dnd-secondary" size={36} />
              <h1 className="text-2xl sm:text-3xl font-medieval text-white">
                D&D 5e Character Manager
              </h1>
            </div>

            {!showCreator && (
              <button
                onClick={() => setShowCreator(true)}
                className="absolute right-0 px-4 py-2 sm:px-6 sm:py-3 bg-dnd-secondary text-white rounded-lg hover:bg-dnd-secondary/80 flex items-center gap-2 font-semibold shadow-lg text-sm sm:text-base"
              >
                <PlusCircle size={18} />
                <span className="hidden sm:inline">Создать персонажа</span>
                <span className="sm:hidden">Создать</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {showCreator ? (
          <CharacterCreator
            onSave={(character) => {
              addCharacter(character);
              setShowCreator(false);
            }}
            onCancel={() => setShowCreator(false)}
          />
        ) : (
          <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6">
            {/* Боковая панель со списком персонажей */}
            <div className="lg:col-span-1">
              <CharacterList
                characters={characters}
                activeCharacterId={activeCharacterId}
                onSelectCharacter={setActiveCharacter}
                onDeleteCharacter={removeCharacter}
                onImportCharacter={handleImportCharacter}
              />
            </div>

            {/* Основная область - лист персонажа */}
            <div className="lg:col-span-3">
              {activeCharacter ? (
                <CharacterSheet
                  character={activeCharacter}
                  onUpdate={updateCharacter}
                />
              ) : (
                <div className="bg-dnd-parchment p-8 sm:p-12 rounded-lg shadow-lg border-4 border-dnd-secondary text-center max-w-2xl mx-auto">
                  <h2 className="text-2xl font-medieval text-dnd-primary mb-4">
                    Добро пожаловать в D&D Character Manager!
                  </h2>
                  <p className="text-gray-700 mb-6">
                    Создайте своего первого персонажа или выберите существующего из списка.
                  </p>
                  <button
                    onClick={() => setShowCreator(true)}
                    className="px-8 py-4 bg-dnd-primary text-white rounded-lg hover:bg-dnd-primary/80 font-semibold text-lg shadow-lg"
                  >
                    Создать первого персонажа
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Подвал */}
      <footer className="py-4 bg-dnd-primary border-t-4 border-dnd-secondary">
        <div className="max-w-7xl mx-auto px-6 text-center text-white">
          <p className="text-sm">
            D&D 5e Character Manager | Работает локально в вашем браузере
          </p>
          <p className="text-xs mt-1 text-gray-300">
            Все данные сохраняются в localStorage вашего браузера
          </p>
        </div>
      </footer>
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
