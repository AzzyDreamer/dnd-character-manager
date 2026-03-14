import { useState } from 'react';
import type { AbilityScores, Character } from '../../types';
import { getAbilityModifier, getSkillBonus, ABILITY_SHORT, SKILL_NAMES, SKILL_ABILITIES } from '../../utils/dnd';
import { StatBadge } from './StatBadge';
import { Shield, Heart, Footprints, Sparkles, Target, ChevronDown, Check } from 'lucide-react';

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
  skills?: string[]; // skill keys that are proficient
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
  /** Optional image URL to display at the top of the sidebar */
  imageSrc?: string;
  /** Alt text for the image */
  imageAlt?: string;
  /** Class icon URL shown next to class name */
  classIconSrc?: string;
  className?: string;
}

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  'strength', 'dexterity', 'constitution',
  'intelligence', 'wisdom', 'charisma',
];

const SIDEBAR_ABILITY_ORDER: (keyof AbilityScores)[] = [
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
];

function SkillsPanel({
  abilityScores,
  skillProficiencies,
  character,
  profBonus,
}: {
  abilityScores?: AbilityScores;
  skillProficiencies: string[];
  character?: Character;
  profBonus: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!abilityScores) {
    // No scores yet — just show count if any
    if (skillProficiencies.length === 0) return null;
    return (
      <div className="glass-panel p-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full text-left"
        >
          <Target size={12} className="text-gold/70" />
          <span className="text-[10px] text-text-muted uppercase tracking-wider flex-1">
            Навыки ({skillProficiencies.length})
          </span>
          <ChevronDown
            size={12}
            className={`text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        {expanded && (
          <div className="mt-2 space-y-0.5 text-xs">
            {skillProficiencies.map(sk => (
              <div key={sk} className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-gold/60 shrink-0" />
                <span className="truncate">{SKILL_NAMES[sk] || sk}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full panel — all 18 skills grouped by ability
  return (
    <div className="glass-panel p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        <Target size={12} className="text-gold/70" />
        <span className="text-[10px] text-text-muted uppercase tracking-wider flex-1">
          Навыки
          {skillProficiencies.length > 0 && (
            <span className="text-gold ml-1">({skillProficiencies.length})</span>
          )}
        </span>
        <ChevronDown
          size={12}
          className={`text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {SIDEBAR_ABILITY_ORDER.map(ability => {
            const skillsForAbility = Object.entries(SKILL_ABILITIES)
              .filter(([, ab]) => ab === ability)
              .map(([key]) => key);
            if (skillsForAbility.length === 0) return null;

            return (
              <div key={ability}>
                <div className="text-[9px] uppercase tracking-wider text-text-muted/60 font-bold mb-0.5">
                  {ABILITY_SHORT[ability]}
                </div>
                <div className="space-y-px">
                  {skillsForAbility.map(sk => {
                    const isProficient = skillProficiencies.includes(sk);
                    const hasExpertise = character?.skills?.[sk]?.expertise ?? false;
                    const score = abilityScores[ability];
                    const mod = getSkillBonus(score, isProficient, hasExpertise, profBonus);

                    return (
                      <div
                        key={sk}
                        className={`flex items-center gap-1.5 px-1 py-0.5 rounded text-[11px] ${
                          isProficient ? 'bg-gold/5' : ''
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                          hasExpertise
                            ? 'border-purple-400 bg-purple-900/40'
                            : isProficient
                              ? 'border-gold bg-gold/20'
                              : 'border-border-default/50'
                        }`}>
                          {(isProficient || hasExpertise) && (
                            <Check size={7} className={hasExpertise ? 'text-purple-300' : 'text-gold'} />
                          )}
                        </div>
                        <span className={`flex-1 truncate ${
                          isProficient ? 'text-text-primary' : 'text-text-muted'
                        }`}>
                          {SKILL_NAMES[sk]}
                        </span>
                        <span className={`font-bold tabular-nums text-[10px] ${
                          isProficient
                            ? mod >= 0 ? 'text-green-400' : 'text-red-bright'
                            : 'text-text-muted/60'
                        }`}>
                          {mod >= 0 ? '+' : ''}{mod}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CharacterStatsSidebar({
  character,
  creationStats,
  showCombatStats = true,
  imageSrc,
  imageAlt,
  classIconSrc,
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

  // Skills — from character.skills (full) or creationStats.skills (keys only)
  const skillProficiencies: string[] = (() => {
    if (character?.skills) {
      return Object.entries(character.skills)
        .filter(([, v]) => v.proficient)
        .map(([k]) => k);
    }
    return creationStats?.skills ?? [];
  })();

  const ac = character?.armorClass ?? creationStats?.armorClass;
  const hp = character ? character.hitPoints.current : creationStats?.hitPoints;
  const hpMax = character?.hitPoints.max;
  const speed = character?.speed ?? creationStats?.speed;
  const profBonus = character?.proficiencyBonus ?? creationStats?.proficiencyBonus;

  return (
    <aside className={`w-72 shrink-0 hidden lg:flex flex-col gap-3 overflow-y-auto ${className}`}>
      {/* Character image */}
      {imageSrc && (
        <div className="glass-panel overflow-hidden">
          <img
            src={imageSrc}
            alt={imageAlt || name || 'Портрет'}
            className="w-full max-h-72 object-contain"
            loading="lazy"
          />
        </div>
      )}

      {/* Identity */}
      <div className="glass-panel p-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 space-y-0.5">
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
          {classIconSrc && (
            <img
              src={classIconSrc}
              alt={cls}
              className="w-10 h-10 object-contain shrink-0 opacity-80"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
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

      {/* Skills — expandable */}
      <SkillsPanel
        abilityScores={abilityScores}
        skillProficiencies={skillProficiencies}
        character={character}
        profBonus={profBonus ?? 2}
      />

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
