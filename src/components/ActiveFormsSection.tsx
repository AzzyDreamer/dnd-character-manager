// Секция «Активные формы и стойки»: тумблеры активируемых эффектов (ярость,
// Песнь клинка, гибридные формы…). Активация списывает ресурс и проставляет
// expiresAt; деактивация ресурс не возвращает. Дельты применяются ЖИВЬЁМ
// (getACBreakdown/getEffectiveSpeed/getEffectiveResistances) и никогда не
// вшиваются в хранимые статы персонажа.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, AbilityScores } from '../types';
import {
  ACTIVATED_EFFECTS,
  getAvailableEffects,
  getActiveEffectEntries,
  getEffectDuration,
  getEffectName,
  isEffectAvailable,
  isEffectConditionMet,
  isEffectExpired,
  activateEffect,
  deactivateEffect,
  type ActivatedEffectDef,
  type ActiveStatDelta,
  type EffectDuration,
  type TranslateFn,
} from '../utils/activatedEffects';
import { getClassResources, getSubclassResources, getLevelTableRow } from '../utils/classResources';
import { getAbilityName, getAbilityShort } from '../utils/dnd';
import { getDamageTypeFullName } from '../data/items/constants';
import {
  Flame, Music, Skull, Mountain, Sprout, Waves, ShieldCheck, Crown, Feather,
  PawPrint, Droplets, Shell, Ghost, Target, Sparkles, Hourglass, ChevronDown, Zap,
  type LucideIcon,
} from 'lucide-react';

const EFFECT_ICONS: Record<string, LucideIcon> = {
  rage: Flame,
  bladesong: Music,
  'form-of-dread': Skull,
  'giants-might': Mountain,
  'symbiotic-entity': Sprout,
  'wrath-of-the-sea': Waves,
  'superior-defense': ShieldCheck,
  'invincible-conqueror': Crown,
  'exalted-champion': Crown,
  'avenging-angel': Feather,
  'hybrid-wolf-form': PawPrint,
  'hybrid-bear-form': PawPrint,
  'hybrid-rat-form': PawPrint,
  'ooze-form': Droplets,
  'writhing-tendrils': Sparkles,
  'chitinous-shell': Shell,
  'slimy-form': Droplets,
  'angelic-wings': Feather,
  'incorporeal-movement': Ghost,
  'bow-celestial-judgement': Target,
};

type TFn = TranslateFn;

const MOVE_LABEL_KEYS: Record<string, string> = {
  fly: 'sheet.movement.fly',
  swim: 'sheet.movement.swim',
  climb: 'sheet.movement.climb',
};

/** Краткое описание дельт эффекта (резисты, КД, скорость, floor, пометки). */
function buildDeltaSummary(
  delta: ActiveStatDelta,
  char: Character,
  t: TFn,
  tg: TFn,
): string[] {
  const parts: string[] = [];
  if (char.level < (delta.minLevel ?? 1)) return parts;

  if (delta.acBonus) {
    parts.push(t('sheet.activeEffects.deltas.acFlat', { value: `${delta.acBonus > 0 ? '+' : '−'}${Math.abs(delta.acBonus)}` }));
  }
  if (delta.acBonusAbility) {
    parts.push(t('sheet.activeEffects.deltas.acAbility', { ability: getAbilityShort(delta.acBonusAbility) }));
  }
  if (delta.speedBonus) {
    parts.push(t('sheet.activeEffects.deltas.speed', { value: `${delta.speedBonus > 0 ? '+' : '−'}${Math.abs(delta.speedBonus)}` }));
  }
  for (const [kind, value] of Object.entries(delta.moveSpeeds ?? {})) {
    if (typeof value !== 'number') continue;
    const label = t(MOVE_LABEL_KEYS[kind] ?? kind);
    parts.push(value === -1
      ? t('sheet.activeEffects.deltas.moveEqualsWalk', { kind: label })
      : t('sheet.activeEffects.deltas.move', { kind: label, value }));
  }
  if (delta.resistances?.length) {
    parts.push(t('sheet.activeEffects.deltas.resist', {
      types: delta.resistances.map(getDamageTypeFullName).join(', ').toLowerCase(),
    }));
  }
  if (delta.resistAllExcept) {
    parts.push(delta.resistAllExcept.length === 0
      ? t('sheet.activeEffects.deltas.resistAll')
      : t('sheet.activeEffects.deltas.resistAllExcept', {
          types: delta.resistAllExcept.map(getDamageTypeFullName).join(', ').toLowerCase(),
        }));
  }
  if (delta.immunities?.length) {
    parts.push(t('sheet.activeEffects.deltas.immune', {
      types: delta.immunities.map(getDamageTypeFullName).join(', ').toLowerCase(),
    }));
  }
  for (const [ability, floor] of Object.entries(delta.abilityFloor ?? {})) {
    parts.push(t('sheet.activeEffects.deltas.abilityFloor', {
      ability: getAbilityName(ability as keyof AbilityScores),
      value: floor,
    }));
  }
  for (const note of delta.notes ?? []) {
    parts.push(tg(`activeEffects.notes.${note}`, { defaultValue: note }));
  }
  return parts;
}

function formatDuration(duration: EffectDuration, t: TFn): string {
  switch (duration.type) {
    case 'minutes': return t('sheet.activeEffects.duration.minutes', { n: duration.amount });
    case 'hours': return t('sheet.activeEffects.duration.hours', { n: duration.amount });
    case 'untilShortRest':
    case 'untilLongRest': return t('sheet.activeEffects.duration.untilRest');
    case 'manual': return t('sheet.activeEffects.duration.manual');
  }
}

/** Причина недоступности по условиям экипировки (или null, если условия выполнены). */
function getUnmetConditionText(char: Character, def: ActivatedEffectDef, t: (k: string) => string): string | null {
  if (isEffectConditionMet(char, def)) return null;
  if (def.requiresNoArmor) return t('sheet.activeEffects.req.noArmor');
  if (def.requiresNoMediumHeavyArmor) return t('sheet.activeEffects.req.noMediumHeavyArmor');
  if (def.requiresNoHeavyArmor) return t('sheet.activeEffects.req.noHeavyArmor');
  if (def.requiresNoShield) return t('sheet.activeEffects.req.noShield');
  return t('sheet.activeEffects.req.generic');
}

/**
 * Маленькие бейджи активных эффектов возле блока боевых статов («почему КД 17»).
 */
export function ActiveEffectBadges({ character }: { character: Character }) {
  const { t: tg } = useTranslation('game');
  const entries = getActiveEffectEntries(character);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border-default">
      {entries.map(e => {
        const Icon = EFFECT_ICONS[e.key] ?? Sparkles;
        const conditionMet = ACTIVATED_EFFECTS[e.key]
          ? isEffectConditionMet(character, ACTIVATED_EFFECTS[e.key])
          : true;
        return (
          <span
            key={e.key}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
              conditionMet
                ? 'border-gold/40 bg-gold/10 text-gold'
                : 'border-amber-700/40 bg-amber-900/20 text-amber-400 line-through'
            }`}
          >
            <Icon size={10} />
            {getEffectName(e.key, tg)}
          </span>
        );
      })}
    </div>
  );
}

export function ActiveFormsSection({
  character,
  onUpdate,
}: {
  character: Character;
  onUpdate: (c: Character) => void;
}) {
  const { t } = useTranslation('character');
  const { t: tg } = useTranslation('game');
  const [collapsed, setCollapsed] = useState(false);
  // Максимумы ресурсов из levelTable класса (rages, wildShape, focusPoints) и
  // SUBCLASS_RESOURCES (bladesong и т.п.) — для персонажей, ещё не открывавших
  // вкладку «Действия», где трекеры инициализируются.
  const [resourceMaxes, setResourceMaxes] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const classLoader = await import('../data/classes/classJsonLoader');
        await classLoader.init();
        if (cancelled) return;
        const maxes: Record<string, number> = {};
        const classData = classLoader.ALL_CLASS_DATA.find(
          c => c.id === character.classId || c.name === character.class
        );
        if (classData?.levelTable) {
          const row = getLevelTableRow(classData.levelTable, character.level);
          for (const r of getClassResources(row)) maxes[r.key] = r.max;
        }
        if (character.subclass && character.classId) {
          const { CLASS_REGISTRY: registry, findSubclass: findSub } = await import('../data/classes');
          const classDef = registry.find(c => c.id === character.classId);
          const subDef = classDef ? findSub(classDef, character.subclass) : undefined;
          if (subDef) {
            for (const r of getSubclassResources(character.classId, subDef.id, character.level)) {
              maxes[r.key] = r.max;
            }
          }
        }
        if (!cancelled) setResourceMaxes(maxes);
      } catch { /* class data unavailable — resource counters hidden */ }
    })();
    return () => { cancelled = true; };
  }, [character.classId, character.class, character.level, character.subclass]);

  const available = getAvailableEffects(character);
  if (available.length === 0) return null;

  const activeEntries = getActiveEffectEntries(character);
  const entryFor = (key: string) => activeEntries.find(e => e.key === key);

  const getResourceState = (def: ActivatedEffectDef): { current: number; max: number } | null => {
    if (!def.resourceKey) return null;
    const tracker = character.resourceTrackers?.[def.resourceKey];
    const max = tracker?.max ?? resourceMaxes[def.resourceKey];
    if (max == null) return null;
    return { current: tracker?.current ?? max, max };
  };

  const handleToggle = (def: ActivatedEffectDef) => {
    if (entryFor(def.key)) {
      onUpdate(deactivateEffect(character, def.key));
      return;
    }
    if (!isEffectConditionMet(character, def)) return;
    const res = getResourceState(def);
    const cost = def.resourceCost ?? 1;
    if (def.resourceKey && res && res.current < cost) return;
    onUpdate(activateEffect(character, def.key, res?.max).char);
  };

  return (
    <div className="glass-panel p-3">
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 w-full text-left">
        <Zap className="text-gold" size={20} />
        <h2 className="text-lg font-medieval text-gold flex-1">
          {t('sheet.activeEffects.title')}
          {activeEntries.length > 0 && (
            <span className="text-gold/70 text-sm ml-1.5">({activeEntries.length})</span>
          )}
        </h2>
        <ChevronDown size={16} className={`text-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      {!collapsed && (
        <div className="mt-2 space-y-1.5">
          {available.map(def => {
            const entry = entryFor(def.key);
            const isActive = !!entry;
            const expired = entry ? isEffectExpired(entry) : false;
            const unmetCondition = getUnmetConditionText(character, def, t);
            const res = getResourceState(def);
            const cost = def.resourceCost ?? 1;
            const noResource = !isActive && !!def.resourceKey && !!res && res.current < cost;
            const Icon = EFFECT_ICONS[def.key] ?? Sparkles;
            const duration = getEffectDuration(character, def);
            const canActivate = !unmetCondition && !noResource;

            // Дельты самого эффекта + связанных даров «пока форма активна»
            const summary = buildDeltaSummary(def.effects, character, t, tg);
            const linkedLines: { name: string; summary: string }[] = [];
            for (const link of def.linked ?? []) {
              const linkedDef = ACTIVATED_EFFECTS[link.key];
              if (!linkedDef || !isEffectAvailable(character, linkedDef)) continue;
              const linkedSummary = buildDeltaSummary(linkedDef.effects, character, t, tg);
              if (linkedSummary.length > 0) {
                linkedLines.push({ name: getEffectName(link.key, tg), summary: linkedSummary.join(' · ') });
              }
            }

            return (
              <div
                key={def.key}
                className={`rounded-lg border px-2.5 py-2 transition-colors ${
                  isActive
                    ? unmetCondition
                      ? 'border-amber-600/50 bg-amber-900/15'
                      : 'border-gold/50 bg-gold/10'
                    : 'border-border-default bg-bg-primary/40'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon size={16} className={isActive ? 'text-gold' : 'text-text-muted'} />
                  <span className={`text-sm font-medium ${isActive ? 'text-gold' : 'text-text-primary'}`}>
                    {getEffectName(def.key, tg)}
                  </span>

                  {res && (
                    <span
                      className={`text-[10px] tabular-nums px-1 py-0.5 rounded border ${
                        noResource ? 'border-red-700/50 text-red-400' : 'border-border-default text-text-muted'
                      }`}
                      title={cost > 1 ? t('sheet.activeEffects.costTooltip', { cost }) : undefined}
                    >
                      {res.current}/{res.max}{cost > 1 ? ` (−${cost})` : ''}
                    </span>
                  )}

                  <span className="text-[10px] px-1 py-0.5 rounded border border-border-default text-text-muted flex items-center gap-0.5">
                    <Hourglass size={9} />
                    {formatDuration(duration, t)}
                  </span>

                  {isActive && !expired && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/20 text-gold font-bold">
                      {t('sheet.activeEffects.active')}
                    </span>
                  )}
                  {isActive && expired && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 font-bold">
                      {t('sheet.activeEffects.expired')}
                    </span>
                  )}
                  {isActive && unmetCondition && (
                    <span className="text-[10px] text-amber-400">{unmetCondition}</span>
                  )}

                  <button
                    onClick={() => handleToggle(def)}
                    disabled={!isActive && !canActivate}
                    className={`ml-auto px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                      isActive
                        ? 'border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover'
                        : canActivate
                          ? 'border-gold/40 bg-gold/10 text-gold hover:bg-gold/20'
                          : 'border-border-default text-text-muted opacity-50 cursor-not-allowed'
                    }`}
                    title={!isActive && unmetCondition ? unmetCondition : undefined}
                  >
                    {isActive ? t('sheet.activeEffects.deactivate') : t('sheet.activeEffects.activate')}
                  </button>
                </div>

                {(summary.length > 0 || linkedLines.length > 0 || (!isActive && (unmetCondition || noResource))) && (
                  <div className="mt-1 ml-6 space-y-0.5">
                    {summary.length > 0 && (
                      <p className="text-[11px] text-text-muted leading-snug">{summary.join(' · ')}</p>
                    )}
                    {linkedLines.map(line => (
                      <p key={line.name} className="text-[11px] text-emerald-400/80 leading-snug">
                        + {line.name}: <span className="text-text-muted">{line.summary}</span>
                      </p>
                    ))}
                    {!isActive && unmetCondition && (
                      <p className="text-[10px] text-amber-400/90">{unmetCondition}</p>
                    )}
                    {!isActive && noResource && (
                      <p className="text-[10px] text-red-400/90">{t('sheet.activeEffects.noResource')}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
