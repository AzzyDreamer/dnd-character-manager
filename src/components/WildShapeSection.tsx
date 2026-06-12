// Секция «Дикий облик» (друид PHB'24): известные формы (4/6/8 по уровню),
// пикер форм под лимиты (CR, запрет полёта до 8 ур.) с предпросмотром статблока,
// активация с тратой использования и карточка активной формы. Длительность —
// ручной трекер ИГРОВОГО времени (±30 мин), к реальным часам не привязан.
// Статы зверя применяются живьём через utils/wildShape.ts — здесь только UI.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character } from '../types';
import {
  getWildShapeLimits,
  getEligibleForms,
  getKnownFormNames,
  setKnownForms,
  getActiveWildShapeForm,
  activateWildShape,
  deactivateWildShape,
  adjustWildShapeTime,
  isWildShapeExpired,
  getWildShapeAC,
} from '../utils/wildShape';
import {
  getCreatureByName,
  getCreatureAC,
  crToString,
  crToNumber,
  type CreatureData,
  type CreatureAction,
} from '../data/creatures';
import { getClassResources, getLevelTableRow } from '../utils/classResources';
import { deactivateKindredForm } from '../utils/kindredForm';
import { getAbilityModifier, getAbilityShort } from '../utils/dnd';
import { EntryRenderer } from '../utils/entryRenderer';
import { CreatureToken } from './ui/CreatureToken';
import { PawPrint, ChevronDown, Hourglass, Search, X, Pencil, Info, Minus, Plus } from 'lucide-react';

const fmtMod = (v: number) => {
  const m = getAbilityModifier(v);
  return `${v} (${m >= 0 ? '+' : ''}${m})`;
};

/** Подпись скоростей зверя с локализованными видами движения. */
function speedSummary(c: CreatureData, t: (k: string) => string): string {
  const s = c.speed ?? {};
  const parts: string[] = [];
  if (s.walk !== undefined) parts.push(`${s.walk}`);
  if (s.fly) parts.push(`${t('sheet.movement.fly').toLowerCase()} ${s.fly}`);
  if (s.swim) parts.push(`${t('sheet.movement.swim').toLowerCase()} ${s.swim}`);
  if (s.climb) parts.push(`${t('sheet.movement.climb').toLowerCase()} ${s.climb}`);
  if (s.burrow) parts.push(`${t('sheet.movement.burrow').toLowerCase()} ${s.burrow}`);
  return parts.join(', ');
}

/** Статы, черты и действия зверя — карточка формы и пикер; переиспользуется Kindred Form. */
export function CreatureDetails({ creature, ac }: { creature: CreatureData; ac: number }) {
  const { t } = useTranslation('character');
  const c = creature;

  const blocks: { titleKey: string; items: CreatureAction[] }[] = [
    { titleKey: 'sheet.wildShape.traits', items: c.trait ?? [] },
    { titleKey: 'sheet.wildShape.attacks', items: [...(c.action ?? []), ...(c.bonus ?? []), ...(c.reaction ?? [])] },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-secondary">
        <span>{t('sheet.wildShape.statline.ac')} <b className="text-text-primary">{ac}</b></span>
        <span>{t('sheet.wildShape.statline.speed')} <b className="text-text-primary">{speedSummary(c, t)}</b></span>
        <span>
          {getAbilityShort('strength')} <b className="text-text-primary">{fmtMod(c.str)}</b>{' '}
          {getAbilityShort('dexterity')} <b className="text-text-primary">{fmtMod(c.dex)}</b>{' '}
          {getAbilityShort('constitution')} <b className="text-text-primary">{fmtMod(c.con)}</b>
        </span>
      </div>
      {(c.senses?.length || c.skill) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
          {c.senses?.length ? <span>{t('sheet.wildShape.senses')}: {c.senses.join(', ')}</span> : null}
          {c.skill ? (
            <span>
              {t('sheet.wildShape.skills')}: {Object.entries(c.skill).map(([k, v]) => `${k} ${v}`).join(', ')}
            </span>
          ) : null}
        </div>
      )}
      {blocks.map(b => b.items.length > 0 && (
        <div key={b.titleKey}>
          <p className="text-[10px] uppercase tracking-wider text-gold/70 mb-0.5">{t(b.titleKey)}</p>
          <EntryRenderer
            className="text-xs"
            entries={b.items.map(a => ({ type: 'entries', name: a.name, entries: a.entries }))}
          />
        </div>
      ))}
    </div>
  );
}

/** Модал выбора известных форм: фильтр по лимитам, поиск, предпросмотр статблока. */
function FormPickerModal({
  character,
  onSave,
  onClose,
}: {
  character: Character;
  onSave: (names: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('character');
  const limits = getWildShapeLimits(character);
  const [selected, setSelected] = useState<string[]>(() => getKnownFormNames(character));
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!limits) return null;

  // 106 существ — сортировка на рендер дешёвая, мемоизация не нужна
  const eligible = getEligibleForms(limits).sort((a, b) =>
    (crToNumber(a.cr) - crToNumber(b.cr)) || a.name.localeCompare(b.name)
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? eligible.filter(c => c.name.toLowerCase().includes(q) || c._origName?.toLowerCase().includes(q))
    : eligible;

  // Храним стабильный английский ключ (_origName), а не переведённое имя
  const keyOf = (c: CreatureData) => c._origName ?? c.name;

  const toggle = (name: string) => {
    setSelected(prev => prev.includes(name)
      ? prev.filter(n => n !== name)
      : prev.length < limits.knownForms ? [...prev, name] : prev);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="glass-panel w-full max-w-lg max-h-[80vh] flex flex-col p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <PawPrint className="text-gold" size={18} />
          <h3 className="text-lg font-medieval text-gold flex-1">{t('sheet.wildShape.picker.title')}</h3>
          <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded border ${
            selected.length >= limits.knownForms
              ? 'border-gold/50 text-gold'
              : 'border-border-default text-text-muted'
          }`}>
            {t('sheet.wildShape.picker.selected', { current: selected.length, max: limits.knownForms })}
          </span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="relative mb-2">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('sheet.wildShape.picker.search')}
            className="w-full bg-bg-primary border border-border-default rounded-lg pl-7 pr-2 py-1.5 text-sm text-text-primary"
          />
        </div>

        <div className="overflow-y-auto flex-1 space-y-1 pr-1">
          {filtered.length === 0 && (
            <p className="text-sm text-text-muted py-4 text-center">{t('sheet.wildShape.picker.empty')}</p>
          )}
          {filtered.map(c => {
            const key = keyOf(c);
            const isSelected = selected.includes(key);
            const isExpanded = expanded === key;
            const full = !isSelected && selected.length >= limits.knownForms;
            return (
              <div
                key={key}
                className={`rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-gold/50 bg-gold/10'
                    : full
                      ? 'border-border-default opacity-40'
                      : 'border-border-default bg-bg-primary/40 hover:border-border-hover'
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !full && toggle(key)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!full) toggle(key); } }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left ${full ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <CreatureToken name={c.name} size={28} />
                  <span className={`text-sm flex-1 ${isSelected ? 'text-gold' : 'text-text-primary'}`}>
                    {c.name}
                  </span>
                  {c.speed?.fly ? (
                    <span className="text-[9px] uppercase px-1 py-0.5 rounded border border-sky-700/50 text-sky-400">
                      {t('sheet.movement.fly')}
                    </span>
                  ) : null}
                  <span className="text-[10px] tabular-nums px-1 py-0.5 rounded border border-border-default text-text-muted">
                    {t('sheet.wildShape.crBadge', { cr: crToString(c.cr) })}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setExpanded(isExpanded ? null : key); }}
                    className={`p-1 rounded transition-colors ${
                      isExpanded ? 'text-gold' : 'text-text-muted hover:text-text-primary'
                    }`}
                    title={t('sheet.wildShape.picker.details')}
                  >
                    <Info size={14} />
                  </button>
                </div>
                {isExpanded && (
                  <div className="px-2.5 pb-2 pt-1 border-t border-border-default/60">
                    <CreatureDetails creature={c} ac={getCreatureAC(c)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border-default">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border-default text-sm text-text-secondary hover:text-text-primary"
          >
            {t('sheet.wildShape.picker.cancel')}
          </button>
          <button
            onClick={() => onSave(selected)}
            className="px-3 py-1.5 rounded-lg border border-gold/40 bg-gold/10 text-sm text-gold hover:bg-gold/20"
          >
            {t('sheet.wildShape.picker.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WildShapeSection({
  character,
  onUpdate,
}: {
  character: Character;
  onUpdate: (c: Character) => void;
}) {
  const { t } = useTranslation('character');
  const [collapsed, setCollapsed] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // Максимум использований из levelTable друида — для персонажей, ещё не
  // открывавших вкладку «Действия», где инициализируются трекеры.
  const [resourceMax, setResourceMax] = useState<number | undefined>(undefined);

  const isDruid = character.classId === 'druid';

  useEffect(() => {
    if (!isDruid) return;
    let cancelled = false;
    (async () => {
      try {
        const classLoader = await import('../data/classes/classJsonLoader');
        await classLoader.init();
        if (cancelled) return;
        const classData = classLoader.ALL_CLASS_DATA.find(
          c => c.id === character.classId || c.name === character.class
        );
        if (classData?.levelTable) {
          const row = getLevelTableRow(classData.levelTable, character.level);
          const res = getClassResources(row).find(r => r.key === 'wildShape');
          if (!cancelled) setResourceMax(res?.max);
        }
      } catch { /* class data unavailable — счётчик скрыт */ }
    })();
    return () => { cancelled = true; };
  }, [isDruid, character.classId, character.class, character.level]);

  const limits = getWildShapeLimits(character);
  if (!limits) return null;

  const known = getKnownFormNames(character);
  const active = getActiveWildShapeForm(character);
  const expired = isWildShapeExpired(character);

  const tracker = character.resourceTrackers?.wildShape;
  const max = tracker?.max ?? resourceMax;
  const current = tracker?.current ?? max;
  const noResource = max != null && (current ?? 0) < 1;

  const handleActivate = (name: string) => {
    if (noResource) return;
    // Kindred Form несовместима с Диким обликом — снять с возвратом хитов
    onUpdate(activateWildShape(deactivateKindredForm(character), name, max));
  };

  // Ручной трекер игрового времени: −30 мин на нуле снимает форму
  const handleAdjustTime = (delta: number) => {
    const remaining = active?.remainingHours ?? limits.durationHours;
    if (delta < 0 && remaining + delta <= 0) {
      onUpdate(deactivateWildShape(character));
    } else {
      onUpdate(adjustWildShapeTime(character, delta));
    }
  };

  return (
    <div className="glass-panel p-3">
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 w-full text-left">
        <PawPrint className="text-gold" size={20} />
        <h2 className="text-lg font-medieval text-gold flex-1">
          {t('sheet.wildShape.title')}
          {active && (
            <span className="text-gold/70 text-sm ml-1.5">({active.creature.name})</span>
          )}
        </h2>
        {max != null && (
          <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded border ${
            noResource ? 'border-red-700/50 text-red-400' : 'border-border-default text-text-muted'
          }`}>
            {current}/{max}
          </span>
        )}
        <ChevronDown size={16} className={`text-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      {!collapsed && (
        <div className="mt-2 space-y-1.5">
          {/* Сводка лимитов */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
            <span className="px-1.5 py-0.5 rounded border border-border-default">
              {t('sheet.wildShape.knownForms', { current: known.length, max: limits.knownForms })}
            </span>
            <span className="px-1.5 py-0.5 rounded border border-border-default">
              {t('sheet.wildShape.maxCR', { cr: limits.maxCR < 1 ? `1/${Math.round(1 / limits.maxCR)}` : limits.maxCR })}
            </span>
            <span className="px-1.5 py-0.5 rounded border border-border-default">
              {limits.flyAllowed ? t('sheet.wildShape.flyAllowed') : t('sheet.wildShape.flyFrom8')}
            </span>
            <span className="px-1.5 py-0.5 rounded border border-border-default">
              {t('sheet.wildShape.tempHp', { hp: limits.tempHP })}
            </span>
            <span className="px-1.5 py-0.5 rounded border border-border-default">
              {t('sheet.wildShape.duration', { hours: limits.durationHours })}
            </span>
            <button
              onClick={() => setShowPicker(true)}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg border border-gold/40 bg-gold/10 text-gold text-xs hover:bg-gold/20"
            >
              <Pencil size={11} />
              {t('sheet.wildShape.editForms')}
            </button>
          </div>

          {limits.moonAC && (
            <p className="text-[10px] text-sky-300/80">{t('sheet.wildShape.moonAc')}</p>
          )}

          {known.length === 0 && (
            <p className="text-sm text-text-muted py-2">
              {t('sheet.wildShape.noForms', { max: limits.knownForms })}
            </p>
          )}

          {known.map(name => {
            const creature = getCreatureByName(name);
            const isActive = active?.form === name;
            return (
              <div
                key={name}
                className={`rounded-lg border px-2.5 py-2 transition-colors ${
                  isActive ? 'border-gold/50 bg-gold/10' : 'border-border-default bg-bg-primary/40'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <CreatureToken name={name} size={32} />
                  <span className={`text-sm font-medium ${isActive ? 'text-gold' : 'text-text-primary'}`}>
                    {creature?.name ?? name}
                  </span>
                  {creature && (
                    <span className="text-[10px] tabular-nums px-1 py-0.5 rounded border border-border-default text-text-muted">
                      {t('sheet.wildShape.crBadge', { cr: crToString(creature.cr) })}
                    </span>
                  )}
                  {creature && (
                    <span className="text-[10px] text-text-muted">{speedSummary(creature, t)}</span>
                  )}
                  {isActive && expired && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 font-bold">
                      {t('sheet.wildShape.expired')}
                    </span>
                  )}
                  {isActive && (
                    <span
                      className="flex items-center gap-0.5 text-[11px] text-text-secondary px-1 py-0.5 rounded border border-border-default"
                      title={t('sheet.wildShape.adjustTime')}
                    >
                      <button
                        onClick={() => handleAdjustTime(-0.5)}
                        className="p-0.5 rounded text-text-muted hover:text-text-primary"
                      >
                        <Minus size={11} />
                      </button>
                      <Hourglass size={10} className="text-gold/80" />
                      <span className="tabular-nums">
                        {t('sheet.wildShape.remaining', { hours: active!.remainingHours ?? limits.durationHours })}
                      </span>
                      <button
                        onClick={() => handleAdjustTime(0.5)}
                        className="p-0.5 rounded text-text-muted hover:text-text-primary"
                      >
                        <Plus size={11} />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={() => isActive
                      ? onUpdate(deactivateWildShape(character))
                      : handleActivate(name)}
                    disabled={!isActive && (noResource || !creature)}
                    className={`ml-auto px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                      isActive
                        ? 'border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover'
                        : !noResource && creature
                          ? 'border-gold/40 bg-gold/10 text-gold hover:bg-gold/20'
                          : 'border-border-default text-text-muted opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {isActive ? t('sheet.wildShape.deactivate') : t('sheet.wildShape.activate')}
                  </button>
                </div>
                {isActive && (
                  <div className="mt-2 rounded-lg border border-gold/40 bg-gold/5 p-2.5">
                    <CreatureDetails creature={active!.creature} ac={getWildShapeAC(character) ?? getCreatureAC(active!.creature)} />
                  </div>
                )}
              </div>
            );
          })}

          {noResource && !active && known.length > 0 && (
            <p className="text-[10px] text-red-400/90">{t('sheet.wildShape.noResource')}</p>
          )}
        </div>
      )}

      {showPicker && (
        <FormPickerModal
          character={character}
          onClose={() => setShowPicker(false)}
          onSave={names => {
            onUpdate(setKnownForms(character, names));
            setShowPicker(false);
          }}
        />
      )}
    </div>
  );
}
