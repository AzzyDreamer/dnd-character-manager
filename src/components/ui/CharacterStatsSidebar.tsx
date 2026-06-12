import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AbilityScores, Character } from '../../types';
import { getAbilityModifier, getSkillBonus, getAbilityShort, getSkillName, SKILL_ABILITIES } from '../../utils/dnd';
import { getACBreakdown, getInitiativeBreakdown, getClassSpeedBonus, hasInitiativeAdvantage, resolveDisplayAC, type StatPart } from '../../utils/classEffects';
import { getTransformSpeedAdjust } from '../../utils/transformationEffects';
import { getActiveSpeedAdjust } from '../../utils/activatedEffects';
import { getEffectiveSpeed, getExhaustionD20Penalty, getExhaustionLevel, hasSpeedZeroCondition } from '../../utils/conditionEffects';
import { StatBadge } from './StatBadge';
import { Shield, Heart, Footprints, Sparkles, Target, ChevronDown, Check, ImagePlus, Swords, Eye, Star, Moon, type LucideIcon } from 'lucide-react';
import { PortraitImage } from './PortraitImage';
import { CreatureToken } from './CreatureToken';
import { getActiveWildShapeForm } from '../../utils/wildShape';
import { getActiveKindredForm, getHybridFormTokenUrl } from '../../utils/kindredForm';
import { asset } from '../../utils/asset';

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
  /** Sections to hide (already shown elsewhere) */
  hideSections?: ('identity' | 'proficiencies' | 'skills' | 'spells' | 'abilities' | 'combat')[];
  /** Portrait data URL for top of sidebar */
  portraitUrl?: string;
  /** Portrait crop position */
  portraitPosition?: number | { x: number; y: number; zoom?: number };
  /** Click handler for portrait (upload/crop) */
  onPortraitClick?: () => void;
  /** Reveal combat stats (AC, init, speed, proficiency, passive perception) as a hover overlay on the portrait */
  showPortraitStats?: boolean;
  /** What the portrait hover overlay shows: combat stats (default) or ability scores. */
  portraitContent?: 'combat' | 'abilities';
}

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  'strength', 'dexterity', 'constitution',
  'intelligence', 'wisdom', 'charisma',
];

const SIDEBAR_ABILITY_ORDER: (keyof AbilityScores)[] = [
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
];

/** Render labelled stat parts as a formula string, e.g. "10 + 3 (DEX) + 2 (Shield) = 15". */
export function formatStatParts(
  parts: StatPart[],
  t: (key: string) => string,
): string {
  const labelFor = (p: StatPart): string => {
    switch (p.key) {
      case 'base': return '';
      case 'armor': return t('sidebar.breakdown.armor');
      case 'shield': return t('sidebar.breakdown.shield');
      case 'feat': return t('sidebar.breakdown.feat');
      case 'item': return t('sidebar.breakdown.item');
      case 'prof': return t('sidebar.breakdown.proficiency');
      case 'class': return t('sidebar.breakdown.class');
      case 'state': return t('sidebar.breakdown.state');
      case 'form': return t('sidebar.breakdown.form');
      case 'ability': return p.ability ? getAbilityShort(p.ability) : '';
    }
  };
  let total = 0;
  let str = '';
  parts.forEach((p, i) => {
    total += p.value;
    const lbl = labelFor(p);
    const piece = lbl ? `${Math.abs(p.value)} (${lbl})` : `${Math.abs(p.value)}`;
    if (i === 0) str = (p.value < 0 ? '−' : '') + piece;
    else str += (p.value < 0 ? ' − ' : ' + ') + piece;
  });
  return `${str} = ${total}`;
}

function SkillsPanel({
  abilityScores,
  skillProficiencies,
  character,
  profBonus,
  d20Penalty = 0,
}: {
  abilityScores?: AbilityScores;
  skillProficiencies: string[];
  character?: Character;
  profBonus: number;
  d20Penalty?: number;
}) {
  const { t } = useTranslation('common');
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
            {t('sidebar.skillsLabel')} ({skillProficiencies.length})
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
                <img
                  src={asset(`/images/skills/${sk}.webp`)}
                  alt=""
                  className="w-4 h-4 object-contain opacity-80 shrink-0"
                />
                <span className="truncate">{getSkillName(sk)}</span>
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
          {t('sidebar.skillsLabel')}
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
                  {getAbilityShort(ability)}
                </div>
                <div className="space-y-px">
                  {skillsForAbility.map(sk => {
                    const isProficient = skillProficiencies.includes(sk);
                    const hasExpertise = character?.skills?.[sk]?.expertise ?? false;
                    const score = abilityScores[ability];
                    const mod = getSkillBonus(score, isProficient, hasExpertise, profBonus) + d20Penalty;

                    return (
                      <div
                        key={sk}
                        className={`flex items-center gap-1.5 px-1 py-0.5 rounded text-[11px] ${
                          isProficient ? 'bg-gold/5' : ''
                        }`}
                      >
                        <div className="relative w-4 h-4 shrink-0">
                          <img
                            src={asset(`/images/skills/${sk}.webp`)}
                            alt=""
                            className={`w-4 h-4 object-contain ${isProficient ? 'opacity-90' : 'opacity-30 grayscale'}`}
                          />
                          {(isProficient || hasExpertise) && (
                            <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full flex items-center justify-center ${
                              hasExpertise ? 'bg-purple-500' : 'bg-gold'
                            }`}>
                              <Check size={6} className="text-black" />
                            </div>
                          )}
                        </div>
                        <span className={`flex-1 truncate ${
                          isProficient ? 'text-text-primary' : 'text-text-muted'
                        }`}>
                          {getSkillName(sk)}
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
  hideSections = [],
  portraitUrl,
  portraitPosition,
  onPortraitClick,
  showPortraitStats = false,
  portraitContent = 'combat',
}: CharacterStatsSidebarProps) {
  const { t } = useTranslation('common');
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

  // КД отображается живым (с активными эффектами — Песнь клинка и т.п.);
  // хранимый armorClass остаётся чистым от состояний.
  const ac = character ? resolveDisplayAC(character) : creationStats?.armorClass;
  const hp = character ? character.hitPoints.current : creationStats?.hitPoints;
  const hpMax = character?.hitPoints.max;
  // Exhaustion (2024): −2 per level to every d20 test; speed already folds it in.
  const exhaustionLevel = character ? getExhaustionLevel(character) : 0;
  const d20Penalty = character ? getExhaustionD20Penalty(character) : 0;
  const speed = character ? getEffectiveSpeed(character) : creationStats?.speed;
  const initiative = character !== undefined ? character.initiative + d20Penalty : undefined;
  const profBonus = character?.proficiencyBonus ?? creationStats?.proficiencyBonus;

  // ── Formula breakdowns (shown as hover tooltips; full Character only) ──
  const acTooltip = character ? formatStatParts(getACBreakdown(character), t) : undefined;
  const initTooltip = character ? (() => {
    let s = formatStatParts(getInitiativeBreakdown(character), t);
    if (d20Penalty) s += ` − ${Math.abs(d20Penalty)} (${t('sidebar.breakdown.exhaustion')}) = ${initiative}`;
    if (hasInitiativeAdvantage(character)) s += ` · ${t('sidebar.breakdown.initiativeAdvantage')}`;
    return s;
  })() : undefined;
  const speedTooltip = (() => {
    if (!character) return undefined;
    if (hasSpeedZeroCondition(character)) return t('sidebar.breakdown.speedZeroCondition');
    const classBonus = getClassSpeedBonus(character);
    const transformAdjust = getTransformSpeedAdjust(character);
    const stateAdjust = getActiveSpeedAdjust(character);
    const exhaustionCut = 5 * exhaustionLevel;
    if (!classBonus && !exhaustionCut && !transformAdjust && !stateAdjust) return undefined;
    let s = `${character.speed - classBonus}`;
    if (classBonus) s += ` + ${classBonus} (${t('sidebar.breakdown.class')})`;
    if (transformAdjust) s += ` ${transformAdjust > 0 ? '+' : '−'} ${Math.abs(transformAdjust)} (${t('sidebar.breakdown.transformation')})`;
    if (stateAdjust) s += ` ${stateAdjust > 0 ? '+' : '−'} ${Math.abs(stateAdjust)} (${t('sidebar.breakdown.state')})`;
    if (exhaustionCut) s += ` − ${exhaustionCut} (${t('sidebar.breakdown.exhaustion')})`;
    return `${s} = ${speed}`;
  })();
  const hpTooltip = character ? (() => {
    const conMod = getAbilityModifier(character.abilityScores.constitution);
    let s = `${t('sidebar.breakdown.hpCurrent')} ${character.hitPoints.current} · ${t('sidebar.breakdown.hpMax')} ${character.hitPoints.max}`;
    if (character.hitPoints.temporary > 0) s += ` · ${t('sidebar.breakdown.hpTemp')} ${character.hitPoints.temporary}`;
    s += ` · ${t('sidebar.breakdown.hpCon')} ${conMod >= 0 ? '+' : ''}${conMod}`;
    return s;
  })() : undefined;
  const ppTooltip = (abilityScores?.wisdom !== undefined && profBonus !== undefined) ? (() => {
    const parts: StatPart[] = [
      { key: 'base', value: 10 },
      { key: 'ability', ability: 'wisdom', value: getAbilityModifier(abilityScores.wisdom) },
    ];
    if (skillProficiencies.includes('perception')) parts.push({ key: 'prof', value: profBonus });
    if (character?.skills?.perception?.expertise) parts.push({ key: 'prof', value: profBonus });
    if (d20Penalty) parts.push({ key: 'feat', value: d20Penalty });
    return formatStatParts(parts, t);
  })() : undefined;

  // Stats revealed on portrait hover (sheet only) — slide up + fade in over a dark veil.
  const portraitStats: { icon?: LucideIcon; label: string; value: string; tooltip?: string }[] = [];
  if (showPortraitStats && portraitContent === 'combat') {
    if (ac !== undefined) portraitStats.push({ icon: Shield, label: t('sidebar.acLabel'), value: `${ac}`, tooltip: acTooltip });
    if (initiative !== undefined) portraitStats.push({ icon: Swords, label: t('sidebar.initiativeLabel'), value: `${initiative >= 0 ? '+' : ''}${initiative}`, tooltip: initTooltip });
    if (speed !== undefined) portraitStats.push({ icon: Footprints, label: t('sidebar.speedLabel'), value: `${speed}`, tooltip: speedTooltip });
    if (profBonus !== undefined) portraitStats.push({ icon: Star, label: t('sidebar.proficiencyLabel'), value: `+${profBonus}`, tooltip: level !== undefined ? `${t('sidebar.breakdown.profByLevel')} ${level}` : undefined });
    if (abilityScores?.wisdom !== undefined && profBonus !== undefined) {
      const passive = 10 + getSkillBonus(
        abilityScores.wisdom,
        skillProficiencies.includes('perception'),
        character?.skills?.perception?.expertise ?? false,
        profBonus,
      ) + d20Penalty;
      portraitStats.push({ icon: Eye, label: t('sidebar.passivePerception'), value: `${passive}`, tooltip: ppTooltip });
    }
  }

  const showAbilitiesOverlay = showPortraitStats && portraitContent === 'abilities' && !!abilityScores;
  const portraitStatsOverlay = (portraitStats.length > 0 || showAbilitiesOverlay) ? (
    <div
      className="absolute inset-x-0 bottom-0 p-3 pt-10 pointer-events-none
        bg-gradient-to-t from-black/90 via-black/75 to-transparent
        translate-y-full opacity-0
        group-hover:translate-y-0 group-hover:opacity-100
        transition-all duration-300 ease-out"
    >
      {showAbilitiesOverlay ? (
        <div className="grid grid-cols-3 gap-2 justify-items-center">
          {SIDEBAR_ABILITY_ORDER.map((key) => {
            const val = abilityScores![key];
            if (val === undefined) return null;
            return (
              <StatBadge
                key={key}
                label={getAbilityShort(key)}
                value={val}
                modifier={getAbilityModifier(val)}
                variant="circle"
                size="sm"
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {portraitStats.map(({ icon: Icon, label, value, tooltip }) => (
            <div
              key={label}
              className={`flex items-center gap-2 text-white${tooltip ? ' pointer-events-auto cursor-help' : ''}`}
              title={tooltip}
            >
              {Icon && <Icon size={13} className="text-gold/80 shrink-0" />}
              <span className="text-[11px] text-white/80 flex-1 leading-tight">{label}</span>
              <span className="text-sm font-bold tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  // Активная форма — токен бейджем в углу портрета. Приоритет: звериная форма
  // ликантропа (полное превращение) → Дикий облик → гибридная форма.
  const kindredForm = character ? getActiveKindredForm(character) : null;
  const wildShapeForm = !kindredForm && character ? getActiveWildShapeForm(character) : null;
  const hybridTokenUrl = !kindredForm && !wildShapeForm && character
    ? (character.activeEffects ?? []).map(e => getHybridFormTokenUrl(e.key)).find(Boolean) ?? null
    : null;
  const beastForm = kindredForm ?? wildShapeForm;
  const wildShapeBadge = beastForm ? (
    <span
      className="absolute top-2 right-2 z-10 rounded-full ring-2 ring-gold shadow-lg shadow-black/50"
      title={beastForm.creature.name}
    >
      <CreatureToken name={beastForm.form} size={44} />
    </span>
  ) : hybridTokenUrl ? (
    <span className="absolute top-2 right-2 z-10 rounded-full ring-2 ring-gold shadow-lg shadow-black/50">
      <img
        src={hybridTokenUrl}
        alt=""
        className="rounded-full object-cover bg-bg-primary"
        style={{ width: 44, height: 44 }}
      />
    </span>
  ) : null;

  return (
    <aside className={`w-72 shrink-0 hidden lg:flex flex-col gap-3 overflow-y-auto ${className}`}>
      {/* Character portrait — clickable for upload/crop */}
      {onPortraitClick ? (
        <button
          onClick={onPortraitClick}
          className="glass-panel overflow-hidden rounded-lg relative group cursor-pointer w-full"
          title={portraitUrl ? t('sidebar.configurePortrait') : t('sidebar.uploadPortrait')}
        >
          {portraitUrl ? (
            <PortraitImage
              src={portraitUrl}
              pos={portraitPosition}
              className="aspect-[9/21] w-full"
            />
          ) : (
            <div className="aspect-[9/21] w-full flex items-center justify-center bg-bg-secondary">
              <ImagePlus size={32} className="text-text-muted/30" />
            </div>
          )}
          {wildShapeBadge}
          {portraitStatsOverlay}
        </button>
      ) : portraitUrl ? (
        <div className="glass-panel overflow-hidden rounded-lg relative group">
          <PortraitImage
            src={portraitUrl}
            pos={portraitPosition}
            className="aspect-[9/21] w-full"
          />
          {wildShapeBadge}
          {portraitStatsOverlay}
        </div>
      ) : imageSrc ? (
        <div className="glass-panel overflow-hidden">
          <img
            src={imageSrc}
            alt={imageAlt || name || t('sidebar.portrait')}
            className="w-full max-h-72 object-contain"
            loading="lazy"
          />
        </div>
      ) : null}

      {/* Identity */}
      {!hideSections.includes('identity') && (
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
                    {t('sidebar.levelLabel', { level, class: cls })}
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
      )}

      {/* Ability Scores */}
      {abilityScores && !hideSections.includes('abilities') && (
        <div className="glass-panel p-3">
          <div className="grid grid-cols-3 gap-2 justify-items-center">
            {ABILITY_KEYS.map((key) => {
              const val = abilityScores[key];
              if (val === undefined) return null;
              return (
                <StatBadge
                  key={key}
                  label={getAbilityShort(key)}
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
      {showCombatStats && !hideSections.includes('combat') && (ac !== undefined || hp !== undefined || speed !== undefined) && (
        <div className="glass-panel p-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            {ac !== undefined && (
              <div className={`flex flex-col items-center gap-1${acTooltip ? ' cursor-help' : ''}`} title={acTooltip}>
                <Shield size={16} className="text-gold/70" />
                <span className="text-lg font-bold text-text-primary">{ac}</span>
                <span className="text-[10px] text-text-muted uppercase">{t('sidebar.acLabel')}</span>
              </div>
            )}
            {hp !== undefined && (
              <div className={`flex flex-col items-center gap-1${hpTooltip ? ' cursor-help' : ''}`} title={hpTooltip}>
                <Heart size={16} className="text-red-bright" />
                <span className="text-lg font-bold text-text-primary">
                  {hp}{hpMax !== undefined && `/${hpMax}`}
                </span>
                <span className="text-[10px] text-text-muted uppercase">{t('sidebar.hpLabel')}</span>
              </div>
            )}
            {initiative !== undefined && (
              <div className={`flex flex-col items-center gap-1${initTooltip ? ' cursor-help' : ''}`} title={initTooltip}>
                <Swords size={16} className="text-gold/70" />
                <span className="text-lg font-bold text-text-primary">{initiative >= 0 ? '+' : ''}{initiative}</span>
                <span className="text-[10px] text-text-muted uppercase">{t('sidebar.initiativeLabel')}</span>
              </div>
            )}
            {speed !== undefined && (
              <div className={`flex flex-col items-center gap-1${speedTooltip ? ' cursor-help' : ''}`} title={speedTooltip}>
                <Footprints size={16} className="text-gold/70" />
                <span className="text-lg font-bold text-text-primary">{speed}</span>
                <span className="text-[10px] text-text-muted uppercase">{t('sidebar.speedLabel')}</span>
              </div>
            )}
          </div>
          {profBonus !== undefined && (
            <div className="mt-2 pt-2 border-t border-border-default text-center" title={level !== undefined ? `${t('sidebar.breakdown.profByLevel')} ${level}` : undefined}>
              <span className="text-[10px] text-text-muted uppercase">{t('sidebar.proficiencyLabel')}</span>
              <span className="ml-2 text-sm font-bold text-gold">+{profBonus}</span>
            </div>
          )}
          {abilityScores?.wisdom !== undefined && profBonus !== undefined && (
            <div className="mt-2 pt-2 border-t border-border-default flex items-center justify-center gap-1.5"
              title={ppTooltip}>
              <Eye size={12} className="text-gold/70" />
              <span className="text-[10px] text-text-muted uppercase">{t('sidebar.passivePerception')}</span>
              <span className="text-sm font-bold text-text-primary">
                {10 + getSkillBonus(
                  abilityScores.wisdom,
                  skillProficiencies.includes('perception'),
                  character?.skills?.perception?.expertise ?? false,
                  profBonus,
                ) + d20Penalty}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Senses */}
      {character?.senses && (Object.values(character.senses).some(v => (v ?? 0) > 0)) && (
        <div className="glass-panel p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
            <Moon size={12} className="text-gold/70" />
            <span>{t('sidebar.sensesLabel')}</span>
          </div>
          <div className="space-y-0.5 text-xs">
            {([
              ['darkvision', t('sidebar.senses.darkvision')],
              ['blindsight', t('sidebar.senses.blindsight')],
              ['tremorsense', t('sidebar.senses.tremorsense')],
              ['truesight', t('sidebar.senses.truesight')],
            ] as const).map(([key, label]) => {
              const val = character.senses?.[key] ?? 0;
              if (val <= 0) return null;
              return (
                <div key={key} className="flex items-center justify-between text-text-secondary">
                  <span>{label}</span>
                  <span className="font-bold text-text-primary tabular-nums">{t('sidebar.senses.feet', { value: val })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proficiencies */}
      {proficiencies && !hideSections.includes('proficiencies') && (
        <div className="glass-panel p-3 space-y-2 text-xs">
          {proficiencies.languages && proficiencies.languages.length > 0 && (
            <div>
              <span className="text-text-muted uppercase tracking-wider text-[10px]">{t('sidebar.languagesLabel')}</span>
              <div className="text-text-secondary mt-0.5">{proficiencies.languages.join(', ')}</div>
            </div>
          )}
          {proficiencies.armor && proficiencies.armor.length > 0 && (
            <div>
              <span className="text-text-muted uppercase tracking-wider text-[10px]">{t('sidebar.armorLabel')}</span>
              <div className="text-text-secondary mt-0.5">{proficiencies.armor.join(', ')}</div>
            </div>
          )}
          {proficiencies.weapons && proficiencies.weapons.length > 0 && (
            <div>
              <span className="text-text-muted uppercase tracking-wider text-[10px]">{t('sidebar.weaponsLabel')}</span>
              <div className="text-text-secondary mt-0.5">{proficiencies.weapons.join(', ')}</div>
            </div>
          )}
          {proficiencies.tools && proficiencies.tools.length > 0 && (
            <div>
              <span className="text-text-muted uppercase tracking-wider text-[10px]">{t('sidebar.toolsLabel')}</span>
              <div className="text-text-secondary mt-0.5">{proficiencies.tools.join(', ')}</div>
            </div>
          )}
        </div>
      )}

      {/* Skills — expandable */}
      {!hideSections.includes('skills') && (
        <SkillsPanel
          abilityScores={abilityScores}
          skillProficiencies={skillProficiencies}
          character={character}
          profBonus={profBonus ?? 2}
          d20Penalty={d20Penalty}
        />
      )}

      {/* Spells summary */}
      {spells && spells.length > 0 && !hideSections.includes('spells') && (
        <div className="glass-panel p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider">
            <Sparkles size={12} />
            <span>{t('sidebar.spellsLabel')} ({spells.length})</span>
          </div>
          <div className="space-y-0.5 text-xs">
            {spells.slice(0, 12).map((sp, i) => (
              <div key={i} className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-1 h-1 rounded-full bg-gold/50 shrink-0" />
                <span className="truncate">{sp.name}</span>
                {sp.level === 0 && <span className="text-purple-400 text-[10px]">{t('sidebar.cantripShort')}</span>}
              </div>
            ))}
            {spells.length > 12 && (
              <div className="text-text-muted text-[10px]">{t('sidebar.andMore', { count: spells.length - 12 })}</div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
