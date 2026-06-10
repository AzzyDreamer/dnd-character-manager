import React, { useState, useEffect } from 'react';
import type { Character, CharacterSpell, CustomAttack } from '../types';
import { getAbilityModifier, getAbilityName } from '../utils/dnd';
import { getEffectiveAbilityScores } from '../utils/classEffects';
import { getEquippedWeaponAttacks, getEquippedMasteryActions, getUnarmedStrike, getAttacksPerAction, type WeaponAttack } from '../utils/weaponAttacks';
import { getEquippedItemBonuses } from '../utils/classEffects';
import { getClassResources, getClassPassiveStats, getSubclassResources, getSubclassPassiveStats, getLevelTableRow, type ClassResource, type ClassPassiveStat } from '../utils/classResources';
import { getAutoSpellsForLevel } from '../utils/autoSpells';
import { SpellIconBadge, SpellTooltip } from './ui';
import { ChevronDown, ChevronRight, Swords, Plus, Trash2, Sparkles, Zap, Shield, BookOpen, Wand2, Star } from 'lucide-react';
import { SpellPreparationModal } from './SpellPreparationModal';
import { ClickableDamage, ClickableAttackBonus } from './DiceRollProvider';
import { SpellContextMenu } from './SpellContextMenu';
import { SpellCastModal } from './SpellCastModal';
import { SpellDetailModal } from './SpellDetailModal';
import type { SpellData } from '../data/spells';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getSubclassDisplayName } from '../data/classes';
import { resolveDisplayRace } from '../data/species';
import { asset } from '../utils/asset';

// Типы для данных заклинаний (без импорта модуля)
interface SpellDataLocal {
  name: string;
  school: string;
  time?: { number: number; unit: string }[];
  range?: { type: string; distance?: { type: string; amount?: number } };
  components?: { v?: boolean; s?: boolean; m?: string | boolean | any };
  duration?: { type: string; duration?: { type: string; amount: number }; concentration?: boolean }[];
  entries: any[];
  entriesHigherLevel?: any[];
}

interface LoadedModules {
  getSpellByName: (name: string) => SpellDataLocal | undefined;
  getSpellImageUrl: (name: string) => string;
  SCHOOL_NAMES: Record<string, string>;
  EntryRenderer: React.FC<any>;
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

function getTimeUnits(t: TFunction): Record<string, string> {
  return { action: t('meta.timeUnits.action'), bonus: t('meta.timeUnits.bonus'), reaction: t('meta.timeUnits.reaction'), minute: t('meta.timeUnits.minute') };
}

function getSpellMeta(spellData: SpellDataLocal | undefined, t: TFunction) {
  if (!spellData) return {};
  const timeUnits = getTimeUnits(t);
  const castingTime = spellData.time
    ?.map(ti => `${ti.number} ${timeUnits[ti.unit] || ti.unit}`)
    .join(', ');
  const range = spellData.range?.distance?.amount
    ? t('meta.rangeFeet', { amount: spellData.range.distance.amount })
    : spellData.range?.type === 'touch' ? t('meta.rangeTouch')
      : spellData.range?.type === 'self' ? t('meta.rangeSelf')
        : spellData.range?.type || '';
  const components = spellData.components
    ? [
        spellData.components.v ? t('meta.componentV') : '',
        spellData.components.s ? t('meta.componentS') : '',
        spellData.components.m ? t('meta.componentM') : '',
      ].filter(Boolean).join(', ')
    : '';
  const duration = spellData.duration
    ?.map(d => {
      if (d.type === 'instant') return t('meta.durationInstant');
      if (d.concentration) return t('meta.durationConcentration', { amount: d.duration?.amount || '', type: d.duration?.type || '' });
      return d.type;
    })
    .join(', ');
  return { castingTime, range, components, duration };
}

function cleanTagRefs(text: string): string {
  return text.replace(/\{@\w+\s+([^|}]+)(?:\|[^|}]*)*(?:\|([^}]*))?\}/g, (_, first, last) => last || first);
}

function getFirstEntryText(entries: any[]): string {
  for (const e of entries) {
    if (typeof e === 'string') return cleanTagRefs(e);
    if (e?.entries) return getFirstEntryText(e.entries);
  }
  return '';
}


// ─── Spell Slot Tracker (BG3 style) ─────────────────────────────────

const SpellSlotTracker: React.FC<{
  character: Character;
  onUpdate: (character: Character) => void;
}> = ({ character, onUpdate }) => {
  const { t } = useTranslation('spells');
  const slots = character.spellcasting?.spellSlots;
  if (!slots) return null;

  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  const slotEntries = levels
    .map(lvl => {
      const key = `level${lvl}` as keyof typeof slots;
      const slot = slots[key];
      return { level: lvl, total: slot.total, used: slot.used };
    })
    .filter(s => s.total > 0);

  if (slotEntries.length === 0) return null;

  const toggleSlot = (level: number, slotIndex: number) => {
    const key = `level${level}` as keyof typeof slots;
    const slot = slots[key];
    const available = slot.total - slot.used;
    // Click on available slot (slotIndex < available) → use it
    // Click on used slot (slotIndex >= available) → restore it
    const newUsed = slotIndex < available ? slot.used + 1 : slot.used - 1;
    onUpdate({
      ...character,
      spellcasting: {
        ...character.spellcasting!,
        spellSlots: {
          ...slots,
          [key]: { total: slot.total, used: Math.max(0, Math.min(newUsed, slot.total)) },
        },
      },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="glass-panel p-3">
      <h3 className="text-sm font-medieval text-gold mb-2 flex items-center gap-2">
        <Sparkles size={14} />
        {t('spellSlots.title')}
      </h3>
      <div className="flex flex-wrap gap-4">
        {slotEntries.map(({ level, total, used }) => {
          const available = total - used;
          return (
            <div key={level} className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted font-bold w-6 text-right">{ROMAN_NUMERALS[level - 1]}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: total }, (_, i) => {
                  const isAvailable = i < available;
                  return (
                    <button
                      key={i}
                      onClick={() => toggleSlot(level, i)}
                      className={`w-5 h-5 rounded-sm border transition-all ${
                        isAvailable
                          ? 'bg-blue-500 border-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.5)] hover:bg-blue-400'
                          : 'bg-bg-tertiary border-border-default hover:bg-bg-secondary'
                      }`}
                      title={isAvailable ? t('spellSlots.useSlot') : t('spellSlots.restoreSlot')}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Resource Token Tracker ──────────────────────────────────────────

const ResourceTokenTracker: React.FC<{
  resources: ClassResource[];
  character: Character;
  onUpdate: (character: Character) => void;
}> = ({ resources, character, onUpdate }) => {
  const { t } = useTranslation('spells');
  if (resources.length === 0) return null;

  const trackers = character.resourceTrackers ?? {};

  const toggleResource = (key: string, index: number, max: number) => {
    const current = trackers[key]?.current ?? max;
    // Click on available (index < current) → use it; click on used → restore
    const newCurrent = index < current ? current - 1 : current + 1;
    onUpdate({
      ...character,
      resourceTrackers: {
        ...trackers,
        [key]: { current: Math.max(0, Math.min(newCurrent, max)), max },
      },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="glass-panel p-3">
      <h3 className="text-sm font-medieval text-gold mb-2 flex items-center gap-2">
        <Zap size={14} />
        {t('resources.title')}
      </h3>
      <div className="space-y-2">
        {resources.map(res => {
          const current = trackers[res.key]?.current ?? res.max;
          return (
            <div key={res.key} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary min-w-[140px] flex items-center gap-1.5">
                {res.icon && <img src={res.icon} alt="" className="w-5 h-5 object-contain" />}
                {res.label}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: res.max }, (_, i) => {
                  const isAvailable = i < current;
                  return (
                    <button
                      key={i}
                      onClick={() => toggleResource(res.key, i, res.max)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        isAvailable
                          ? 'bg-gold/80 border-gold shadow-[0_0_6px_rgba(212,175,55,0.4)] hover:bg-gold'
                          : 'bg-bg-tertiary border-border-default hover:bg-bg-secondary'
                      }`}
                      title={isAvailable ? t('resources.use') : t('resources.restore')}
                    />
                  );
                })}
              </div>
              <span className="text-xs text-text-muted">{current}/{res.max}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Weapon Attacks Section ──────────────────────────────────────────

const WeaponAttacksSection: React.FC<{
  character: Character;
  onUpdate: (character: Character) => void;
}> = ({ character, onUpdate }) => {
  const { t } = useTranslation('spells');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAttack, setNewAttack] = useState({ name: '', attackBonus: 0, damage: '', damageType: '', notes: '' });
  const [expandedMastery, setExpandedMastery] = useState<string | null>(null);
  const [powerAttack, setPowerAttack] = useState(false);

  const equippedAttacks = getEquippedWeaponAttacks(character);
  const unarmedStrike = getUnarmedStrike(character);
  const masteryActions = getEquippedMasteryActions(character);
  const customAttacks = character.customAttacks ?? [];
  const attacksPerAction = getAttacksPerAction(character);

  // Power-attack toggle (−5 to hit / +10 damage). Sharpshooter applies to ranged
  // weapons, Great Weapon Master to Heavy melee weapons.
  const hasFeat = (nameEn: string) => (character.feats ?? []).some(f => (f.nameEn ?? f.name) === nameEn);
  const hasSharpshooter = hasFeat('Sharpshooter');
  const hasGreatWeaponMaster = hasFeat('Great Weapon Master');
  const canPowerAttack = hasSharpshooter || hasGreatWeaponMaster;
  const isPowerAttackEligible = (atk: WeaponAttack) =>
    (hasSharpshooter && atk.isRanged) || (hasGreatWeaponMaster && atk.heavy && !atk.isRanged);

  /** Add a flat delta to a damage string's trailing modifier ("1d8 + 3" → "1d8 + 13"). */
  const adjustDamageMod = (damage: string, delta: number): string => {
    const m = damage.match(/^(.*?)(?:\s*([+-])\s*(\d+))?$/);
    if (!m) return damage;
    const base = m[1].trim();
    const sign = m[2];
    const cur = sign ? (sign === '-' ? -parseInt(m[3]) : parseInt(m[3])) : 0;
    const next = cur + delta;
    if (next === 0) return base;
    return `${base} ${next > 0 ? '+' : '−'} ${Math.abs(next)}`;
  };

  /** Apply the active power-attack modifier to an attack for display. */
  const applyPower = (atk: WeaponAttack): WeaponAttack => {
    if (!powerAttack || !isPowerAttackEligible(atk)) return atk;
    return { ...atk, attackBonus: atk.attackBonus - 5, damage: adjustDamageMod(atk.damage, 10) };
  };

  const addCustomAttack = () => {
    if (!newAttack.name.trim()) return;
    const attack: CustomAttack = {
      id: `custom-${Date.now()}`,
      name: newAttack.name.trim(),
      attackBonus: newAttack.attackBonus,
      damage: newAttack.damage.trim(),
      damageType: newAttack.damageType.trim(),
      notes: newAttack.notes.trim() || undefined,
    };
    onUpdate({
      ...character,
      customAttacks: [...customAttacks, attack],
      updatedAt: new Date().toISOString(),
    });
    setNewAttack({ name: '', attackBonus: 0, damage: '', damageType: '', notes: '' });
    setShowAddForm(false);
  };

  const removeCustomAttack = (id: string) => {
    onUpdate({
      ...character,
      customAttacks: customAttacks.filter(a => a.id !== id),
      updatedAt: new Date().toISOString(),
    });
  };

  // Always show attacks section (unarmed strike is always available)

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medieval text-gold flex items-center gap-2">
          <Swords size={14} />
          {t('attacks.title')}
          {attacksPerAction > 1 && (
            <span
              className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/30"
              title={t('attacks.extraAttackTooltip')}
            >
              {t('attacks.attacksPerAction', { count: attacksPerAction })}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3">
          {canPowerAttack && (
            <button
              onClick={() => setPowerAttack(p => !p)}
              title={t('attacks.powerAttackTooltip')}
              className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
                powerAttack
                  ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                  : 'border-border-default text-text-muted hover:text-text-secondary'
              }`}
            >
              <Zap size={11} /> {t('attacks.powerAttack')}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs text-text-muted hover:text-gold transition-colors flex items-center gap-1"
          >
            <Plus size={12} /> {t('attacks.add')}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {/* Equipped weapon attacks */}
        {equippedAttacks.map((raw, i) => {
          const atk = applyPower(raw);
          const powered = powerAttack && isPowerAttackEligible(raw);
          return (
          <div key={`eq-${i}`} className="flex items-center gap-2.5 text-sm py-1.5 px-2 rounded bg-bg-secondary/50">
            <img
              src={atk.image}
              alt={atk.name}
              className="w-8 h-8 rounded object-contain flex-shrink-0"
              style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-text-primary text-sm flex items-center gap-1.5">
                {atk.name}
                {raw.greatWeaponFighting && (
                  <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border-default" title={t('attacks.gwfTooltip')}>
                    {t('attacks.gwf')}
                  </span>
                )}
                {powered && (
                  <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    {t('attacks.powerAttack')}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-text-muted">{
                        atk.slot === 'offhand' ? t('attacks.offhand') :
                        atk.slot === 'rangedMainhand' ? t('attacks.rangedMainhand') :
                        atk.slot === 'rangedOffhand' ? t('attacks.rangedOffhand') :
                        t('attacks.mainhand')
                      }</div>
            </div>
            <ClickableAttackBonus bonus={atk.attackBonus} className="text-green-400 font-bold min-w-[40px] text-right" />
            <ClickableDamage damage={atk.damage} className="text-text-secondary min-w-[90px] text-right" />
            <span className="text-xs text-text-muted min-w-[60px]">{atk.damageType}</span>
          </div>
          );
        })}

        {/* Unarmed Strike (always available) */}
        <div className="flex items-center gap-2.5 text-sm py-1.5 px-2 rounded bg-bg-secondary/50">
          <img
            src={unarmedStrike.image}
            alt={unarmedStrike.name}
            className="w-8 h-8 rounded object-contain flex-shrink-0"
            style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-text-primary text-sm">{unarmedStrike.name}</div>
            <div className="text-[10px] text-text-muted">{t('attacks.unarmed')}</div>
          </div>
          <ClickableAttackBonus bonus={unarmedStrike.attackBonus} className="text-green-400 font-bold min-w-[40px] text-right" />
          <ClickableDamage damage={unarmedStrike.damage} className="text-text-secondary min-w-[90px] text-right" />
          <span className="text-xs text-text-muted min-w-[60px]">{unarmedStrike.damageType}</span>
        </div>

        {/* Custom attacks */}
        {customAttacks.map(atk => (
          <div key={atk.id} className="flex items-center gap-2.5 text-sm py-1.5 px-2 rounded bg-bg-secondary/50">
            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-bg-tertiary border border-border-default">
              <Swords size={14} className="text-text-muted" />
            </div>
            <span className="font-medium text-text-primary flex-1">{atk.name}</span>
            <ClickableAttackBonus bonus={atk.attackBonus} className="text-green-400 font-bold min-w-[40px] text-right" />
            <ClickableDamage damage={atk.damage} className="text-text-secondary min-w-[90px] text-right" />
            <span className="text-xs text-text-muted min-w-[60px]">{atk.damageType}</span>
            <button
              onClick={() => removeCustomAttack(atk.id)}
              className="text-red-400/60 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Mastery Actions */}
      {masteryActions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-default">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Zap size={12} className="text-amber-400" />
            {t('attacks.weaponMastery')}
          </h4>
          <div className="space-y-1.5">
            {masteryActions.map(action => {
              const isExpanded = expandedMastery === action.id;
              return (
                <div key={action.id}>
                  <button
                    onClick={() => setExpandedMastery(isExpanded ? null : action.id)}
                    className="w-full text-left flex items-center gap-2.5 py-1.5 px-2 rounded bg-bg-secondary/50 hover:bg-bg-secondary transition-colors"
                  >
                    <img
                      src={action.image}
                      alt={action.name}
                      className="w-8 h-8 rounded object-contain flex-shrink-0"
                      style={{ border: '1px solid rgba(251, 191, 36, 0.3)', background: 'rgba(251, 191, 36, 0.05)' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-amber-300">{action.name}</div>
                      <div className="text-[10px] text-text-muted">{action.weaponName}</div>
                    </div>
                    {isExpanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                  </button>
                  {isExpanded && (
                    <div className="mt-1 ml-12 mr-2 mb-1 p-2 rounded bg-bg-primary/50 border border-border-default">
                      <p className="text-xs text-text-secondary leading-relaxed">{action.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add custom attack form */}
      {showAddForm && (
        <div className="mt-2 p-2 rounded bg-bg-secondary/50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder={t('attacks.namePlaceholder')}
              value={newAttack.name}
              onChange={e => setNewAttack(p => ({ ...p, name: e.target.value }))}
              className="text-xs bg-bg-primary border border-border-default rounded px-2 py-1 text-text-primary"
            />
            <input
              type="number"
              placeholder={t('attacks.attackBonusPlaceholder')}
              value={newAttack.attackBonus}
              onChange={e => setNewAttack(p => ({ ...p, attackBonus: parseInt(e.target.value) || 0 }))}
              className="text-xs bg-bg-primary border border-border-default rounded px-2 py-1 text-text-primary"
            />
            <input
              type="text"
              placeholder={t('attacks.damagePlaceholder')}
              value={newAttack.damage}
              onChange={e => setNewAttack(p => ({ ...p, damage: e.target.value }))}
              className="text-xs bg-bg-primary border border-border-default rounded px-2 py-1 text-text-primary"
            />
            <input
              type="text"
              placeholder={t('attacks.damageTypePlaceholder')}
              value={newAttack.damageType}
              onChange={e => setNewAttack(p => ({ ...p, damageType: e.target.value }))}
              className="text-xs bg-bg-primary border border-border-default rounded px-2 py-1 text-text-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addCustomAttack}
              className="text-xs px-3 py-1 bg-gold/20 text-gold border border-gold/30 rounded hover:bg-gold/30 transition-colors"
            >
              {t('attacks.add')}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-xs px-3 py-1 text-text-muted hover:text-text-primary transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Actions & Features Section ──────────────────────────────────────

interface LoadedFeature {
  id: string;
  name: string;
  source: string;
  rawEntries: any[];
  image?: string;
}

// Breath Weapon image mapping: damageType → image filename
const BREATH_WEAPON_IMAGES: Record<string, string> = {
  acid: asset('/images/species-actions/Acid_Breath.webp'),
  lightning: asset('/images/species-actions/Lightning_Breath.webp'),
  fire: asset('/images/species-actions/Fire_Breath.webp'),
  poison: asset('/images/species-actions/Poison_Breath.webp'),
  cold: asset('/images/species-actions/Frost_Breath.webp'),
};

// Species action images: entry name (lowercase) → image path
const SPECIES_ACTION_IMAGES: Record<string, string> = {
  // Dragonborn
  'draconic flight': asset('/images/spells/Grant_Flight.webp'),
  // Aasimar
  'healing hands': asset('/images/spells/Cure_Wounds.webp'),
  'celestial revelation': asset('/images/spells/Daylight.webp'),
  'light bearer': asset('/images/spells/Light.webp'),
  // Teleportation
  'fey step': asset('/images/spells/Misty_Step.webp'),
  'starlight step': asset('/images/spells/Misty_Step.webp'),
  'blessing of the raven queen': asset('/images/spells/Misty_Step.webp'),
  // Flight
  'flight': asset('/images/spells/Grant_Flight.webp'),
  'glide': asset('/images/spells/Grant_Flight.webp'),
  'gem flight': asset('/images/spells/Grant_Flight.webp'),
  // Natural weapons
  'talons': asset('/images/misc/Generic_Physical_Icon.webp'),
  'claws': asset('/images/misc/Generic_Physical_Icon.webp'),
  'hooves': asset('/images/misc/Generic_Physical_Icon.webp'),
  'horns': asset('/images/misc/Generic_Physical_Icon.webp'),
  'bite': asset('/images/misc/Generic_Physical_Icon.webp'),
  'ram': asset('/images/misc/Generic_Physical_Icon.webp'),
  'vampiric bite': asset('/images/misc/Generic_Blood.webp'),
  // Combat abilities
  'charge': asset('/images/misc/Generic_Physical_Icon.webp'),
  'goring rush': asset('/images/misc/Generic_Physical_Icon.webp'),
  'hammering horns': asset('/images/misc/Generic_Physical_Icon.webp'),
  'daunting roar': asset('/images/misc/Generic_Threat.webp'),
  'hungry jaws': asset('/images/misc/Generic_Physical_Icon.webp'),
  'shell defense': asset('/images/spells/Shield.webp'),
  'surprise attack': asset('/images/misc/Generic_Damage.webp'),
  'vengeful assault': asset('/images/misc/Generic_Damage.webp'),
  'astral spark': asset('/images/misc/Generic_Force.webp'),
  'fury of the small': asset('/images/misc/Generic_Damage.webp'),
  'savage attacks': asset('/images/misc/Generic_Damage.webp'),
  'draconic cry': asset('/images/misc/Generic_Threat.webp'),
  'adrenaline rush': asset('/images/misc/Generic_Buff.webp'),
  // Magic/Spellcasting
  'fairy magic': asset('/images/misc/Generic_Magical.webp'),
  'firbolg magic': asset('/images/misc/Generic_Magical.webp'),
  'wind caller': asset('/images/misc/Generic_Magical.webp'),
  'fiendish legacy': asset('/images/misc/Generic_Magical.webp'),
  'gnomish lineage': asset('/images/misc/Generic_Magical.webp'),
  'elven lineage': asset('/images/misc/Generic_Magical.webp'),
  'faerie lineage': asset('/images/misc/Generic_Magical.webp'),
  'duergar magic': asset('/images/misc/Generic_Magical.webp'),
  'githyanki psionics': asset('/images/misc/Generic_Psychic.webp'),
  'githzerai psionics': asset('/images/misc/Generic_Psychic.webp'),
  'serpentine spellcasting': asset('/images/misc/Generic_Poison.webp'),
  'control air and water': asset('/images/misc/Generic_Nature.webp'),
  'reach to the blaze': asset('/images/misc/Generic_Fire.webp'),
  'mingle with the wind': asset('/images/misc/Generic_Lightning.webp'),
  'call to the wave': asset('/images/misc/Generic_Cold.webp'),
  'merge with stone': asset('/images/misc/Generic_Nature.webp'),
  'hex magic': asset('/images/misc/Generic_Necrotic.webp'),
  'blessing of the moon weaver': asset('/images/misc/Generic_Magical.webp'),
  'kobold legacy': asset('/images/misc/Generic_Magical.webp'),
  // Stealth/Utility
  'hidden step': asset('/images/misc/Generic_Invisibility.webp'),
  'nimble escape': asset('/images/misc/Generic_Invisibility.webp'),
  'sneaky': asset('/images/misc/Generic_Invisibility.webp'),
  'chameleon carapace': asset('/images/misc/Generic_Invisibility.webp'),
  'svirfneblin camouflage': asset('/images/misc/Generic_Invisibility.webp'),
  'feline agility': asset('/images/misc/Generic_Buff.webp'),
  'rabbit hop': asset('/images/misc/Generic_Buff.webp'),
  'lucky footwork': asset('/images/misc/Generic_Buff.webp'),
  'hadozee dodge': asset('/images/misc/Generic_Buff.webp'),
  // Shifting/Transformation
  'shifting': asset('/images/misc/Generic_Wild_Animal.webp'),
  'shape-shifter': asset('/images/misc/Generic_Ethereal.webp'),
  'shape self': asset('/images/misc/Generic_Ethereal.webp'),
  'giant ancestry': asset('/images/misc/Generic_Buff.webp'),
  'large form': asset('/images/misc/Generic_Buff.webp'),
  // Telepathy/Mind
  'mind link': asset('/images/misc/Generic_Psychic.webp'),
  'eerie token': asset('/images/misc/Generic_Psychic.webp'),
  'thri-kreen telepathy': asset('/images/misc/Generic_Psychic.webp'),
  'psionic mind': asset('/images/misc/Generic_Psychic.webp'),
  'limited telepathy': asset('/images/misc/Generic_Psychic.webp'),
  'taunt': asset('/images/misc/Generic_Psychic.webp'),
  // Defensive
  'relentless endurance': asset('/images/misc/Generic_Healing.webp'),
  'black blood healing': asset('/images/misc/Generic_Healing.webp'),
  'knowledge from a past life': asset('/images/misc/Generic_Info.webp'),
  'built for success': asset('/images/misc/Generic_Buff.webp'),
  'fey gift': asset('/images/misc/Generic_Buff.webp'),
  'fortune from the many': asset('/images/misc/Generic_Buff.webp'),
  'animal enhancement': asset('/images/misc/Generic_Wild_Animal.webp'),
  'child of the wood': asset('/images/misc/Generic_Nature.webp'),
};

// Passive/informational entries to exclude from actions display
const PASSIVE_ENTRY_NAMES = new Set([
  'darkvision', 'superior darkvision', 'size', 'age', 'alignment', 'speed',
  'languages', 'language', 'creature type',
  // Resistances/immunities (already shown on character sheet)
  'damage resistance', 'draconic resistance', 'celestial resistance',
  'fire resistance', 'lightning resistance', 'acid resistance',
  'necrotic resistance', 'poison resilience', 'magic resistance',
  'gnomish magic resistance', 'psychic resilience', 'mental discipline',
  'dwarven resilience', 'construct resilience', 'natural resilience',
  'loxodon serenity', 'vedalken dispassion', 'guardian of the depths',
  // Passive features (proficiencies, senses, knowledge)
  'keen senses', 'fey ancestry', 'trance', 'astral trance',
  'stonecunning', 'dwarven toughness', 'powerful build', 'equine build',
  'hippo build', 'natural armor', 'hold breath', 'amphibious',
  'partially amphibious', 'long-limbed', 'labyrinthine recall',
  'brave', 'halfling nimbleness', 'luck', 'naturally stealthy',
  'resourceful', 'skillful', 'versatile', 'specialized design',
  'tireless precision', 'silent feathers', 'hunter\'s instincts',
  'nature\'s intuition', "cat's talent", 'reveler', 'persuasive',
  'expert duplication', 'kenku recall', 'mimicry', 'kender curiosity',
  'fearless', 'dual mind', 'severed from dreams',
  'emissary of the sea', 'friend of the sea', 'child of the sea',
  'speech of beast and leaf', 'trunk', 'keen smell',
  'secondary arms', 'sleepless', 'dexterous feet',
  'sentry\'s rest', 'healing machine', 'mechanical nature', 'armored casing',
  'integrated protection', 'tireless',
  'ancestral legacy', 'deathless nature', 'lethargy resilience',
  'skill versatility', 'trace of undeath', 'spider climb',
  'amorphous', 'incisive sense', 'telepathic insight',
  'astral knowledge', 'hare-trigger', 'leporine senses',
  'natural affinity', 'bestial instincts', 'menacing',
  'astral fire', 'changeling instincts', 'otherworldly presence',
  'gnomish cunning', 'light bearer', 'forceful presence',
  'cat\'s claws', 'firearms mastery', 'draconic ancestry',
  'timberwalk', 'unending breath', 'earth walk',
  // Lineage descriptions that just list spells (handled by auto-spells)
  'otherworldly presence',
]);

// Level-gated species actions
const LEVEL_GATED_ACTIONS: Record<string, number> = {
  'draconic flight': 5,
  'gem flight': 5,
  'celestial revelation': 3,
  'animal enhancement': 1, // base at 1, enhanced at 5 — show always
  'control air and water': 1, // fog cloud at 1, gust of wind at 3, water walk at 5
};

const ActionsSection: React.FC<{
  character: Character;
  passiveStats: ClassPassiveStat[];
  EntryRenderer?: React.FC<any>;
}> = ({ character, passiveStats, EntryRenderer: EntryRendererProp }) => {
  const { t } = useTranslation('spells');
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [loadedFeatures, setLoadedFeatures] = useState<LoadedFeature[]>([]);
  const [speciesActions, setSpeciesActions] = useState<LoadedFeature[]>([]);
  const [LocalEntryRenderer, setLocalEntryRenderer] = useState<React.FC<any> | null>(null);

  // Load EntryRenderer lazily if not passed as prop
  useEffect(() => {
    if (EntryRendererProp) return;
    let cancelled = false;
    import('../utils/entryRenderer').then(mod => {
      if (!cancelled) setLocalEntryRenderer(() => mod.EntryRenderer);
    });
    return () => { cancelled = true; };
  }, [EntryRendererProp]);

  const Renderer = EntryRendererProp || LocalEntryRenderer;

  const features = character.features ?? [];

  // Build rawEntries from description + details
  const buildRawEntries = (f: any): any[] => {
    const entries: any[] = [];
    if (f.description) entries.push(f.description);
    if (f.details && typeof f.details === 'object') {
      for (const val of Object.values(f.details)) {
        if (typeof val === 'string') entries.push(val);
      }
    }
    return entries;
  };

  // Load full feature data from class/subclass JSON
  useEffect(() => {
    if (features.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const classMod = await import('../data/classes/classJsonLoader');
        await classMod.init();
        if (cancelled) return;

        const classData = classMod.getClassDataByName(character.class);
        const featureMap = new Map<string, any>();
        if (classData?.classFeatures) {
          for (const f of classData.classFeatures) {
            if (f.level <= character.level) {
              featureMap.set(f.name.toLowerCase(), f);
            }
          }
        }

        // Also load subclass features
        if (character.subclass) {
          try {
            const subMod = await import('../data/classes/subclassJsonLoader');
            await subMod.init();
            if (cancelled) return;
            const { getClassById, CLASS_REGISTRY, findSubclass } = await import('../data/classes');
            const classDef = getClassById(character.classId || '') ?? CLASS_REGISTRY.find(c => c.name === character.class);
            const subDef = classDef && character.subclass ? findSubclass(classDef, character.subclass) : undefined;
            if (subDef) {
              const subData = subMod.getSubclassById(classDef!.id, subDef.id);
              if (subData?.features) {
                for (const f of subData.features) {
                  if (f.level <= character.level) {
                    featureMap.set(f.name.toLowerCase(), f);
                  }
                }
              }
            }
          } catch (e) { console.warn('Failed to load subclass for ActionsSection:', e); }
        }

        if (cancelled) return;
        const loaded: LoadedFeature[] = features.map(feat => {
          const jsonFeat = featureMap.get(feat.name.toLowerCase());
          return {
            id: feat.id,
            name: feat.name,
            source: feat.source,
            rawEntries: jsonFeat ? buildRawEntries(jsonFeat) : (feat.description ? [feat.description] : []),
          };
        });
        setLoadedFeatures(loaded);
      } catch (e) {
        console.warn('Failed to load features for ActionsSection:', e);
        // Fallback to simple descriptions
        setLoadedFeatures(features.map(feat => ({
          id: feat.id,
          name: feat.name,
          source: feat.source,
          rawEntries: feat.description ? [feat.description] : [],
        })));
      }
    })();
    return () => { cancelled = true; };
  }, [character.class, character.classId, character.subclass, character.level, features.length]);

  // Load species actions (Breath Weapon, Draconic Flight, etc.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const speciesMod = await import('../data/species');
        await speciesMod.init();
        if (cancelled) return;

        // Try variant first, then base species
        const speciesName = character.raceVariant || character.race;
        const speciesData = speciesMod.getSpeciesByName(speciesName, character.raceSource);
        if (!speciesData?.entries) return;

        const resistType = speciesData.resist?.[0] as string | undefined;

        const actions: LoadedFeature[] = [];
        for (const entry of speciesData.entries) {
          if (entry.type !== 'entries' || !entry.name) continue;
          const nameLower = entry.name.toLowerCase();

          // Skip passive/informational entries
          if (PASSIVE_ENTRY_NAMES.has(nameLower)) continue;

          // Check level requirements
          const reqLevel = LEVEL_GATED_ACTIONS[nameLower];
          if (reqLevel !== undefined && character.level < reqLevel) continue;

          // Determine image
          let image: string | undefined;
          if (nameLower === 'breath weapon' && resistType) {
            image = BREATH_WEAPON_IMAGES[resistType];
          } else {
            image = SPECIES_ACTION_IMAGES[nameLower];
          }

          actions.push({
            id: `species-${nameLower.replace(/\s+/g, '-')}`,
            name: entry.name,
            source: speciesData._parentSpecies ?? speciesData.name,
            rawEntries: entry.entries ?? [],
            image,
          });
        }

        if (!cancelled) setSpeciesActions(actions);
      } catch (e) {
        console.warn('Failed to load species actions:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [character.race, character.raceVariant, character.raceSource, character.level]);

  const displayFeatures: LoadedFeature[] = loadedFeatures.length > 0 ? loadedFeatures : features.map(f => ({
    id: f.id,
    name: f.name,
    source: f.source,
    rawEntries: f.description ? [f.description] : [],
  }));

  const allFeatures = [...displayFeatures, ...speciesActions];

  if (allFeatures.length === 0 && passiveStats.length === 0) return null;

  return (
    <div className="glass-panel p-3">
      <h3 className="text-sm font-medieval text-gold mb-2 flex items-center gap-2">
        <Shield size={14} />
        {t('actions.title')}
      </h3>

      {/* Passive stat badges */}
      {passiveStats.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {passiveStats.map(stat => (
            <span
              key={stat.key}
              className="px-2 py-0.5 rounded text-xs bg-purple-900/40 text-purple-300 border border-purple-800/30 flex items-center gap-1.5"
            >
              {stat.icon && <img src={stat.icon} alt="" className="w-4 h-4 object-contain" />}
              {stat.label}: {stat.value}
            </span>
          ))}
        </div>
      )}

      {/* Features list */}
      <div className="space-y-1">
        {allFeatures.map(feat => (
          <div key={feat.id} className="rounded bg-bg-secondary/50">
            <button
              onClick={() => setExpandedFeature(expandedFeature === feat.id ? null : feat.id)}
              className="flex items-center gap-2 w-full text-left py-1.5 px-2 text-sm hover:bg-bg-secondary/80 transition-colors rounded"
            >
              {feat.image && (
                <img src={feat.image} alt="" className="w-6 h-6 object-contain shrink-0 rounded" />
              )}
              {expandedFeature === feat.id
                ? <ChevronDown size={12} className="text-text-muted shrink-0" />
                : <ChevronRight size={12} className="text-text-muted shrink-0" />}
              <span className="text-text-primary font-medium">{feat.name}</span>
              <span className="text-xs text-text-muted ml-auto">{feat.source}</span>
            </button>
            {expandedFeature === feat.id && (
              <div className="px-6 pb-2 text-xs text-text-secondary leading-relaxed">
                {feat.image && (
                  <div className="flex justify-center mb-2">
                    <img src={feat.image} alt={feat.name} className="w-24 h-24 object-contain rounded-lg" />
                  </div>
                )}
                {feat.rawEntries.length > 0 && (
                  Renderer
                    ? <Renderer entries={feat.rawEntries} context={feat.name} />
                    : feat.rawEntries.map((e, i) => (
                        <p key={i} className={i > 0 ? 'mt-1' : ''}>{typeof e === 'string' ? cleanTagRefs(e) : ''}</p>
                      ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────

interface ActionsSpellsTabProps {
  character: Character;
  onUpdate: (character: Character) => void;
}

export const ActionsSpellsTab: React.FC<ActionsSpellsTabProps> = ({ character, onUpdate }) => {
  const { t } = useTranslation('spells');
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showPrepModal, setShowPrepModal] = useState(false);
  const [autoSpells, setAutoSpells] = useState<{ spellId: string; name: string; level: number; prepared: boolean; alwaysPrepared: boolean; source?: string }[]>([]);
  const [classResources, setClassResources] = useState<ClassResource[]>([]);
  const [passiveStats, setPassiveStats] = useState<ClassPassiveStat[]>([]);
  const [spellsLoading, setSpellsLoading] = useState(!!character.spellcasting);

  // Context menu & cast modal state
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number;
    spell: CharacterSpell;
    spellData: SpellData | null;
    isClassSpell: boolean;
  } | null>(null);
  const [castingSpell, setCastingSpell] = useState<{
    spell: CharacterSpell;
    spellData: SpellData;
  } | null>(null);
  // Full-description popup (opened from the spell context menu "Info" action)
  const [infoSpell, setInfoSpell] = useState<{ name: string; level: number } | null>(null);

  // Load class resources from JSON
  useEffect(() => {
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
          const baseResources = getClassResources(row);
          const basePassive = getClassPassiveStats(row);
          // Add subclass resources & passive stats (e.g. Battle Master superiority dice)
          if (character.subclass && character.classId) {
            const { CLASS_REGISTRY: registry, findSubclass: findSub } = await import('../data/classes');
            const classDef = registry.find(c => c.id === character.classId);
            const subDef = classDef && character.subclass ? findSub(classDef, character.subclass) : undefined;
            if (subDef) {
              baseResources.push(...getSubclassResources(character.classId, subDef.id, character.level));
              basePassive.push(...getSubclassPassiveStats(character.classId, subDef.id, character.level));
            }
          }
          setClassResources(baseResources);
          setPassiveStats(basePassive);
        }
      } catch (e) {
        console.warn('Failed to load class resources:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [character.classId, character.class, character.level, character.subclass]);

  // Load spells data (only if spellcaster)
  useEffect(() => {
    if (!character.spellcasting) return;
    let cancelled = false;
    (async () => {
      const spells = await import('../data/spells');
      await spells.init();
      if (cancelled) return;
      const entryRenderer = await import('../utils/entryRenderer');
      if (cancelled) return;
      setModules({
        getSpellByName: spells.getSpellByName,
        getSpellImageUrl: spells.getSpellImageUrl,
        SCHOOL_NAMES: spells.SCHOOL_NAMES,
        EntryRenderer: entryRenderer.EntryRenderer,
      });
      setSpellsLoading(false);

      // Load auto-prepared spells from subclass and race (for legacy characters
      // whose auto-spells aren't yet persisted in spellcasting.spells)
      const auto = await getAutoSpellsForLevel(character, spells.getSpellByName);
      if (!cancelled) setAutoSpells(auto);
    })();
    return () => { cancelled = true; };
  }, [character.class, character.classId, character.subclass, character.level, character.race, character.raceSource]);

  const spellcasting = character.spellcasting;

  // Detect Agonizing Blast invocation (match the stable English key for localized names)
  const hasAgonizingBlast = (character.optionalFeatures ?? []).some(
    f => (f.nameEn ?? f.name) === 'Agonizing Blast' && f.featureType === 'EI'
  );

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Open context menu for a spell
  const handleSpellContextMenu = (
    e: React.MouseEvent,
    spell: CharacterSpell,
    isClassSpell: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const spellData = modules ? modules.getSpellByName(spell.name) as SpellData | undefined : undefined;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      spell,
      spellData: spellData ?? null,
      isClassSpell,
    });
  };

  // Spell data (only when spellcaster)
  const allSpells = spellcasting ? [...spellcasting.spells, ...autoSpells] : [];

  // Group spells by source
  type SourceType = 'class' | 'subclass' | 'race' | 'feat';
  interface SourceGroup {
    key: string;
    type: SourceType;
    label: string;
    color: string;
    icon: typeof Wand2;
    spells: typeof allSpells;
  }

  const sourceGroups = React.useMemo<SourceGroup[]>(() => {
    const groups = new Map<string, typeof allSpells>();
    for (const spell of allSpells) {
      const key = spell.source || '__class__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(spell);
    }

    const result: SourceGroup[] = [];
    const classSpells = groups.get('__class__');
    if (classSpells?.length) {
      result.push({ key: '__class__', type: 'class', label: t('spellcasting.classSpells'), color: 'text-blue-300', icon: BookOpen, spells: classSpells });
    }
    groups.delete('__class__');

    // Subclass
    if (character.subclass && groups.has(character.subclass)) {
      result.push({ key: character.subclass, type: 'subclass', label: character.classId ? getSubclassDisplayName(character.classId, character.subclass) : character.subclass, color: 'text-amber-300', icon: Star, spells: groups.get(character.subclass)! });
      groups.delete(character.subclass);
    }

    // Race — group key is canonical (matches autoSpells.source); label is localized for display.
    if (character.race && groups.has(character.race)) {
      result.push({ key: character.race, type: 'race', label: resolveDisplayRace(character.race, character.raceSource), color: 'text-emerald-300', icon: Sparkles, spells: groups.get(character.race)! });
      groups.delete(character.race);
    }

    // Remaining (feats)
    for (const [key, spells] of Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      result.push({ key, type: 'feat', label: key, color: 'text-purple-300', icon: Wand2, spells });
    }

    return result;
  }, [allSpells, character.subclass, character.race]);

  const expandedData = expandedSpell && modules
    ? (() => {
        const charSpell = allSpells.find(s => s.spellId === expandedSpell);
        if (!charSpell) return null;
        const data = modules.getSpellByName(charSpell.name);
        return data ? { charSpell, data } : null;
      })()
    : null;

  const preparedCount = allSpells.filter(s => s.level > 0 && s.prepared && !s.alwaysPrepared).length;
  const maxPrepared = spellcasting?.spellsKnown ?? 0;

  const togglePrepared = (spellId: string) => {
    if (!spellcasting) return;
    const spell = spellcasting.spells.find(s => s.spellId === spellId);
    if (!spell || spell.level === 0 || spell.alwaysPrepared) return;
    const willPrepare = !spell.prepared;
    if (willPrepare && maxPrepared > 0 && preparedCount >= maxPrepared) return;
    onUpdate({
      ...character,
      spellcasting: {
        ...spellcasting,
        spells: spellcasting.spells.map(s =>
          s.spellId === spellId ? { ...s, prepared: willPrepare } : s
        ),
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* ── Section A: Spell Slot Tracker ── */}
      {spellcasting?.spellSlots && (
        <SpellSlotTracker character={character} onUpdate={onUpdate} />
      )}

      {/* ── Section B: Class Resource Trackers ── */}
      <ResourceTokenTracker resources={classResources} character={character} onUpdate={onUpdate} />

      {/* ── Section C: Weapon Attacks ── */}
      <WeaponAttacksSection character={character} onUpdate={onUpdate} />

      {/* ── Section D: Actions & Features ── */}
      <ActionsSection character={character} passiveStats={passiveStats} EntryRenderer={modules?.EntryRenderer} />

      {/* ── Section E: Spellcasting Stats Bar ── */}
      {spellcasting && (() => {
        const ib = getEquippedItemBonuses(character);
        const totalDC = spellcasting.spellSaveDC + ib.bonusSpellSaveDc;
        const totalAttack = spellcasting.spellAttackBonus + ib.bonusSpellAttack;
        return (
        <div className="glass-panel p-3 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">{t('spellcasting.saveDC')}</span>
            <span className="font-bold text-gold">{totalDC}</span>
            {ib.bonusSpellSaveDc > 0 && <span className="text-xs text-emerald-400">{t('spellcasting.itemBonus', { bonus: ib.bonusSpellSaveDc })}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">{t('spellcasting.attackBonus')}</span>
            <ClickableAttackBonus bonus={totalAttack} className="font-bold text-gold" />
            {ib.bonusSpellAttack > 0 && <span className="text-xs text-emerald-400">{t('spellcasting.itemBonus', { bonus: ib.bonusSpellAttack })}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">{t('spellcasting.ability')}</span>
            <span className="font-bold text-gold">{getAbilityName(spellcasting.ability)}</span>
          </div>
          {maxPrepared > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted">{t('spellcasting.prepared')}</span>
              <span className="font-bold text-gold">{preparedCount}/{maxPrepared}</span>
            </div>
          )}
          <button
            onClick={() => setShowPrepModal(true)}
            className="ml-auto px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/30 text-gold text-xs font-medium hover:bg-gold/20 flex items-center gap-1.5 transition-colors"
          >
            <BookOpen size={13} />
            {t('spellcasting.preparation')}
          </button>
        </div>
        );
      })()}

      {/* ── Section F: Spells Grid ── */}
      {spellcasting && spellsLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-text-muted animate-pulse">{t('common.loadingSpells')}</div>
        </div>
      )}

      {spellcasting && modules && (
        <div className="space-y-3">
          {sourceGroups.map(group => {
            const groupCantrips = group.spells.filter(s => s.level === 0);
            const groupLeveled = group.spells.filter(s => s.level > 0);
            const groupedByLevel = groupLeveled.reduce<Record<number, typeof groupLeveled>>((acc, s) => {
              (acc[s.level] = acc[s.level] || []).push(s);
              return acc;
            }, {});
            const sectionKey = `src-${group.key}`;
            const GroupIcon = group.icon;

            return (
              <div key={group.key} className="glass-panel p-3">
                {/* Source group header */}
                <button
                  onClick={() => toggleSection(sectionKey)}
                  className="flex items-center gap-2 w-full text-left mb-2"
                >
                  {collapsedSections.has(sectionKey)
                    ? <ChevronRight size={14} className="text-text-muted" />
                    : <ChevronDown size={14} className="text-text-muted" />}
                  <GroupIcon size={14} className={group.color} />
                  <span className={`text-sm font-medieval ${group.color}`}>
                    {group.label} ({group.spells.length})
                  </span>
                </button>

                {!collapsedSections.has(sectionKey) && (
                  <div className="space-y-2 pl-1">
                    {/* Cantrips within group */}
                    {groupCantrips.length > 0 && (
                      <div>
                        <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">{t('spellcasting.cantripsCount', { count: groupCantrips.length })}</div>
                        <div className="flex flex-wrap gap-2">
                          {groupCantrips.map(spell => {
                            const data = modules.getSpellByName(spell.name);
                            const meta = getSpellMeta(data, t);
                            return (
                              <SpellTooltip
                                key={spell.spellId}
                                name={spell.name}
                                level={0}
                                school={data?.school}
                                castingTime={meta.castingTime}
                                range={meta.range}
                                components={meta.components}
                                duration={meta.duration}
                                description={data ? getFirstEntryText(data.entries) : undefined}
                              >
                                <SpellIconBadge
                                  name={spell.name}
                                  school={data?.school || ''}
                                  level={0}
                                  imageSrc={modules.getSpellImageUrl(spell.name)}
                                  prepared
                                  selected={expandedSpell === spell.spellId}
                                  onClick={() => setExpandedSpell(expandedSpell === spell.spellId ? null : spell.spellId)}
                                  onContextMenu={(e) => handleSpellContextMenu(e, spell as CharacterSpell, group.type === 'class')}
                                />
                              </SpellTooltip>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Leveled spells within group, sub-grouped by level */}
                    {Object.entries(groupedByLevel)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([level, spells]) => (
                        <div key={level}>
                          <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">{t('spellcasting.levelCount', { level, count: spells.length })}</div>
                          <div className="flex flex-wrap gap-2">
                            {spells.map(spell => {
                              const data = modules.getSpellByName(spell.name);
                              const meta = getSpellMeta(data, t);
                              const isClassSpell = group.type === 'class';
                              return (
                                <SpellTooltip
                                  key={spell.spellId}
                                  name={spell.name}
                                  level={spell.level}
                                  school={data?.school}
                                  castingTime={meta.castingTime}
                                  range={meta.range}
                                  components={meta.components}
                                  duration={meta.duration}
                                  description={data ? getFirstEntryText(data.entries) : undefined}
                                >
                                  <SpellIconBadge
                                    name={spell.name}
                                    school={data?.school || ''}
                                    level={spell.level}
                                    imageSrc={modules.getSpellImageUrl(spell.name)}
                                    prepared={spell.prepared}
                                    selected={expandedSpell === spell.spellId}
                                    onClick={() => setExpandedSpell(expandedSpell === spell.spellId ? null : spell.spellId)}
                                    onContextMenu={(e) => handleSpellContextMenu(e, spell as CharacterSpell, isClassSpell)}
                                  />
                                </SpellTooltip>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded spell detail */}
      {expandedData && modules && (
        <div className="glass-panel ornate-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medieval text-gold">{expandedData.charSpell.name}</h3>
            <div className="flex items-center gap-2">
              {expandedData.charSpell.level > 0 && !expandedData.charSpell.alwaysPrepared && spellcasting?.spells.some(s => s.spellId === expandedData.charSpell.spellId) && (
                <button
                  onClick={() => togglePrepared(expandedData.charSpell.spellId)}
                  disabled={!expandedData.charSpell.prepared && maxPrepared > 0 && preparedCount >= maxPrepared}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    expandedData.charSpell.prepared
                      ? 'bg-green-accent/30 text-green-bright border border-green-bright/30 hover:bg-red-accent/30 hover:text-red-bright hover:border-red-bright/30'
                      : 'bg-bg-panel border border-border-default text-text-secondary hover:border-gold/40 hover:text-gold disabled:opacity-40'
                  }`}
                >
                  {expandedData.charSpell.prepared ? t('spellcasting.unprepare') : t('spellcasting.prepare')}
                </button>
              )}
              {expandedData.charSpell.alwaysPrepared && (
                <span className="px-2 py-1 rounded text-xs text-gold/70 bg-gold/10 border border-gold/20">{t('common.alwaysPrepared')}</span>
              )}
              <button
                onClick={() => setExpandedSpell(null)}
                className="text-text-muted hover:text-text-primary text-sm"
              >✕</button>
            </div>
          </div>
          <div className="text-xs text-text-muted">
            {expandedData.charSpell.level === 0 ? t('common.cantrip') : t('common.level', { level: expandedData.charSpell.level })}
            {expandedData.data.school && ` • ${modules.SCHOOL_NAMES[expandedData.data.school] || expandedData.data.school}`}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {(() => { const m = getSpellMeta(expandedData.data, t); return (<>
              {m.castingTime && <div><span className="text-text-muted">{t('meta.castingTime')}</span><span className="text-text-primary">{m.castingTime}</span></div>}
              {m.range && <div><span className="text-text-muted">{t('meta.range')}</span><span className="text-text-primary">{m.range}</span></div>}
              {m.components && <div><span className="text-text-muted">{t('meta.components')}</span><span className="text-text-primary">{m.components}</span></div>}
              {m.duration && <div><span className="text-text-muted">{t('meta.duration')}</span><span className="text-text-primary">{m.duration}</span></div>}
            </>); })()}
          </div>

          <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
            <modules.EntryRenderer entries={expandedData.data.entries} context={expandedData.data.name} />
          </div>
          {expandedData.data.entriesHigherLevel && expandedData.data.entriesHigherLevel.length > 0 && (
            <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
              <modules.EntryRenderer entries={expandedData.data.entriesHigherLevel} context={expandedData.data.name} />
            </div>
          )}
          {/* Agonizing Blast bonus for damaging cantrips */}
          {expandedData.charSpell.level === 0 && hasAgonizingBlast && (() => {
            const effScores = getEffectiveAbilityScores(character);
            const chaMod = getAbilityModifier(effScores.charisma);
            return (
              <div className="pt-2 border-t border-border-default flex items-center gap-2 text-xs">
                <Zap size={12} className="text-amber-400" />
                <span className="text-amber-400 font-medium">Agonizing Blast</span>
                <span className="text-text-secondary">{t('spellcasting.agonizingBlast', { mod: chaMod })}</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Empty state for spellcasters with no spells */}
      {spellcasting && allSpells.length === 0 && !spellsLoading && (
        <div className="text-center text-text-muted py-4 italic text-sm">
          {t('spellcasting.noSpellsSelected')}
        </div>
      )}

      {/* Spell Preparation Modal */}
      {showPrepModal && spellcasting && (
        <SpellPreparationModal
          character={character}
          onConfirm={(updatedSpells) => {
            onUpdate({
              ...character,
              spellcasting: { ...spellcasting, spells: updatedSpells },
            });
            setShowPrepModal(false);
          }}
          onCancel={() => setShowPrepModal(false)}
        />
      )}

      {/* Spell Context Menu */}
      {contextMenu && (
        <SpellContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          spellName={contextMenu.spell.name}
          canPrepare={contextMenu.isClassSpell && contextMenu.spell.level > 0 && !contextMenu.spell.alwaysPrepared}
          isPrepared={!!contextMenu.spell.prepared}
          onViewInfo={() => {
            setInfoSpell({ name: contextMenu.spell.name, level: contextMenu.spell.level });
            setContextMenu(null);
          }}
          onCast={() => {
            if (contextMenu.spellData) {
              setCastingSpell({ spell: contextMenu.spell, spellData: contextMenu.spellData });
            }
            setContextMenu(null);
          }}
          onTogglePrepare={contextMenu.isClassSpell && contextMenu.spell.level > 0 && !contextMenu.spell.alwaysPrepared
            ? () => {
                togglePrepared(contextMenu.spell.spellId);
                setContextMenu(null);
              }
            : undefined
          }
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Spell Cast Modal */}
      {castingSpell && (
        <SpellCastModal
          character={character}
          spell={castingSpell.spell}
          spellData={castingSpell.spellData}
          onClose={() => setCastingSpell(null)}
        />
      )}

      {/* Full spell description popup */}
      {infoSpell && (
        <SpellDetailModal
          spellName={infoSpell.name}
          fallbackLevel={infoSpell.level}
          onClose={() => setInfoSpell(null)}
        />
      )}
    </div>
  );
};

// Keep backward-compatible export
export const SpellsTab = ActionsSpellsTab;
