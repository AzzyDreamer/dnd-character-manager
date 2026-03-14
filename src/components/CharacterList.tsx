import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Character } from '../types';
import { Users, Trash2, FileDown, FileUp } from 'lucide-react';
import { exportCharacter } from '../utils/storage';
import { PortraitImage } from './ui/PortraitImage';

interface CharacterListProps {
  characters: Character[];
  activeCharacterId: string | null;
  onSelectCharacter: (characterId: string) => void;
  onDeleteCharacter: (characterId: string) => void;
  onImportCharacter: (file: File) => void;
}

const ASPECT = 9 / 21; // width / height
const GAP = 16; // gap-4 = 16px
const MIN_CARD_W = 120;
const MAX_CARD_W = 320;

export const CharacterList: React.FC<CharacterListProps> = ({
  characters,
  activeCharacterId,
  onSelectCharacter,
  onDeleteCharacter,
  onImportCharacter
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(160);

  const calcCardSize = useCallback(() => {
    const el = containerRef.current;
    if (!el || characters.length === 0) return;

    const containerW = el.clientWidth;
    const containerH = el.clientHeight;
    if (containerW === 0 || containerH === 0) return;

    const count = characters.length;

    // Try to fit all in one row: card height = container height, width from aspect
    const maxH = containerH;
    const wFromH = Math.floor(maxH * ASPECT);
    const totalWOneRow = wFromH * count + GAP * (count - 1);

    let w: number;
    if (totalWOneRow <= containerW) {
      // All fit in one row at max height
      w = wFromH;
    } else {
      // Find optimal: try rows 1, 2, 3... pick the one where cards are largest
      // but still fit within container
      let bestW = MIN_CARD_W;
      for (let rows = 1; rows <= count; rows++) {
        const cols = Math.ceil(count / rows);
        // Width constraint: cols * w + (cols-1) * gap <= containerW
        const wFromWidth = Math.floor((containerW - GAP * (cols - 1)) / cols);
        // Height constraint: rows * h + (rows-1) * gap <= containerH, h = w / ASPECT
        const hAvail = (containerH - GAP * (rows - 1)) / rows;
        const wFromHeight = Math.floor(hAvail * ASPECT);
        const candidate = Math.min(wFromWidth, wFromHeight);
        if (candidate > bestW) {
          bestW = candidate;
        }
      }
      w = bestW;
    }

    w = Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, w));
    setCardWidth(w);
  }, [characters.length]);

  useEffect(() => {
    calcCardSize();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => calcCardSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [calcCardSize]);

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
    <div className="w-full h-full flex flex-col">
      {/* Header — stays at top */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="text-gold" size={20} />
          <h2 className="text-lg font-medieval text-gold">Выбор персонажа</h2>
        </div>
        <label className="px-3 py-1.5 bg-gold/15 text-gold border border-gold/30 rounded-md hover:bg-gold/25 cursor-pointer flex items-center gap-1.5 text-sm font-medium transition-all">
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

      {/* Portrait Grid — auto-sized cards, centered */}
      {characters.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-muted text-xs italic">
            Нет созданных персонажей
          </p>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="flex flex-wrap gap-4 justify-center content-center">
            {characters.map((character) => {
              const isActive = character.id === activeCharacterId;
              return (
                <div
                  key={character.id}
                  style={{ width: cardWidth }}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${
                    isActive
                      ? 'ring-2 ring-gold shadow-[0_0_12px_rgba(212,175,55,0.3)] scale-[1.01]'
                      : 'ring-1 ring-border-default hover:ring-gold/40 hover:scale-[1.02] hover:brightness-110'
                  }`}
                  onClick={() => onSelectCharacter(character.id)}
                >
                  {/* Portrait */}
                  <div className="aspect-[9/21] bg-bg-secondary relative">
                    {character.portraitDataUrl ? (
                      <PortraitImage
                        src={character.portraitDataUrl}
                        pos={character.portraitPosition}
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-bg-secondary to-bg-tertiary">
                        <img
                          src={`/images/classes/${character.classId}.webp`}
                          alt={character.class}
                          className="w-14 h-14 object-contain opacity-30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Bottom gradient + name overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-2.5 px-3">
                      <div className={`text-sm font-semibold truncate ${isActive ? 'text-gold' : 'text-white'}`}>
                        {character.name}
                      </div>
                      <div className="text-xs text-white/60 truncate">
                        {character.race} • {character.class} {character.level} ур.
                      </div>
                    </div>

                    {/* Active indicator — bottom gold bar */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
                    )}

                    {/* Hover overlay with actions */}
                    <div className="absolute inset-0 bg-black/50 flex items-start justify-end gap-0.5 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(character);
                        }}
                        className="p-1.5 rounded bg-black/50 text-text-muted hover:text-gold hover:bg-gold/20 transition-colors"
                        title="Экспортировать"
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
                        className="p-1.5 rounded bg-black/50 text-text-muted hover:text-red-bright hover:bg-red-accent/30 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
