import React, { useState, useEffect } from 'react';
import type { Character, CustomAttack } from '../types';
import { formatModifier, ABILITY_NAMES } from '../utils/dnd';
import { getEquippedWeaponAttacks } from '../utils/weaponAttacks';
import { getClassResources, getClassPassiveStats, getLevelTableRow, type ClassResource, type ClassPassiveStat } from '../utils/classResources';
import { SpellIconBadge, SpellTooltip } from './ui';
import { ChevronDown, ChevronRight, Swords, Plus, Trash2, Sparkles, Zap, Shield, BookOpen } from 'lucide-react';
import { SpellPreparationModal } from './SpellPreparationModal';

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

const TIME_UNITS: Record<string, string> = {
  action: 'действие', bonus: 'бонус', reaction: 'реакция', minute: 'мин.',
};

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

function getSpellMeta(spellData: SpellDataLocal | undefined) {
  if (!spellData) return {};
  const castingTime = spellData.time
    ?.map(t => `${t.number} ${TIME_UNITS[t.unit] || t.unit}`)
    .join(', ');
  const range = spellData.range?.distance?.amount
    ? `${spellData.range.distance.amount} фт.`
    : spellData.range?.type === 'touch' ? 'Касание'
      : spellData.range?.type === 'self' ? 'На себя'
        : spellData.range?.type || '';
  const components = spellData.components
    ? [
        spellData.components.v ? 'В' : '',
        spellData.components.s ? 'С' : '',
        spellData.components.m ? 'М' : '',
      ].filter(Boolean).join(', ')
    : '';
  const duration = spellData.duration
    ?.map(d => {
      if (d.type === 'instant') return 'Мгновенная';
      if (d.concentration) return `Конц., ${d.duration?.amount || ''} ${d.duration?.type || ''}`;
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

function parseSpellTag(tag: string): string {
  const m = tag.match(/\{@spell\s+([^|}]+)/);
  return m ? m[1].trim() : tag.replace(/[{}@spell]/g, '').split('|')[0].trim();
}

function parseRacialSpellName(raw: string): { name: string; isCantrip: boolean } {
  const isCantrip = raw.endsWith('#c');
  const clean = raw.replace(/#c$/, '').split('|')[0].trim();
  const name = clean.replace(/\b\w/g, c => c.toUpperCase());
  return { name, isCantrip };
}

// ─── Spell Slot Tracker (BG3 style) ─────────────────────────────────

const SpellSlotTracker: React.FC<{
  character: Character;
  onUpdate: (character: Character) => void;
}> = ({ character, onUpdate }) => {
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
        Ячейки заклинаний
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
                      title={isAvailable ? 'Потратить ячейку' : 'Восстановить ячейку'}
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
        Ресурсы класса
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
                      title={isAvailable ? 'Использовать' : 'Восстановить'}
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAttack, setNewAttack] = useState({ name: '', attackBonus: 0, damage: '', damageType: '', notes: '' });

  const equippedAttacks = getEquippedWeaponAttacks(character);
  const customAttacks = character.customAttacks ?? [];

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

  if (equippedAttacks.length === 0 && customAttacks.length === 0 && !showAddForm) {
    return (
      <div className="glass-panel p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medieval text-gold flex items-center gap-2">
            <Swords size={14} />
            Атаки
          </h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs text-text-muted hover:text-gold transition-colors flex items-center gap-1"
          >
            <Plus size={12} /> Добавить
          </button>
        </div>
        <p className="text-xs text-text-muted italic">Экипируйте оружие или добавьте атаку вручную</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medieval text-gold flex items-center gap-2">
          <Swords size={14} />
          Атаки
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs text-text-muted hover:text-gold transition-colors flex items-center gap-1"
        >
          <Plus size={12} /> Добавить
        </button>
      </div>

      <div className="space-y-1">
        {/* Equipped weapon attacks */}
        {equippedAttacks.map((atk, i) => (
          <div key={`eq-${i}`} className="flex items-center gap-3 text-sm py-1.5 px-2 rounded bg-bg-secondary/50">
            <span className="font-medium text-text-primary flex-1">{atk.name}</span>
            <span className="text-green-400 font-bold min-w-[40px] text-right">{atk.attackBonusFormatted}</span>
            <span className="text-text-secondary min-w-[100px]">{atk.damage}</span>
            <span className="text-xs text-text-muted">{atk.damageType}</span>
          </div>
        ))}

        {/* Custom attacks */}
        {customAttacks.map(atk => (
          <div key={atk.id} className="flex items-center gap-3 text-sm py-1.5 px-2 rounded bg-bg-secondary/50">
            <span className="font-medium text-text-primary flex-1">{atk.name}</span>
            <span className="text-green-400 font-bold min-w-[40px] text-right">{formatModifier(atk.attackBonus)}</span>
            <span className="text-text-secondary min-w-[100px]">{atk.damage}</span>
            <span className="text-xs text-text-muted">{atk.damageType}</span>
            <button
              onClick={() => removeCustomAttack(atk.id)}
              className="text-red-400/60 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Add custom attack form */}
      {showAddForm && (
        <div className="mt-2 p-2 rounded bg-bg-secondary/50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Название"
              value={newAttack.name}
              onChange={e => setNewAttack(p => ({ ...p, name: e.target.value }))}
              className="text-xs bg-bg-primary border border-border-default rounded px-2 py-1 text-text-primary"
            />
            <input
              type="number"
              placeholder="Бонус атаки"
              value={newAttack.attackBonus}
              onChange={e => setNewAttack(p => ({ ...p, attackBonus: parseInt(e.target.value) || 0 }))}
              className="text-xs bg-bg-primary border border-border-default rounded px-2 py-1 text-text-primary"
            />
            <input
              type="text"
              placeholder="Урон (1d8 + 3)"
              value={newAttack.damage}
              onChange={e => setNewAttack(p => ({ ...p, damage: e.target.value }))}
              className="text-xs bg-bg-primary border border-border-default rounded px-2 py-1 text-text-primary"
            />
            <input
              type="text"
              placeholder="Тип урона"
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
              Добавить
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-xs px-3 py-1 text-text-muted hover:text-text-primary transition-colors"
            >
              Отмена
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
}

const ActionsSection: React.FC<{
  character: Character;
  passiveStats: ClassPassiveStat[];
  EntryRenderer?: React.FC<any>;
}> = ({ character, passiveStats, EntryRenderer: EntryRendererProp }) => {
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [loadedFeatures, setLoadedFeatures] = useState<LoadedFeature[]>([]);
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
            const { getClassById, CLASS_REGISTRY } = await import('../data/classes');
            const classDef = getClassById(character.classId || '') ?? CLASS_REGISTRY.find(c => c.name === character.class);
            const subDef = classDef?.subclasses.find(s => s.name === character.subclass);
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

  const displayFeatures = loadedFeatures.length > 0 ? loadedFeatures : features.map(f => ({
    id: f.id,
    name: f.name,
    source: f.source,
    rawEntries: f.description ? [f.description] : [],
  }));

  if (displayFeatures.length === 0 && passiveStats.length === 0) return null;

  return (
    <div className="glass-panel p-3">
      <h3 className="text-sm font-medieval text-gold mb-2 flex items-center gap-2">
        <Shield size={14} />
        Действия и способности
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
        {displayFeatures.map(feat => (
          <div key={feat.id} className="rounded bg-bg-secondary/50">
            <button
              onClick={() => setExpandedFeature(expandedFeature === feat.id ? null : feat.id)}
              className="flex items-center gap-2 w-full text-left py-1.5 px-2 text-sm hover:bg-bg-secondary/80 transition-colors rounded"
            >
              {expandedFeature === feat.id
                ? <ChevronDown size={12} className="text-text-muted shrink-0" />
                : <ChevronRight size={12} className="text-text-muted shrink-0" />}
              <span className="text-text-primary font-medium">{feat.name}</span>
              <span className="text-xs text-text-muted ml-auto">{feat.source}</span>
            </button>
            {expandedFeature === feat.id && feat.rawEntries.length > 0 && (
              <div className="px-6 pb-2 text-xs text-text-secondary leading-relaxed">
                {Renderer
                  ? <Renderer entries={feat.rawEntries} context={feat.name} />
                  : feat.rawEntries.map((e, i) => (
                      <p key={i} className={i > 0 ? 'mt-1' : ''}>{typeof e === 'string' ? cleanTagRefs(e) : ''}</p>
                    ))
                }
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
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showPrepModal, setShowPrepModal] = useState(false);
  const [autoSpells, setAutoSpells] = useState<{ spellId: string; name: string; level: number; prepared: boolean; alwaysPrepared: boolean; source?: string }[]>([]);
  const [classResources, setClassResources] = useState<ClassResource[]>([]);
  const [passiveStats, setPassiveStats] = useState<ClassPassiveStat[]>([]);
  const [spellsLoading, setSpellsLoading] = useState(!!character.spellcasting);

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
          setClassResources(getClassResources(row));
          setPassiveStats(getClassPassiveStats(row));
        }
      } catch (e) {
        console.warn('Failed to load class resources:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [character.classId, character.class, character.level]);

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

      // Load auto-prepared spells from subclass and race
      const auto: typeof autoSpells = [];
      const existingNames = new Set(character.spellcasting?.spells.map(s => s.name.toLowerCase()) ?? []);

      // Subclass spells
      if (character.subclass && character.classId) {
        try {
          const [subMod, { getClassById, CLASS_REGISTRY }] = await Promise.all([
            import('../data/classes/subclassJsonLoader').then(async m => { await m.init(); return m; }),
            import('../data/classes'),
          ]);
          if (cancelled) return;

          const classDef = getClassById(character.classId) ?? CLASS_REGISTRY.find(c => c.name === character.class);
          const subDef = classDef?.subclasses.find(s => s.name === character.subclass);
          if (subDef && classDef) {
            const subData = subMod.getSubclassById(classDef.id, subDef.id);
            if (subData?.features) {
              for (const feat of subData.features) {
                const spellEntries = feat.spellList ?? feat.spells ?? [];
                for (const entry of spellEntries) {
                  const levelKey = Object.keys(entry).find(k => k.endsWith('Level'));
                  const requiredLevel = levelKey ? entry[levelKey] : entry.level;
                  if (requiredLevel != null && requiredLevel <= character.level) {
                    for (const spellTag of (entry.spells ?? [])) {
                      const name = parseSpellTag(spellTag);
                      if (!existingNames.has(name.toLowerCase())) {
                        const spellData = spells.getSpellByName(name);
                        auto.push({
                          spellId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                          name,
                          level: spellData?.level ?? 1,
                          prepared: true,
                          alwaysPrepared: true,
                          source: character.subclass,
                        });
                        existingNames.add(name.toLowerCase());
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) { console.warn('Failed to load subclass spells:', e); }
      }

      // Racial spells
      if (character.race) {
        try {
          const speciesMod = await import('../data/species');
          await speciesMod.init();
          if (cancelled) return;

          const speciesData = speciesMod.getSpeciesByName(character.race, character.raceSource);
          if (speciesData?.additionalSpells) {
            for (const group of speciesData.additionalSpells) {
              if (group.known) {
                for (const [lvlStr, spellsOrObj] of Object.entries(group.known)) {
                  if (parseInt(lvlStr) <= character.level && Array.isArray(spellsOrObj)) {
                    for (const raw of spellsOrObj) {
                      if (typeof raw !== 'string') continue;
                      const { name, isCantrip } = parseRacialSpellName(raw);
                      if (!existingNames.has(name.toLowerCase())) {
                        const spellData = spells.getSpellByName(name);
                        auto.push({
                          spellId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                          name,
                          level: isCantrip ? 0 : (spellData?.level ?? 1),
                          prepared: true,
                          alwaysPrepared: true,
                          source: character.race,
                        });
                        existingNames.add(name.toLowerCase());
                      }
                    }
                  }
                }
              }
              if (group.innate) {
                for (const [lvlStr, innateObj] of Object.entries(group.innate as Record<string, any>)) {
                  if (parseInt(lvlStr) <= character.level && innateObj?.daily) {
                    for (const spellArr of Object.values(innateObj.daily as Record<string, string[]>)) {
                      if (!Array.isArray(spellArr)) continue;
                      for (const raw of spellArr) {
                        if (typeof raw !== 'string') continue;
                        const { name } = parseRacialSpellName(raw);
                        if (!existingNames.has(name.toLowerCase())) {
                          const spellData = spells.getSpellByName(name);
                          auto.push({
                            spellId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                            name,
                            level: spellData?.level ?? 1,
                            prepared: true,
                            alwaysPrepared: true,
                            source: character.race,
                          });
                          existingNames.add(name.toLowerCase());
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) { console.warn('Failed to load racial spells:', e); }
      }

      if (!cancelled) setAutoSpells(auto);
    })();
    return () => { cancelled = true; };
  }, [character.class, character.classId, character.subclass, character.level, character.race, character.raceSource]);

  const spellcasting = character.spellcasting;

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Spell data (only when spellcaster)
  const allSpells = spellcasting ? [...spellcasting.spells, ...autoSpells] : [];
  const cantrips = allSpells.filter(s => s.level === 0);
  const leveledSpells = allSpells.filter(s => s.level > 0);
  const groupedByLevel = leveledSpells.reduce<Record<number, typeof leveledSpells>>((acc, s) => {
    (acc[s.level] = acc[s.level] || []).push(s);
    return acc;
  }, {});

  const expandedData = expandedSpell && modules
    ? (() => {
        const charSpell = allSpells.find(s => s.spellId === expandedSpell);
        if (!charSpell) return null;
        const data = modules.getSpellByName(charSpell.name);
        return data ? { charSpell, data } : null;
      })()
    : null;

  const preparedCount = allSpells.filter(s => s.level > 0 && s.prepared).length;
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
      {spellcasting && (
        <div className="glass-panel p-3 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Сл спасброска:</span>
            <span className="font-bold text-gold">{spellcasting.spellSaveDC}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Бонус атаки:</span>
            <span className="font-bold text-gold">{formatModifier(spellcasting.spellAttackBonus)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Характеристика:</span>
            <span className="font-bold text-gold">{ABILITY_NAMES[spellcasting.ability]}</span>
          </div>
          {maxPrepared > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Подготовлено:</span>
              <span className="font-bold text-gold">{preparedCount}/{maxPrepared}</span>
            </div>
          )}
          <button
            onClick={() => setShowPrepModal(true)}
            className="ml-auto px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/30 text-gold text-xs font-medium hover:bg-gold/20 flex items-center gap-1.5 transition-colors"
          >
            <BookOpen size={13} />
            Подготовка
          </button>
        </div>
      )}

      {/* ── Section F: Spells Grid ── */}
      {spellcasting && spellsLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-text-muted animate-pulse">Загрузка заклинаний...</div>
        </div>
      )}

      {spellcasting && modules && (
        <div className="space-y-3">
          {/* Cantrips */}
          {cantrips.length > 0 && (
            <div className="glass-panel p-3">
              <button
                onClick={() => toggleSection('cantrips')}
                className="flex items-center gap-2 w-full text-left mb-2"
              >
                {collapsedSections.has('cantrips')
                  ? <ChevronRight size={14} className="text-text-muted" />
                  : <ChevronDown size={14} className="text-text-muted" />}
                <span className="text-sm font-medieval text-purple-300">Заговоры ({cantrips.length})</span>
              </button>
              {!collapsedSections.has('cantrips') && (
                <div className="flex flex-wrap gap-2">
                  {cantrips.map(spell => {
                    const data = modules.getSpellByName(spell.name);
                    const meta = getSpellMeta(data);
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
                        />
                      </SpellTooltip>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Leveled spells by level */}
          {Object.entries(groupedByLevel)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, spells]) => {
              const sectionKey = `level-${level}`;
              return (
                <div key={level} className="glass-panel p-3">
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className="flex items-center gap-2 w-full text-left mb-2"
                  >
                    {collapsedSections.has(sectionKey)
                      ? <ChevronRight size={14} className="text-text-muted" />
                      : <ChevronDown size={14} className="text-text-muted" />}
                    <span className="text-sm font-medieval text-blue-300">{level} уровень ({spells.length})</span>
                  </button>
                  {!collapsedSections.has(sectionKey) && (
                    <div className="flex flex-wrap gap-2">
                      {spells.map(spell => {
                        const data = modules.getSpellByName(spell.name);
                        const meta = getSpellMeta(data);
                        const isAutoSpell = spell.alwaysPrepared || !spellcasting?.spells.some(s => s.spellId === spell.spellId);
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
                              onContextMenu={!isAutoSpell ? (e) => { e.preventDefault(); togglePrepared(spell.spellId); } : undefined}
                            />
                          </SpellTooltip>
                        );
                      })}
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
                  {expandedData.charSpell.prepared ? 'Снять подготовку' : 'Подготовить'}
                </button>
              )}
              {expandedData.charSpell.alwaysPrepared && (
                <span className="px-2 py-1 rounded text-xs text-gold/70 bg-gold/10 border border-gold/20">Всегда подготовлено</span>
              )}
              <button
                onClick={() => setExpandedSpell(null)}
                className="text-text-muted hover:text-text-primary text-sm"
              >✕</button>
            </div>
          </div>
          <div className="text-xs text-text-muted">
            {expandedData.charSpell.level === 0 ? 'Заговор' : `${expandedData.charSpell.level} уровень`}
            {expandedData.data.school && ` • ${modules.SCHOOL_NAMES[expandedData.data.school] || expandedData.data.school}`}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {(() => { const m = getSpellMeta(expandedData.data); return (<>
              {m.castingTime && <div><span className="text-text-muted">Время: </span><span className="text-text-primary">{m.castingTime}</span></div>}
              {m.range && <div><span className="text-text-muted">Дальность: </span><span className="text-text-primary">{m.range}</span></div>}
              {m.components && <div><span className="text-text-muted">Компоненты: </span><span className="text-text-primary">{m.components}</span></div>}
              {m.duration && <div><span className="text-text-muted">Длительность: </span><span className="text-text-primary">{m.duration}</span></div>}
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
        </div>
      )}

      {/* Empty state for spellcasters with no spells */}
      {spellcasting && allSpells.length === 0 && !spellsLoading && (
        <div className="text-center text-text-muted py-4 italic text-sm">
          Заклинания не выбраны
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
    </div>
  );
};

// Keep backward-compatible export
export const SpellsTab = ActionsSpellsTab;
