import React, { useState, useMemo } from 'react';
import { Search, ArrowLeft, BookOpen, Sparkles, Swords, Shield, Eye, Brain, Scroll, Star, Wand2, ChevronRight, X } from 'lucide-react';
import {
  ALL_SPELLS, type SpellData,
  ALL_FEATS, type FeatData,
  ALL_SPECIES, type SpeciesData,
  ALL_CONDITIONS, type ConditionDiseaseData,
  ALL_SENSES, type SenseData,
  ALL_SKILLS, type SkillData,
  ALL_VARIANT_RULES, type VariantRuleData,
  ALL_OPTIONAL_FEATURES, type OptionalFeatureData,
  ALL_JSON_BACKGROUNDS, type JsonBackgroundData,
  ITEM_TEMPLATES, type ItemTemplate,
  ALL_ITEMS_BASE, type ItemBaseData,
  type RegistryEntry,
} from '../data/registry';
import { SCHOOL_NAMES } from '../data/spells';
import { FEAT_CATEGORY_NAMES } from '../data/feats';
import { SIZE_NAMES } from '../data/species';
import { RULE_TYPE_NAMES } from '../data/variantrule';
import { FEATURE_TYPE_NAMES } from '../data/optionalfeatures';
import { ABILITY_ABBR_NAMES } from '../data/skills';
import { EntryRenderer } from '../utils/entryRenderer';

type GlossaryCategory =
  | 'spells' | 'feats' | 'species' | 'backgrounds' | 'conditions'
  | 'senses' | 'skills' | 'rules' | 'optionalfeatures' | 'items';

interface CategoryConfig {
  key: GlossaryCategory;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  count: number;
}

interface GlossaryProps {
  onBack: () => void;
}

export const Glossary: React.FC<GlossaryProps> = ({ onBack }) => {
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<{ type: string; data: any } | null>(null);

  const categories: CategoryConfig[] = useMemo(() => [
    { key: 'spells', label: 'Заклинания', icon: Wand2, count: ALL_SPELLS.length },
    { key: 'feats', label: 'Черты', icon: Star, count: ALL_FEATS.length },
    { key: 'species', label: 'Виды', icon: Sparkles, count: ALL_SPECIES.length },
    { key: 'backgrounds', label: 'Предыстории', icon: BookOpen, count: ALL_JSON_BACKGROUNDS.length },
    { key: 'conditions', label: 'Состояния и болезни', icon: Shield, count: ALL_CONDITIONS.length },
    { key: 'senses', label: 'Чувства', icon: Eye, count: ALL_SENSES.length },
    { key: 'skills', label: 'Навыки', icon: Brain, count: ALL_SKILLS.length },
    { key: 'rules', label: 'Правила', icon: Scroll, count: ALL_VARIANT_RULES.length },
    { key: 'optionalfeatures', label: 'Особые способности', icon: Swords, count: ALL_OPTIONAL_FEATURES.length },
    { key: 'items', label: 'Предметы', icon: Shield, count: ITEM_TEMPLATES.length + ALL_ITEMS_BASE.length },
  ], []);

  // Фильтрованный список по категории и поиску
  const filteredItems = useMemo(() => {
    if (!activeCategory) return [];
    const q = searchQuery.toLowerCase().trim();

    const filterByName = (items: { name: string }[]) =>
      q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;

    switch (activeCategory) {
      case 'spells': return filterByName(ALL_SPELLS);
      case 'feats': return filterByName(ALL_FEATS);
      case 'species': return filterByName(ALL_SPECIES);
      case 'backgrounds': return filterByName(ALL_JSON_BACKGROUNDS);
      case 'conditions': return filterByName(ALL_CONDITIONS);
      case 'senses': return filterByName(ALL_SENSES);
      case 'skills': return filterByName(ALL_SKILLS);
      case 'rules': return filterByName(ALL_VARIANT_RULES);
      case 'optionalfeatures': return filterByName(ALL_OPTIONAL_FEATURES);
      case 'items': {
        const allItems = [
          ...ITEM_TEMPLATES.map(t => ({ name: t.name, source: t.raw.source, _type: 'template' as const, data: t })),
          ...ALL_ITEMS_BASE.map(b => ({ name: b.name, source: b.source, _type: 'base' as const, data: b })),
        ];
        return q ? allItems.filter(i => i.name.toLowerCase().includes(q)) : allItems;
      }
      default: return [];
    }
  }, [activeCategory, searchQuery]);

  // Обработка навигации по тегам из EntryRenderer
  const handleNavigate = (entry: RegistryEntry) => {
    setSelectedEntry({ type: entry.type, data: entry.data });
  };

  // Получить subtitle для элемента списка
  const getItemSubtitle = (item: any): string => {
    if (!activeCategory) return '';
    switch (activeCategory) {
      case 'spells': {
        const spell = item as SpellData;
        const level = spell.level === 0 ? 'Заговор' : `${spell.level} ур.`;
        const school = SCHOOL_NAMES[spell.school] || spell.school;
        return `${level} • ${school}`;
      }
      case 'feats': {
        const feat = item as FeatData;
        return FEAT_CATEGORY_NAMES[feat.category || ''] || feat.source || '';
      }
      case 'species': {
        const sp = item as SpeciesData;
        const sizes = sp.size?.map(s => SIZE_NAMES[s] || s).join('/') || '';
        return `${sizes} • ${sp.source}`;
      }
      case 'backgrounds': {
        const bg = item as JsonBackgroundData;
        return bg.source || '';
      }
      case 'conditions':
        return (item as ConditionDiseaseData).source || '';
      case 'senses':
        return (item as SenseData).source || '';
      case 'skills': {
        const skill = item as SkillData;
        return ABILITY_ABBR_NAMES[skill.ability] || skill.ability || '';
      }
      case 'rules': {
        const rule = item as VariantRuleData;
        return RULE_TYPE_NAMES[rule.ruleType || ''] || rule.source || '';
      }
      case 'optionalfeatures': {
        const opt = item as OptionalFeatureData;
        const types = opt.featureType?.map(t => FEATURE_TYPE_NAMES[t] || t).join(', ');
        return types || opt.source || '';
      }
      case 'items': {
        return item.source || '';
      }
      default: return '';
    }
  };

  // Получить entries для выбранного элемента
  const getEntries = (item: any): any[] => {
    if (!activeCategory) return [];
    switch (activeCategory) {
      case 'items': {
        if (item._type === 'template') {
          return (item.data as ItemTemplate).raw.entries || [];
        }
        return (item.data as ItemBaseData).entries || (item.data as ItemBaseData).entriesTemplate || [];
      }
      default:
        return item.entries || [];
    }
  };

  const getItemName = (item: any): string => {
    return item.name || 'Без названия';
  };

  // ─── Рендеринг выбранного элемента ───
  const renderDetail = () => {
    if (!selectedEntry) return null;
    const data = selectedEntry.data;
    const entries = data.entries || data.raw?.entries || [];

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl border-2 border-dnd-secondary max-w-3xl w-full max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-medieval text-dnd-secondary">{data.name || 'Запись'}</h2>
            <button
              onClick={() => setSelectedEntry(null)}
              className="text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
          <div className="p-6">
            {/* Мета-информация */}
            <div className="flex flex-wrap gap-2 mb-4">
              {data.source && (
                <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">
                  {data.source}
                </span>
              )}
              {data.level !== undefined && (
                <span className="px-2 py-1 bg-purple-900/40 text-purple-300 rounded text-xs">
                  {data.level === 0 ? 'Заговор' : `${data.level} уровень`}
                </span>
              )}
              {data.school && (
                <span className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs">
                  {SCHOOL_NAMES[data.school] || data.school}
                </span>
              )}
              {data.category && (
                <span className="px-2 py-1 bg-green-900/40 text-green-300 rounded text-xs">
                  {FEAT_CATEGORY_NAMES[data.category] || data.category}
                </span>
              )}
              {data.ruleType && (
                <span className="px-2 py-1 bg-yellow-900/40 text-yellow-300 rounded text-xs">
                  {RULE_TYPE_NAMES[data.ruleType] || data.ruleType}
                </span>
              )}
              {data.featureType?.map((ft: string) => (
                <span key={ft} className="px-2 py-1 bg-red-900/40 text-red-300 rounded text-xs">
                  {FEATURE_TYPE_NAMES[ft] || ft}
                </span>
              ))}
            </div>

            {/* Для заклинаний — дополнительная информация */}
            {selectedEntry.type === 'spell' && renderSpellMeta(data)}

            {/* Fluff (описание предыстории) */}
            {data.fluff && Array.isArray(data.fluff) && data.fluff.length > 0 && (
              <div className="mb-4 text-gray-300 italic text-sm leading-relaxed">
                {data.fluff.map((text: string, i: number) => (
                  <p key={i} className="mb-2">{text}</p>
                ))}
              </div>
            )}

            {/* Entries */}
            {entries.length > 0 && (
              <EntryRenderer
                entries={entries}
                context={data.name || ''}
                onNavigate={handleNavigate}
              />
            )}

            {/* EntriesHigherLevel для заклинаний */}
            {data.entriesHigherLevel && data.entriesHigherLevel.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <EntryRenderer
                  entries={data.entriesHigherLevel}
                  context={data.name || ''}
                  onNavigate={handleNavigate}
                />
              </div>
            )}

            {/* Для заклинаний — классы */}
            {data.classes?.fromClassList && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm text-gray-400 mb-2">Доступно классам:</h4>
                <div className="flex flex-wrap gap-1">
                  {data.classes.fromClassList.map((c: any, i: number) => (
                    <span key={i} className="px-2 py-1 bg-dnd-primary/30 text-red-300 rounded text-xs">
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Предпосылки для черт */}
            {data.prerequisite && data.prerequisite.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm text-gray-400 mb-2">Предпосылки:</h4>
                <div className="text-sm text-gray-300">
                  {data.prerequisite.map((p: any, i: number) => (
                    <div key={i}>
                      {p.level && <span>Уровень {typeof p.level === 'object' ? p.level.level : p.level}</span>}
                      {p.ability && p.ability.map((a: any, j: number) => (
                        <span key={j} className="ml-2">
                          {Object.entries(a).map(([k, v]) => `${ABILITY_ABBR_NAMES[k] || k} ${v}`).join(', ')}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Мета-информация для заклинания
  const renderSpellMeta = (spell: SpellData) => {
    const timeStr = spell.time?.map(t => `${t.number} ${t.unit === 'action' ? 'действие' : t.unit === 'bonus' ? 'бонус. действие' : t.unit === 'reaction' ? 'реакция' : t.unit === 'minute' ? 'мин.' : t.unit}`).join(', ');

    const rangeStr = spell.range?.distance?.amount
      ? `${spell.range.distance.amount} ${spell.range.distance.type === 'feet' ? 'фт.' : spell.range.distance.type === 'miles' ? 'миль' : spell.range.distance.type}`
      : spell.range?.type === 'touch' ? 'Касание' : spell.range?.type === 'self' ? 'На себя' : spell.range?.type || '';

    const componentsStr = [
      spell.components?.v ? 'В' : '',
      spell.components?.s ? 'С' : '',
      spell.components?.m ? `М (${typeof spell.components.m === 'string' ? spell.components.m : typeof spell.components.m === 'object' && spell.components.m && 'text' in (spell.components.m as any) ? (spell.components.m as any).text : ''})` : '',
    ].filter(Boolean).join(', ');

    const durationStr = spell.duration?.map(d => {
      if (d.type === 'instant') return 'Мгновенная';
      if (d.type === 'permanent') return 'Постоянная';
      if (d.type === 'special') return 'Особая';
      const conc = d.concentration ? 'Концентрация, ' : '';
      if (d.duration) {
        const units: Record<string, string> = { minute: 'мин.', hour: 'ч.', round: 'раунд', day: 'дней' };
        return `${conc}${d.duration.amount} ${units[d.duration.type] || d.duration.type}`;
      }
      return d.type;
    }).join(', ');

    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-gray-800/60 rounded-lg">
        {timeStr && (
          <div>
            <div className="text-xs text-gray-500">Время</div>
            <div className="text-sm text-gray-200">{timeStr}</div>
          </div>
        )}
        {rangeStr && (
          <div>
            <div className="text-xs text-gray-500">Дистанция</div>
            <div className="text-sm text-gray-200">{rangeStr}</div>
          </div>
        )}
        {componentsStr && (
          <div>
            <div className="text-xs text-gray-500">Компоненты</div>
            <div className="text-sm text-gray-200">{componentsStr}</div>
          </div>
        )}
        {durationStr && (
          <div>
            <div className="text-xs text-gray-500">Длительность</div>
            <div className="text-sm text-gray-200">{durationStr}</div>
          </div>
        )}
        {spell.damageInflict && (
          <div>
            <div className="text-xs text-gray-500">Урон</div>
            <div className="text-sm text-gray-200">{spell.damageInflict.join(', ')}</div>
          </div>
        )}
        {spell.savingThrow && (
          <div>
            <div className="text-xs text-gray-500">Спасбросок</div>
            <div className="text-sm text-gray-200">{spell.savingThrow.join(', ')}</div>
          </div>
        )}
      </div>
    );
  };

  // ─── Основной рендер ───

  // Категории (главный экран)
  if (!activeCategory) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Назад</span>
          </button>
          <h2 className="text-2xl font-medieval text-dnd-secondary">База знаний</h2>
          <div className="w-24" />
        </div>

        {/* Глобальный поиск */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по всем категориям..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white focus:outline-none focus:border-dnd-secondary transition-colors"
          />
        </div>

        {/* Сетка категорий */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 flex-1 min-h-0 overflow-y-auto">
          {categories.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                onClick={() => { setActiveCategory(cat.key); setSearchQuery(''); }}
                className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-gray-600 bg-gray-800/50 hover:border-dnd-secondary hover:bg-dnd-secondary/10 transition-all group"
              >
                <div className="w-14 h-14 rounded-full bg-gray-700/50 flex items-center justify-center group-hover:bg-dnd-secondary/20 transition-colors">
                  <Icon size={28} className="text-gray-400 group-hover:text-dnd-secondary transition-colors" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-200 group-hover:text-dnd-secondary text-sm transition-colors">
                    {cat.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{cat.count} записей</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Список записей в категории
  const activeCat = categories.find(c => c.key === activeCategory);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => { setActiveCategory(null); setSearchQuery(''); setSelectedEntry(null); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Категории</span>
        </button>
        <h2 className="text-xl font-medieval text-dnd-secondary">
          {activeCat?.label || 'База знаний'}
          <span className="text-sm font-normal text-gray-400 ml-2">({filteredItems.length})</span>
        </h2>
        <div className="w-24" />
      </div>

      {/* Поиск */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Поиск..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border-2 border-gray-600 rounded-lg text-white focus:outline-none focus:border-dnd-secondary transition-colors text-sm"
        />
      </div>

      {/* Список */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {filteredItems.map((item: any, index: number) => (
          <button
            key={`${getItemName(item)}-${index}`}
            onClick={() => {
              setSelectedEntry({
                type: activeCategory === 'items' ? 'item' : activeCategory,
                data: activeCategory === 'items' ? (item._type === 'template' ? item.data : item.data) : item,
              });
            }}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-800/40 hover:bg-gray-800 border border-transparent hover:border-gray-600 transition-all text-left group"
          >
            <div className="min-w-0">
              <div className="text-sm text-gray-200 group-hover:text-dnd-secondary font-medium truncate">
                {getItemName(item)}
              </div>
              <div className="text-xs text-gray-500 truncate">{getItemSubtitle(item)}</div>
            </div>
            <ChevronRight size={16} className="text-gray-600 group-hover:text-dnd-secondary shrink-0" />
          </button>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            {searchQuery ? 'Ничего не найдено' : 'Нет записей в этой категории'}
          </div>
        )}
      </div>

      {/* Модальное окно деталей */}
      {selectedEntry && renderDetail()}
    </div>
  );
};
