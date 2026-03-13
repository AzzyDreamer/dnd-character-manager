import React from 'react';
import type { Character } from '../types';
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
      e.target.value = '';
    }
  };

  const handleExport = (character: Character) => {
    exportCharacter(character);
  };

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="text-gold" size={20} />
          <h2 className="text-base font-medieval text-gold">Персонажи</h2>
        </div>

        <label className="px-3 py-1.5 bg-gold/15 text-gold border border-gold/30 rounded-md hover:bg-gold/25 cursor-pointer flex items-center gap-1.5 text-xs font-medium transition-all">
          <FileUp size={14} />
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
        <p className="text-text-muted text-sm italic text-center py-4">
          Нет созданных персонажей
        </p>
      ) : (
        <div className="space-y-1.5">
          {characters.map((character) => {
            const isActive = character.id === activeCharacterId;
            return (
              <div
                key={character.id}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? 'border-gold/50 bg-gold-muted'
                    : 'border-border-default hover:border-border-hover bg-bg-primary/40 hover:bg-bg-panel-hover'
                }`}
                onClick={() => onSelectCharacter(character.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate ${isActive ? 'text-gold' : 'text-text-primary'}`}>
                      {character.name}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {character.race} {character.class}{character.subclass ? ` (${character.subclass})` : ''} {character.level} ур.
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(character);
                      }}
                      className="p-1.5 text-text-muted hover:text-gold hover:bg-gold/10 rounded transition-colors"
                      title="Экспортировать персонажа"
                    >
                      <FileDown size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Удалить персонажа "${character.name}"?`)) {
                          onDeleteCharacter(character.id);
                        }
                      }}
                      className="p-1.5 text-text-muted hover:text-red-bright hover:bg-red-accent/20 rounded transition-colors"
                      title="Удалить персонажа"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
