import type { AbilityScores, Character, CharacterSpell } from '../../types';
import { getAbilityModifier, ABILITY_SHORT } from '../../utils/dnd';
import { StatBadge } from './StatBadge';
import { GoldDivider } from './GoldDivider';
import { Shield, Heart, Footprints, Sparkles } from 'lucide-react';

/** Partial data for creation mode (not a full Character yet) */
export interface CreationStats {
  name?: string;
  race?: string;
  className?: string;
  subclass?: string;
  level?: number;
  abilityScores?: Partial<AbilityScores>;
  proficiencies?: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
    languages?: string[];
  };
  spells?: { name: string; level: number }[];
  armorClass?: number;
  hitPoints?: number;
  speed?: number;
  proficiencyBonus?: number;
}

interface CharacterStatsSidebarProps {
  /** Full character — used in CharacterSheet */
  character?: Character;
  /** Partial data — used in CharacterCreator */
  creationStats?: CreationStats;
  /** Show combat stats (HP, AC, Speed) */
  showCombatStats?: boolean;
  className?: string;
}

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  'strength', 'dexterity', 'constitution',
  'intelligence', 'wisdom', 'charisma',
];

export function CharacterStatsSidebar({
  character,
  creationStats,
  showCombatStats = true,
  className = '',
}: CharacterStatsSidebarProps) {
  // Unify data from either character or creationStats
  const name = character?.name ?? creationStats?.name ?? '';
  const race = character?.race ?? creationStats?.race ?? '';
  const cls = character?.class ?? creationStats?.className ?? '';
  const subclass = character?.subclass ?? creationStats?.subclass;
  const level = character?.level ?? creationStats?.level ?? 1;

  const abilityScores = character?.abilityScores ?? (creationStats?.abilityScores as AbilityScores | undefined);

  const proficiencies = character?.proficiencies ?? creationStats?.proficiencies;
  const spells = character?.spellcasting?.spells ?? creationStats?.spells;

  const ac = character?.armorClass ?? creationStats?.armorClass;
  const hp = character ? character.hitPoints.current : creationStats?.hitPoints;
  const hpMax = character?.hitPoints.max;
  const speed = character?.speed ?? creationStats?.speed;
  const profBonus = character?.proficiencyBonus ?? creationStats?.proficiencyBonus;

  return (
    <aside className={`w-72 shrink-0 hidden lg:flex flex-col gap-3 overflow-y-auto ${className}`}>
      {/* Identity */}
      <div className="glass-panel p-3 space-y-1">
        {name && (
          <h3 className="font-medieval text-gold text-base truncate">{name}</h3>
        )}
        <div className="text-xs text-text-secondary space-y-0.5">
          {race && <div>{race}</div>}
          {cls && (
            <div>
              Уровень {level} {cls}
              {subclass && ` \u2022 ${subclass}`}
            </div>
          )}
        </div>
      </div>

      {/* Ability Scores */}
      {abilityScores && (
        <div className="glass-panel p-3">
          <div className="grid grid-cols-3 gap-2 justify-items-center">
            {ABILITY_KEYS.map((key) => {
              const val = abilityScores[key];
              if (val === undefined) return null;
              return (
                <StatBadge
                  key={key}
                  label={ABILITY_SHORT[key]}
                  value={val}
                  modifier={getAbilityModifier(val)}
                  variant="circle"
                  size="sm"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Combat Stats */}
      {showCombatStats && (ac !== undefined || hp !== undefined || speed !== undefined) && (
        <div className="glass-panel p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {ac !== undefined && (
              <div className="flex flex-col items-center gap-1">
                <Shield size={16} className="text-gold/70" />
                <span className="text-lg font-bold text-text-primary">{ac}</span>
                <span className="text-[10px] text-text-muted uppercase">КД</span>
              </div>
            )}
            {hp !== undefined && (
              <div className="flex flex-col items-center gap-1">
                <Heart size={16} className="text-red-bright" />
                <span className="text-lg font-bold text-text-primary">
                  {hp}{hpMax !== undefined && `/${hpMax}`}
                </span>
                <span className="text-[10px] text-text-muted uppercase">ХП</span>
              </div>
            )}
            {speed !== undefined && (
              <div className="flex flex-col items-center gap-1">
                <Footprints size={16} className="text-gold/70" />
                <span className="text-lg font-bold text-text-primary">{speed}</span>
                <span className="text-[10px] text-text-muted uppercase">Скорость</span>
              </div>
            )}
          </div>
          {profBonus !== undefined && (
            <div className="mt-2 pt-2 border-t border-border-default text-center">
              <span className="text-[10px] text-text-muted uppercase">Мастерство</span>
              <span className="ml-2 text-sm font-bold text-gold">+{profBonus}</span>
            </div>
          )}
        </div>
      )}

      {/* Proficiencies */}
      {proficiencies && (
        <div className="glass-panel p-3 space-y-2 text-xs">
          {proficiencies.languages && proficiencies.languages.length > 0 && (
            <div>
              <span className="text-text-muted uppercase tracking-wider text-[10px]">Языки</span>
              <div className="text-text-secondary mt-0.5">{proficiencies.languages.join(', ')}</div>
            </div>
          )}
          {proficiencies.armor && proficiencies.armor.length > 0 && (
            <div>
              <span className="text-text-muted uppercase tracking-wider text-[10px]">Броня</span>
              <div className="text-text-secondary mt-0.5">{proficiencies.armor.join(', ')}</div>
            </div>
          )}
          {proficiencies.weapons && proficiencies.weapons.length > 0 && (
            <div>
              <span className="text-text-muted uppercase tracking-wider text-[10px]">Оружие</span>
              <div className="text-text-secondary mt-0.5">{proficiencies.weapons.join(', ')}</div>
            </div>
          )}
          {proficiencies.tools && proficiencies.tools.length > 0 && (
            <div>
              <span className="text-text-muted uppercase tracking-wider text-[10px]">Инструменты</span>
              <div className="text-text-secondary mt-0.5">{proficiencies.tools.join(', ')}</div>
            </div>
          )}
        </div>
      )}

      {/* Spells summary */}
      {spells && spells.length > 0 && (
        <div className="glass-panel p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider">
            <Sparkles size={12} />
            <span>Заклинания ({spells.length})</span>
          </div>
          <div className="space-y-0.5 text-xs">
            {spells.slice(0, 12).map((sp, i) => (
              <div key={i} className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-1 h-1 rounded-full bg-gold/50 shrink-0" />
                <span className="truncate">{sp.name}</span>
                {sp.level === 0 && <span className="text-purple-400 text-[10px]">заг.</span>}
              </div>
            ))}
            {spells.length > 12 && (
              <div className="text-text-muted text-[10px]">...и ещё {spells.length - 12}</div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
