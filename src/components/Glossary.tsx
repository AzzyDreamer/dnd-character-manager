import React, { useState, useMemo, useEffect } from 'react';
import { Search, ArrowLeft, BookOpen, Sparkles, Swords, Shield, Eye, Brain, Scroll, Star, Wand2, ChevronRight, X } from 'lucide-react';

// ─── Типы (только описания, без импорта данных) ───
interface RegistryEntry {
  type: string;
  name: string;
  source?: string;
  entries?: any[];
  data: any;
}

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

// ─── Контейнер для лениво загруженных данных ───
interface LoadedData {
  ALL_SPELLS: any[];
  ALL_FEATS: any[];
  ALL_SPECIES: any[];
  ALL_CONDITIONS: any[];
  ALL_SENSES: any[];
  ALL_SKILLS: any[];
  ALL_VARIANT_RULES: any[];
  ALL_OPTIONAL_FEATURES: any[];
  ALL_JSON_BACKGROUNDS: any[];
  ALL_ITEMS_BASE: any[];
  ITEM_TEMPLATES: any[];
  SCHOOL_NAMES: Record<string, string>;
  FEAT_CATEGORY_NAMES: Record<string, string>;
  SIZE_NAMES: Record<string, string>;
  RULE_TYPE_NAMES: Record<string, string>;
  FEATURE_TYPE_NAMES: Record<string, string>;
  ABILITY_ABBR_NAMES: Record<string, string>;
  EntryRenderer: React.FC<any>;
}

export const Glossary: React.FC<GlossaryProps> = ({ onBack }) => {
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<{ type: string; data: any } | null>(null);
  const [data, setData] = useState<LoadedData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ─── Ленивая загрузка модулей данных (последовательно) ───
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Импортируем модули и вызываем init() для загрузки JSON файлов
        // Каждый модуль использует ленивый import.meta.glob()
        const spells = await import('../data/spells');
        await spells.init();
        if (cancelled) return;

        const feats = await import('../data/feats');
        await feats.init();
        if (cancelled) return;

        const species = await import('../data/species');
        await species.init();
        if (cancelled) return;

        const conditions = await import('../data/conditionsdiseases');
        await conditions.init();
        if (cancelled) return;

        const senses = await import('../data/senses');
        await senses.init();
        if (cancelled) return;

        const skills = await import('../data/skills');
        await skills.init();
        if (cancelled) return;

        const variantrule = await import('../data/variantrule');
        await variantrule.init();
        if (cancelled) return;

        const optfeatures = await import('../data/optionalfeatures');
        await optfeatures.init();
        if (cancelled) return;

        const backgrounds = await import('../data/backgrounds/jsonBackgrounds');
        await backgrounds.init();
        if (cancelled) return;

        const itemsBase = await import('../data/items-base');
        await itemsBase.init();
        if (cancelled) return;

        const items = await import('../data/items');
        // items не использует glob
        if (cancelled) return;

        const entryRenderer = await import('../utils/entryRenderer');
        if (cancelled) return;

        setData({
          ALL_SPELLS: spells.ALL_SPELLS,
          ALL_FEATS: feats.ALL_FEATS,
          ALL_SPECIES: species.ALL_SPECIES,
          ALL_CONDITIONS: conditions.ALL_CONDITIONS,
          ALL_SENSES: senses.ALL_SENSES,
          ALL_SKILLS: skills.ALL_SKILLS,
          ALL_VARIANT_RULES: variantrule.ALL_VARIANT_RULES,
          ALL_OPTIONAL_FEATURES: optfeatures.ALL_OPTIONAL_FEATURES,
          ALL_JSON_BACKGROUNDS: backgrounds.ALL_JSON_BACKGROUNDS,
          ALL_ITEMS_BASE: itemsBase.ALL_ITEMS_BASE,
          ITEM_TEMPLATES: items.ITEM_TEMPLATES,
          SCHOOL_NAMES: spells.SCHOOL_NAMES,
          FEAT_CATEGORY_NAMES: feats.FEAT_CATEGORY_NAMES,
          SIZE_NAMES: species.SIZE_NAMES,
          RULE_TYPE_NAMES: variantrule.RULE_TYPE_NAMES,
          FEATURE_TYPE_NAMES: optfeatures.FEATURE_TYPE_NAMES,
          ABILITY_ABBR_NAMES: skills.ABILITY_ABBR_NAMES,
          EntryRenderer: entryRenderer.EntryRenderer,
        });
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load glossary data:', err);
        setLoadError(err?.message || 'Не удалось загрузить данные');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ─── Показываем загрузку, пока данные не подтянулись ───
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-400 text-lg">Ошибка загрузки: {loadError}</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          Назад
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white text-xl font-medieval animate-pulse">Загрузка базы знаний...</div>
      </div>
    );
  }

  // ─── Данные загружены, рендерим глоссарий ───
  return <GlossaryContent data={data} onBack={onBack} />;
};

// ─── Внутренний компонент (рендерится только когда данные готовы) ───
const GlossaryContent: React.FC<{
  data: LoadedData;
  onBack: () => void;
}> = ({ data, onBack }) => {
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<{ type: string; data: any } | null>(null);

  const { EntryRenderer } = data;

  const categories: CategoryConfig[] = useMemo(() => [
    { key: 'spells', label: 'Заклинания', icon: Wand2, count: data.ALL_SPELLS.length },
    { key: 'feats', label: 'Черты', icon: Star, count: data.ALL_FEATS.length },
    { key: 'species', label: 'Виды', icon: Sparkles, count: data.ALL_SPECIES.length },
    { key: 'backgrounds', label: 'Предыстории', icon: BookOpen, count: data.ALL_JSON_BACKGROUNDS.length },
    { key: 'conditions', label: 'Состояния и болезни', icon: Shield, count: data.ALL_CONDITIONS.length },
    { key: 'senses', label: 'Чувства', icon: Eye, count: data.ALL_SENSES.length },
    { key: 'skills', label: 'Навыки', icon: Brain, count: data.ALL_SKILLS.length },
    { key: 'rules', label: 'Правила', icon: Scroll, count: data.ALL_VARIANT_RULES.length },
    { key: 'optionalfeatures', label: 'Особые способности', icon: Swords, count: data.ALL_OPTIONAL_FEATURES.length },
    { key: 'items', label: 'Предметы', icon: Shield, count: data.ITEM_TEMPLATES.length + data.ALL_ITEMS_BASE.length },
  ], [data]);

  // Фильтрованный список по категории и поиску
  const filteredItems = useMemo(() => {
    if (!activeCategory) return [];
    const q = searchQuery.toLowerCase().trim();

    const filterByName = (items: { name: string }[]) =>
      q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;

    switch (activeCategory) {
      case 'spells': return filterByName(data.ALL_SPELLS);
      case 'feats': return filterByName(data.ALL_FEATS);
      case 'species': return filterByName(data.ALL_SPECIES);
      case 'backgrounds': return filterByName(data.ALL_JSON_BACKGROUNDS);
      case 'conditions': return filterByName(data.ALL_CONDITIONS);
      case 'senses': return filterByName(data.ALL_SENSES);
      case 'skills': return filterByName(data.ALL_SKILLS);
      case 'rules': return filterByName(data.ALL_VARIANT_RULES);
      case 'optionalfeatures': return filterByName(data.ALL_OPTIONAL_FEATURES);
      case 'items': {
        const allItems = [
          ...data.ITEM_TEMPLATES.map((t: any) => ({ name: t.name, source: t.raw.source, _type: 'template' as const, data: t })),
          ...data.ALL_ITEMS_BASE.map((b: any) => ({ name: b.name, source: b.source, _type: 'base' as const, data: b })),
        ];
        return q ? allItems.filter(i => i.name.toLowerCase().includes(q)) : allItems;
      }
      default: return [];
    }
  }, [activeCategory, searchQuery, data]);

  // Обработка навигации по тегам из EntryRenderer
  const handleNavigate = (entry: RegistryEntry) => {
    setSelectedEntry({ type: entry.type, data: entry.data });
  };

  // Получить subtitle для элемента списка
  const getItemSubtitle = (item: any): string => {
    if (!activeCategory) return '';
    switch (activeCategory) {
      case 'spells': {
        const level = item.level === 0 ? 'Заговор' : `${item.level} ур.`;
        const school = data.SCHOOL_NAMES[item.school] || item.school;
        return `${level} • ${school}`;
      }
      case 'feats':
        return data.FEAT_CATEGORY_NAMES[item.category || ''] || item.source || '';
      case 'species': {
        const sizes = item.size?.map((s: string) => data.SIZE_NAMES[s] || s).join('/') || '';
        return `${sizes} • ${item.source}`;
      }
      case 'backgrounds':
        return item.source || '';
      case 'conditions':
        return item.source || '';
      case 'senses':
        return item.source || '';
      case 'skills':
        return data.ABILITY_ABBR_NAMES[item.ability] || item.ability || '';
      case 'rules':
        return data.RULE_TYPE_NAMES[item.ruleType || ''] || item.source || '';
      case 'optionalfeatures': {
        const types = item.featureType?.map((t: string) => data.FEATURE_TYPE_NAMES[t] || t).join(', ');
        return types || item.source || '';
      }
      case 'items':
        return item.source || '';
      default: return '';
    }
  };

  // Получить entries для выбранного элемента
  const getEntries = (item: any): any[] => {
    if (!activeCategory) return [];
    switch (activeCategory) {
      case 'items': {
        if (item._type === 'template') {
          return item.data?.raw?.entries || [];
        }
        return item.data?.entries || item.data?.entriesTemplate || [];
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
    const d = selectedEntry.data;
    const entries = d.entries || d.raw?.entries || [];

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl border-2 border-dnd-secondary max-w-3xl w-full max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-medieval text-dnd-secondary">{d.name || 'Запись'}</h2>
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
              {d.source && (
                <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">
                  {d.source}
                </span>
              )}
              {d.level !== undefined && (
                <span className="px-2 py-1 bg-purple-900/40 text-purple-300 rounded text-xs">
                  {d.level === 0 ? 'Заговор' : `${d.level} уровень`}
                </span>
              )}
              {d.school && (
                <span className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs">
                  {data.SCHOOL_NAMES[d.school] || d.school}
                </span>
              )}
              {d.category && (
                <span className="px-2 py-1 bg-green-900/40 text-green-300 rounded text-xs">
                  {data.FEAT_CATEGORY_NAMES[d.category] || d.category}
                </span>
              )}
              {d.ruleType && (
                <span className="px-2 py-1 bg-yellow-900/40 text-yellow-300 rounded text-xs">
                  {data.RULE_TYPE_NAMES[d.ruleType] || d.ruleType}
                </span>
              )}
              {d.featureType?.map((ft: string) => (
                <span key={ft} className="px-2 py-1 bg-red-900/40 text-red-300 rounded text-xs">
                  {data.FEATURE_TYPE_NAMES[ft] || ft}
                </span>
              ))}
            </div>

            {/* Для заклинаний — дополнительная информация */}
            {selectedEntry.type === 'spell' && renderSpellMeta(d)}

            {/* Fluff (описание предыстории) */}
            {d.fluff && Array.isArray(d.fluff) && d.fluff.length > 0 && (
              <div className="mb-4 text-gray-300 italic text-sm leading-relaxed">
                {d.fluff.map((text: string, i: number) => (
                  <p key={i} className="mb-2">{text}</p>
                ))}
              </div>
            )}

            {/* Entries */}
            {entries.length > 0 && (
              <EntryRenderer
                entries={entries}
                context={d.name || ''}
                onNavigate={handleNavigate}
              />
            )}

            {/* EntriesHigherLevel для заклинаний */}
            {d.entriesHigherLevel && d.entriesHigherLevel.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <EntryRenderer
                  entries={d.entriesHigherLevel}
                  context={d.name || ''}
                  onNavigate={handleNavigate}
                />
              </div>
            )}

            {/* Для заклинаний — классы */}
            {d.classes?.fromClassList && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm text-gray-400 mb-2">Доступно классам:</h4>
                <div className="flex flex-wrap gap-1">
                  {d.classes.fromClassList.map((c: any, i: number) => (
                    <span key={i} className="px-2 py-1 bg-dnd-primary/30 text-red-300 rounded text-xs">
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Предпосылки для черт */}
            {d.prerequisite && d.prerequisite.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm text-gray-400 mb-2">Предпосылки:</h4>
                <div className="text-sm text-gray-300">
                  {d.prerequisite.map((p: any, i: number) => (
                    <div key={i}>
                      {p.level && <span>Уровень {typeof p.level === 'object' ? p.level.level : p.level}</span>}
                      {p.ability && p.ability.map((a: any, j: number) => (
                        <span key={j} className="ml-2">
                          {Object.entries(a).map(([k, v]) => `${data.ABILITY_ABBR_NAMES[k] || k} ${v}`).join(', ')}
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
  const renderSpellMeta = (spell: any) => {
    const timeStr = spell.time?.map((t: any) => `${t.number} ${t.unit === 'action' ? 'действие' : t.unit === 'bonus' ? 'бонус. действие' : t.unit === 'reaction' ? 'реакция' : t.unit === 'minute' ? 'мин.' : t.unit}`).join(', ');

    const rangeStr = spell.range?.distance?.amount
      ? `${spell.range.distance.amount} ${spell.range.distance.type === 'feet' ? 'фт.' : spell.range.distance.type === 'miles' ? 'миль' : spell.range.distance.type}`
      : spell.range?.type === 'touch' ? 'Касание' : spell.range?.type === 'self' ? 'На себя' : spell.range?.type || '';

    const componentsStr = [
      spell.components?.v ? 'В' : '',
      spell.components?.s ? 'С' : '',
      spell.components?.m ? `М (${typeof spell.components.m === 'string' ? spell.components.m : typeof spell.components.m === 'object' && spell.components.m && 'text' in spell.components.m ? spell.components.m.text : ''})` : '',
    ].filter(Boolean).join(', ');

    const durationStr = spell.duration?.map((d: any) => {
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
                data: activeCategory === 'items' ? item.data : item,
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
