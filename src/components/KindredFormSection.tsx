// Секция «Звериная форма» (Kindred Form, ликантроп GH:PG24): превращение в
// зверя своего типа ликантропии по правилам Полиморфа. Зверь определяется
// гибридным даром 1-й стадии; хиты заменяются на хиты зверя (свои вернутся
// при выходе), длительность — ручной трекер игрового времени.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character } from '../types';
import {
  isKindredFormAvailable,
  isKindredFormTypeUnknown,
  getKindredBeastName,
  getActiveKindredForm,
  activateKindredForm,
  deactivateKindredForm,
  adjustKindredTime,
  isKindredFormExpired,
  getKindredAC,
} from '../utils/kindredForm';
import { getCreatureByName, getCreatureAC, crToString } from '../data/creatures';
import { CreatureDetails } from './WildShapeSection';
import { CreatureToken } from './ui/CreatureToken';
import { Moon, ChevronDown, Hourglass, Minus, Plus } from 'lucide-react';

export function KindredFormSection({
  character,
  onUpdate,
}: {
  character: Character;
  onUpdate: (c: Character) => void;
}) {
  const { t } = useTranslation('character');
  const [collapsed, setCollapsed] = useState(false);

  const available = isKindredFormAvailable(character);
  const typeUnknown = isKindredFormTypeUnknown(character);
  if (!available && !typeUnknown) return null;

  const beastName = getKindredBeastName(character);
  const creature = beastName ? getCreatureByName(beastName) : undefined;
  const active = getActiveKindredForm(character);
  const expired = isKindredFormExpired(character);

  // Ручной трекер игрового времени: −30 мин на нуле снимает форму
  const handleAdjustTime = (delta: number) => {
    const remaining = active?.remainingHours ?? 1;
    if (delta < 0 && remaining + delta <= 0) {
      onUpdate(deactivateKindredForm(character));
    } else {
      onUpdate(adjustKindredTime(character, delta));
    }
  };

  return (
    <div className="glass-panel p-3">
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 w-full text-left">
        <Moon className="text-gold" size={20} />
        <h2 className="text-lg font-medieval text-gold flex-1">
          {t('sheet.kindredForm.title')}
          {active && (
            <span className="text-gold/70 text-sm ml-1.5">({active.creature.name})</span>
          )}
        </h2>
        <ChevronDown size={16} className={`text-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      {!collapsed && (
        <div className="mt-2 space-y-1.5">
          {typeUnknown && (
            <p className="text-sm text-amber-400/90 py-1">{t('sheet.kindredForm.typeUnknown')}</p>
          )}

          {creature && (
            <div
              className={`rounded-lg border px-2.5 py-2 transition-colors ${
                active ? 'border-gold/50 bg-gold/10' : 'border-border-default bg-bg-primary/40'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <CreatureToken name={creature.name} size={32} />
                <span className={`text-sm font-medium ${active ? 'text-gold' : 'text-text-primary'}`}>
                  {creature.name}
                </span>
                <span className="text-[10px] tabular-nums px-1 py-0.5 rounded border border-border-default text-text-muted">
                  {t('sheet.wildShape.crBadge', { cr: crToString(creature.cr) })}
                </span>
                {!active && (
                  <span className="text-[10px] text-text-muted">
                    {t('sheet.kindredForm.beastHp', { hp: creature.hp?.average ?? 1 })}
                  </span>
                )}
                {active && expired && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 font-bold">
                    {t('sheet.wildShape.expired')}
                  </span>
                )}
                {active && (
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
                      {t('sheet.wildShape.remaining', { hours: active.remainingHours ?? 1 })}
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
                  onClick={() => onUpdate(active
                    ? deactivateKindredForm(character)
                    : activateKindredForm(character))}
                  className={`ml-auto px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                    active
                      ? 'border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover'
                      : 'border-gold/40 bg-gold/10 text-gold hover:bg-gold/20'
                  }`}
                >
                  {active ? t('sheet.wildShape.deactivate') : t('sheet.wildShape.activate')}
                </button>
              </div>

              <p className="text-[10px] text-text-muted mt-1">
                {active ? t('sheet.kindredForm.activeHpNote') : t('sheet.kindredForm.hpNote')}
              </p>

              {active && (
                <div className="mt-2 rounded-lg border border-gold/40 bg-gold/5 p-2.5">
                  <CreatureDetails
                    creature={active.creature}
                    ac={getKindredAC(character) ?? getCreatureAC(active.creature)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
