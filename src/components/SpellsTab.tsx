import React, { useState, useEffect } from 'react';
import type { Character } from '../types';
import { formatModifier, ABILITY_NAMES } from '../utils/dnd';
import { SpellIconBadge, SpellTooltip } from './ui';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  getSpellImageUrl: (name: string) => string | undefined;
  SCHOOL_NAMES: Record<string, string>;
  EntryRenderer: React.FC<any>;
}

const TIME_UNITS: Record<string, string> = {
  action: 'действие', bonus: 'бонус', reaction: 'реакция', minute: 'мин.',
};

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

function getFirstEntryText(entries: any[]): string {
  for (const e of entries) {
    if (typeof e === 'string') return e;
    if (e?.entries) return getFirstEntryText(e.entries);
  }
  return '';
}

export const SpellsTab: React.FC<{ character: Character }> = ({ character }) => {
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
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
    })();
    return () => { cancelled = true; };
  }, []);

  const spellcasting = character.spellcasting;
  if (!spellcasting) return null;

  if (!modules) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-text-muted animate-pulse">Загрузка заклинаний...</div>
      </div>
    );
  }

  const { getSpellByName, getSpellImageUrl, SCHOOL_NAMES, EntryRenderer } = modules;

  const cantrips = spellcasting.spells.filter(s => s.level === 0);
  const leveledSpells = spellcasting.spells.filter(s => s.level > 0);
  const groupedByLevel = leveledSpells.reduce<Record<number, typeof leveledSpells>>((acc, s) => {
    (acc[s.level] = acc[s.level] || []).push(s);
    return acc;
  }, {});

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Expanded spell detail panel
  const expandedData = expandedSpell
    ? (() => {
        const charSpell = spellcasting.spells.find(s => s.spellId === expandedSpell);
        if (!charSpell) return null;
        const data = getSpellByName(charSpell.name);
        return data ? { charSpell, data } : null;
      })()
    : null;

  const preparedCount = spellcasting.spells.filter(s => s.level > 0 && s.prepared).length;
  const maxPrepared = spellcasting.spellsKnown ?? 0;

  return (
    <div className="space-y-4">
      {/* Stats bar — compact */}
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
      </div>

      {/* BG3-style icon sections */}
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
                  const data = getSpellByName(spell.name);
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
                        imageSrc={getSpellImageUrl(spell.name)}
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
                      const data = getSpellByName(spell.name);
                      const meta = getSpellMeta(data);
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
                            imageSrc={getSpellImageUrl(spell.name)}
                            prepared={spell.prepared}
                            selected={expandedSpell === spell.spellId}
                            onClick={() => setExpandedSpell(expandedSpell === spell.spellId ? null : spell.spellId)}
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

      {/* Expanded spell detail (click to expand) */}
      {expandedData && (
        <div className="glass-panel ornate-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medieval text-gold">{expandedData.charSpell.name}</h3>
            <button
              onClick={() => setExpandedSpell(null)}
              className="text-text-muted hover:text-text-primary text-sm"
            >✕</button>
          </div>
          <div className="text-xs text-text-muted">
            {expandedData.charSpell.level === 0 ? 'Заговор' : `${expandedData.charSpell.level} уровень`}
            {expandedData.data.school && ` • ${SCHOOL_NAMES[expandedData.data.school] || expandedData.data.school}`}
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
            <EntryRenderer entries={expandedData.data.entries} context={expandedData.data.name} />
          </div>
          {expandedData.data.entriesHigherLevel && expandedData.data.entriesHigherLevel.length > 0 && (
            <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
              <EntryRenderer entries={expandedData.data.entriesHigherLevel} context={expandedData.data.name} />
            </div>
          )}
        </div>
      )}

      {spellcasting.spells.length === 0 && (
        <div className="text-center text-text-muted py-8 italic">
          Заклинания не выбраны
        </div>
      )}
    </div>
  );
};
