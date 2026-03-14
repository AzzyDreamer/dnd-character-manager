import type { Character } from '../types';
import { Scroll, Users, Library, Sparkles } from 'lucide-react';
import { PortraitImage } from './ui/PortraitImage';

interface HomePageProps {
  characters: Character[];
  onNavigate: (view: string) => void;
  onSelectCharacter: (id: string) => void;
}

export function HomePage({ characters, onNavigate, onSelectCharacter }: HomePageProps) {
  const recentCharacters = characters.slice(-4).reverse();

  return (
    <div className="max-w-4xl w-full space-y-10">
      {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-medieval text-gold">
            D&D Character Manager
          </h1>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('creator')}
            className="glass-panel p-6 text-left hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-gold/15 text-gold group-hover:bg-gold/25 transition-colors">
                <Scroll size={22} />
              </div>
              <h3 className="font-medieval text-gold text-lg">Создать</h3>
            </div>
            <p className="text-text-muted text-sm">
              Новый персонаж с нуля — раса, класс, характеристики и снаряжение.
            </p>
          </button>

          <button
            onClick={() => onNavigate('main')}
            className="glass-panel p-6 text-left hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-gold/15 text-gold group-hover:bg-gold/25 transition-colors">
                <Users size={22} />
              </div>
              <h3 className="font-medieval text-gold text-lg">Персонажи</h3>
            </div>
            <p className="text-text-muted text-sm">
              {characters.length > 0
                ? `${characters.length} ${characters.length === 1 ? 'персонаж' : characters.length < 5 ? 'персонажа' : 'персонажей'} создано.`
                : 'Пока нет персонажей — самое время создать первого!'}
            </p>
          </button>

          <button
            onClick={() => onNavigate('glossary')}
            className="glass-panel p-6 text-left hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-gold/15 text-gold group-hover:bg-gold/25 transition-colors">
                <Library size={22} />
              </div>
              <h3 className="font-medieval text-gold text-lg">База знаний</h3>
            </div>
            <p className="text-text-muted text-sm">
              Заклинания, классы, расы, предметы, черты и правила D&D 5e.
            </p>
          </button>
        </div>

        {/* Recent Characters */}
        {recentCharacters.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="text-gold" size={18} />
              <h2 className="font-medieval text-gold text-lg">Последние персонажи</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recentCharacters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => onSelectCharacter(char.id)}
                  className="glass-panel overflow-hidden hover:ring-1 hover:ring-gold/40 transition-all group text-left"
                >
                  {/* Mini portrait */}
                  <div className="aspect-[3/4] bg-bg-secondary relative">
                    {char.portraitDataUrl ? (
                      <PortraitImage
                        src={char.portraitDataUrl}
                        pos={char.portraitPosition}
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-bg-secondary to-bg-tertiary">
                        <img
                          src={`/images/classes/${char.classId}.webp`}
                          alt={char.class}
                          className="w-10 h-10 object-contain opacity-30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-6 pb-2 px-2.5">
                      <div className="text-sm font-semibold truncate text-white group-hover:text-gold transition-colors">
                        {char.name}
                      </div>
                      <div className="text-xs text-white/60 truncate">
                        {char.race} • {char.class} {char.level} ур.
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-panel ornate-border p-8 text-center">
            <p className="text-text-secondary mb-4">
              У вас пока нет персонажей. Создайте первого, чтобы начать приключение!
            </p>
            <button
              onClick={() => onNavigate('creator')}
              className="px-6 py-3 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 font-semibold transition-all"
            >
              Создать первого персонажа
            </button>
          </div>
        )}
    </div>
  );
}
