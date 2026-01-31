import { useState } from 'react';
import { useCharacters } from './hooks/useCharacters';
import { CharacterCreator } from './components/CharacterCreator';
import { CharacterSheet } from './components/CharacterSheet';
import { CharacterList } from './components/CharacterList';
import { importCharacter } from './utils/storage';
import { PlusCircle, BookOpen } from 'lucide-react';

function App() {
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
    <div className="min-h-screen bg-gradient-to-br from-dnd-dark to-gray-800">
      {/* Заголовок */}
      <header className="bg-dnd-primary shadow-lg border-b-4 border-dnd-secondary">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="text-dnd-secondary" size={36} />
              <h1 className="text-3xl font-medieval text-white">
                D&D 5e Character Manager
              </h1>
            </div>
            
            {!showCreator && (
              <button
                onClick={() => setShowCreator(true)}
                className="px-6 py-3 bg-dnd-secondary text-white rounded-lg hover:bg-opacity-80 flex items-center gap-2 font-semibold shadow-lg"
              >
                <PlusCircle size={20} />
                Создать персонажа
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {showCreator ? (
          <CharacterCreator
            onSave={(character) => {
              addCharacter(character);
              setShowCreator(false);
            }}
            onCancel={() => setShowCreator(false)}
          />
        ) : (
          <div className="grid grid-cols-4 gap-6">
            {/* Боковая панель со списком персонажей */}
            <div className="col-span-1">
              <CharacterList
                characters={characters}
                activeCharacterId={activeCharacterId}
                onSelectCharacter={setActiveCharacter}
                onDeleteCharacter={removeCharacter}
                onImportCharacter={handleImportCharacter}
              />
            </div>

            {/* Основная область - лист персонажа */}
            <div className="col-span-3">
              {activeCharacter ? (
                <CharacterSheet
                  character={activeCharacter}
                  onUpdate={updateCharacter}
                />
              ) : (
                <div className="bg-dnd-parchment p-12 rounded-lg shadow-lg border-4 border-dnd-secondary text-center">
                  <h2 className="text-2xl font-medieval text-dnd-primary mb-4">
                    Добро пожаловать в D&D Character Manager!
                  </h2>
                  <p className="text-gray-700 mb-6">
                    Создайте своего первого персонажа или выберите существующего из списка слева.
                  </p>
                  <button
                    onClick={() => setShowCreator(true)}
                    className="px-8 py-4 bg-dnd-primary text-white rounded-lg hover:bg-opacity-80 font-semibold text-lg shadow-lg"
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
      <footer className="mt-12 py-6 bg-dnd-primary border-t-4 border-dnd-secondary">
        <div className="max-w-7xl mx-auto px-6 text-center text-white">
          <p className="text-sm">
            D&D 5e Character Manager | Работает локально в вашем браузере
          </p>
          <p className="text-xs mt-2 text-gray-300">
            Все данные сохраняются в localStorage вашего браузера
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
