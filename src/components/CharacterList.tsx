import React from 'react';
import { Character } from '../types';
import { Users, Trash2, FileDown, FileUp } from 'lucide-react';
import { exportCharacter } from '../utils/storage';

interface CharacterListProps {
  characters: Character[];
  activeCharacterId: string | null;
  onSelectCharacter: (characterId: string) => void;
  onDeleteCharacter: (characterId: string) => void;
  onImportCharacter: (file: File) => void;
}

export const CharacterList: React.FC<CharacterListProps> = ({
  characters,
  activeCharacterId,
  onSelectCharacter,
  onDeleteCharacter,
  onImportCharacter
}) => {
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportCharacter(file);
      e.target.value = ''; // Сброс input
    }
  };

  const handleExport = (character: Character) => {
    exportCharacter(character);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="text-dnd-primary" size={24} />
          <h2 className="text-xl font-semibold text-dnd-primary">Персонажи</h2>
        </div>
        
        <label className="px-3 py-2 bg-dnd-secondary text-white rounded hover:bg-opacity-80 cursor-pointer flex items-center gap-2">
          <FileUp size={18} />
          Импорт
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>

      {characters.length === 0 ? (
        <p className="text-gray-500 italic text-center py-4">
          Нет созданных персонажей
        </p>
      ) : (
        <div className="space-y-2">
          {characters.map((character) => (
            <div
              key={character.id}
              className={`p-3 rounded border-2 transition-colors cursor-pointer ${
                character.id === activeCharacterId
                  ? 'border-dnd-primary bg-dnd-parchment'
                  : 'border-gray-300 hover:border-dnd-secondary'
              }`}
              onClick={() => onSelectCharacter(character.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-lg">{character.name}</div>
                  <div className="text-sm text-gray-600">
                    {character.race} {character.class} {character.level} ур.
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(character);
                    }}
                    className="p-2 text-dnd-secondary hover:bg-dnd-parchment rounded"
                    title="Экспортировать персонажа"
                  >
                    <FileDown size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Удалить персонажа "${character.name}"?`)) {
                        onDeleteCharacter(character.id);
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Удалить персонажа"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
