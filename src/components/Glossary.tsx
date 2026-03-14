import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, ArrowLeft, BookOpen, Sparkles, Swords, Shield, Eye, Brain, Scroll, Star, Wand2, ChevronRight, X, Loader2 } from 'lucide-react';

// ─── Типы ───
interface RegistryEntry {
  type: string;
  name: string;
  source?: string;
  entries?: any[];
  data: any;
}

type GlossaryCategory =
  | 'spells' | 'feats' | 'species' | 'backgrounds' | 'conditions'
  | 'senses' | 'skills' | 'rules' | 'optionalfeatures' | 'items'
  | 'classes' | 'subclasses' | 'charoptions';

interface CategoryConfig {
  key: GlossaryCategory;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

interface GlossaryProps {
  onBack: () => void;
  activeCategory?: string | null;
  onCategoryChange?: (category: string) => void;
}

// ─── Кеш загруженных данных по категориям ───
interface CategoryData {
  items: any[];
  constants: Record<string, any>;
}

const categoryCache: Partial<Record<GlossaryCategory, CategoryData>> = {};
let entryRendererCache: { EntryRenderer: React.FC<any>; registerLoadedData: (type: string, items: any[]) => void } | null = null;

// ─── Загрузчики категорий (ленивая загрузка по запросу) ───
async function loadCategory(category: GlossaryCategory): Promise<CategoryData> {
  if (categoryCache[category]) {
    return categoryCache[category]!;
  }

  let result: CategoryData;

  switch (category) {
    case 'spells': {
      const mod = await import('../data/spells');
      await mod.init();
      result = {
        items: mod.ALL_SPELLS,
        constants: { SCHOOL_NAMES: mod.SCHOOL_NAMES },
      };
      break;
    }
    case 'feats': {
      const mod = await import('../data/feats');
      await mod.init();
      result = {
        items: mod.ALL_FEATS,
        constants: { FEAT_CATEGORY_NAMES: mod.FEAT_CATEGORY_NAMES },
      };
      break;
    }
    case 'species': {
      const mod = await import('../data/species');
      await mod.init();
      result = {
        items: mod.ALL_SPECIES,
        constants: { SIZE_NAMES: mod.SIZE_NAMES },
      };
      break;
    }
    case 'backgrounds': {
      const mod = await import('../data/backgrounds/jsonBackgrounds');
      await mod.init();
      result = { items: mod.ALL_JSON_BACKGROUNDS, constants: {} };
      break;
    }
    case 'conditions': {
      const mod = await import('../data/conditionsdiseases');
      await mod.init();
      result = { items: mod.ALL_CONDITIONS, constants: {} };
      break;
    }
    case 'senses': {
      const mod = await import('../data/senses');
      await mod.init();
      result = { items: mod.ALL_SENSES, constants: {} };
      break;
    }
    case 'skills': {
      const mod = await import('../data/skills');
      await mod.init();
      result = {
        items: mod.ALL_SKILLS,
        constants: { ABILITY_ABBR_NAMES: mod.ABILITY_ABBR_NAMES },
      };
      break;
    }
    case 'rules': {
      const mod = await import('../data/variantrule');
      await mod.init();
      result = {
        items: mod.ALL_VARIANT_RULES,
        constants: { RULE_TYPE_NAMES: mod.RULE_TYPE_NAMES },
      };
      break;
    }
    case 'optionalfeatures': {
      const mod = await import('../data/optionalfeatures');
      await mod.init();
      result = {
        items: mod.ALL_OPTIONAL_FEATURES,
        constants: { FEATURE_TYPE_NAMES: mod.FEATURE_TYPE_NAMES },
      };
      break;
    }
    case 'items': {
      const [itemsBase, items] = await Promise.all([
        import('../data/items-base'),
        import('../data/items'),
      ]);
      await Promise.all([itemsBase.init(), items.init()]);
      // Merge priority: ALL_ITEMS (root, with descriptions) > ITEM_TEMPLATES (subfolder, with generated stats) > ALL_ITEMS_BASE
      const seen = new Set<string>();
      const allItems: any[] = [];
      for (const item of items.ALL_ITEMS) {
        const key = item.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          allItems.push(item);
        }
      }
      for (const t of items.ITEM_TEMPLATES) {
        const key = t.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          // Convert template back to raw-like format so Glossary can display it uniformly
          allItems.push({ ...t.raw, _description: t.description });
        }
      }
      for (const item of itemsBase.ALL_ITEMS_BASE) {
        const key = item.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          allItems.push(item);
        }
      }
      result = { items: allItems, constants: {} };
      break;
    }
    case 'classes': {
      const mod = await import('../data/classes/classJsonLoader');
      await mod.init();
      result = { items: mod.ALL_CLASS_DATA, constants: {} };
      break;
    }
    case 'subclasses': {
      const mod = await import('../data/classes/subclassJsonLoader');
      await mod.init();
      result = { items: mod.ALL_SUBCLASS_DATA, constants: {} };
      break;
    }
    case 'charoptions': {
      const mod = await import('../data/charactercreationoptions');
      await mod.init();
      result = {
        items: mod.ALL_CHARACTER_CREATION_OPTIONS,
        constants: { OPTION_TYPE_NAMES: mod.OPTION_TYPE_NAMES },
      };
      break;
    }
    default:
      result = { items: [], constants: {} };
  }

  categoryCache[category] = result;

  // Регистрируем загруженные данные для поиска по тегам
  if (entryRendererCache) {
    entryRendererCache.registerLoadedData(category, result.items);
  }

  return result;
}

async function loadEntryRenderer(): Promise<React.FC<any>> {
  if (entryRendererCache) return entryRendererCache.EntryRenderer;
  const mod = await import('../utils/entryRenderer');
  entryRendererCache = {
    EntryRenderer: mod.EntryRenderer,
    registerLoadedData: mod.registerLoadedData,
  };

  // Регистрируем уже закешированные данные
  for (const [category, data] of Object.entries(categoryCache)) {
    mod.registerLoadedData(category, data.items);
  }

  return entryRendererCache.EntryRenderer;
}

// ─── Список подклассов внутри деталей класса ───
const SubclassListForClass: React.FC<{
  classId: string;
  selectedSubclassId?: string | null;
  onSelect: (sub: any) => void;
}> = ({ classId, selectedSubclassId, onSelect }) => {
  const [subclasses, setSubclasses] = React.useState<any[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    import('../data/classes/subclassJsonLoader').then(async mod => {
      await mod.init();
      if (!cancelled) {
        setSubclasses(mod.getSubclassesByClass(classId));
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [classId]);

  if (!loaded) {
    return <div className="text-sm text-text-muted animate-pulse py-2">Загрузка подклассов...</div>;
  }
  if (subclasses.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
        <Shield size={14} />
        Подклассы ({subclasses.length})
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {subclasses.map(sub => {
          const isActive = selectedSubclassId === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => onSelect(sub)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                isActive
                  ? 'border-gold bg-gold/5 ring-1 ring-gold/30'
                  : 'border-border-default glass-panel hover:border-gold/50 hover:bg-gold/5'
              }`}
            >
              <div className={`text-sm font-medium ${isActive ? 'text-gold' : 'text-text-primary'}`}>{sub.name}</div>
              {sub.shortDescription && (
                <div className="text-xs text-text-secondary mt-1 line-clamp-2">{sub.shortDescription}</div>
              )}
              <div className="text-xs text-text-muted mt-1">ур. {sub.level} • {sub.source}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Конфигурация категорий ───
const CATEGORIES: CategoryConfig[] = [
  { key: 'spells', label: 'Заклинания', icon: Wand2 },
  { key: 'feats', label: 'Черты', icon: Star },
  { key: 'species', label: 'Виды', icon: Sparkles },
  { key: 'backgrounds', label: 'Предыстории', icon: BookOpen },
  { key: 'conditions', label: 'Состояния', icon: Shield },
  { key: 'senses', label: 'Чувства', icon: Eye },
  { key: 'skills', label: 'Навыки', icon: Brain },
  { key: 'rules', label: 'Правила', icon: Scroll },
  { key: 'optionalfeatures', label: 'Способности', icon: Swords },
  { key: 'items', label: 'Предметы', icon: Shield },
  { key: 'classes', label: 'Классы', icon: Swords },
  { key: 'subclasses', label: 'Подклассы', icon: Shield },
  { key: 'charoptions', label: 'Опции создания', icon: Sparkles },
];

export const Glossary: React.FC<GlossaryProps> = ({ onBack, activeCategory: externalCategory, onCategoryChange }) => {
  const [internalCategory, setInternalCategory] = useState<GlossaryCategory | null>(null);
  const activeCategory = (externalCategory as GlossaryCategory | null) ?? internalCategory;
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<{ type: string; data: any } | null>(null);
  const [EntryRenderer, setEntryRenderer] = useState<React.FC<any> | null>(null);
  const [selectedSubclass, setSelectedSubclass] = useState<any | null>(null);

  // Загрузка категории при выборе
  const selectCategory = useCallback(async (category: GlossaryCategory) => {
    setInternalCategory(category);
    onCategoryChange?.(category);
    setSearchQuery('');
    setSelectedEntry(null);
    setSelectedSubclass(null);
    setLoading(true);
    setLoadError(null);

    try {
      const [data, renderer] = await Promise.all([
        loadCategory(category),
        loadEntryRenderer(),
      ]);
      setCategoryData(data);
      setEntryRenderer(() => renderer);
    } catch (err: any) {
      console.error('Failed to load category:', err);
      setLoadError(err?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [onCategoryChange]);

  // React to external category changes from TopNavBar sub-tabs
  useEffect(() => {
    if (externalCategory && externalCategory !== internalCategory) {
      selectCategory(externalCategory as GlossaryCategory);
    }
  }, [externalCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Назад к списку категорий
  const goBackToCategories = useCallback(() => {
    setInternalCategory(null);
    onCategoryChange?.(null as any);
    setCategoryData(null);
    setSearchQuery('');
    setSelectedEntry(null);
    setSelectedSubclass(null);
    setLoadError(null);
  }, [onCategoryChange]);

  // Фильтрованный список
  const filteredItems = useMemo(() => {
    if (!categoryData) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return categoryData.items;
    return categoryData.items.filter((item: any) =>
      item.name?.toLowerCase().includes(q)
    );
  }, [categoryData, searchQuery]);

  // Получить subtitle для элемента
  const getItemSubtitle = (item: any): string => {
    if (!activeCategory || !categoryData) return '';
    const { constants } = categoryData;

    switch (activeCategory) {
      case 'spells': {
        const level = item.level === 0 ? 'Заговор' : `${item.level} ур.`;
        const school = constants.SCHOOL_NAMES?.[item.school] || item.school;
        return `${level} • ${school}`;
      }
      case 'feats':
        return constants.FEAT_CATEGORY_NAMES?.[item.category || ''] || item.source || '';
      case 'species': {
        const sizes = item.size?.map((s: string) => constants.SIZE_NAMES?.[s] || s).join('/') || '';
        return `${sizes} • ${item.source}`;
      }
      case 'skills':
        return constants.ABILITY_ABBR_NAMES?.[item.ability] || item.ability || '';
      case 'rules':
        return constants.RULE_TYPE_NAMES?.[item.ruleType || ''] || item.source || '';
      case 'optionalfeatures': {
        const types = item.featureType?.map((t: string) => constants.FEATURE_TYPE_NAMES?.[t] || t).join(', ');
        return types || item.source || '';
      }
      case 'classes':
        return `${item.hitDie || ''} • ${item.source || ''}`;
      case 'subclasses':
        return `${item.classId || ''} • ур. ${item.level || '?'} • ${item.source || ''}`;
      case 'charoptions': {
        const optTypes = item.optionType?.map((t: string) => constants.OPTION_TYPE_NAMES?.[t] || t).join(', ');
        return optTypes || item.source || '';
      }
      default:
        return item.source || '';
    }
  };

  // Обработка навигации по тегам
  const handleNavigate = useCallback((entry: RegistryEntry) => {
    setSelectedEntry({ type: entry.type, data: entry.data });
  }, []);

  // ─── Форматирование данных заклинания ───
  const formatSpellTime = (time: any[]): string => {
    if (!time?.length) return '';
    return time.map(t => {
      const num = t.number || 1;
      const units: Record<string, string> = {
        action: 'действие',
        bonus: 'бонусное действие',
        reaction: 'реакция',
        minute: num === 1 ? 'минута' : 'минут',
        hour: num === 1 ? 'час' : 'часов',
      };
      const unit = units[t.unit] || t.unit;
      if (t.unit === 'action' || t.unit === 'bonus' || t.unit === 'reaction') {
        return `1 ${unit}`;
      }
      return `${num} ${unit}`;
    }).join(' или ');
  };

  const formatSpellRange = (range: any): string => {
    if (!range) return 'Не указана';
    if (typeof range === 'string') return range;
    if (typeof range === 'number') return `${range} футов`;
    if (range.type === 'special') return 'Особая';
    if (range.type === 'sight') return 'В пределах видимости';
    if (range.type === 'unlimited') return 'Неограниченная';
    if (range.type === 'self') {
      if (range.distance?.type === 'radius') return `На себя (радиус ${range.distance.amount} фт.)`;
      if (range.distance?.type === 'cone') return `На себя (конус ${range.distance.amount} фт.)`;
      if (range.distance?.type === 'line') return `На себя (линия ${range.distance.amount} фт.)`;
      if (range.distance?.type === 'sphere') return `На себя (сфера ${range.distance.amount} фт.)`;
      return 'На себя';
    }
    if (range.type === 'touch') return 'Касание';
    if (range.type === 'point' && range.distance) {
      const amt = range.distance.amount;
      if (range.distance.type === 'feet') return `${amt} фт.`;
      if (range.distance.type === 'miles') return `${amt} миль`;
      if (range.distance.type === 'self') return 'На себя';
      return `${amt} ${range.distance.type}`;
    }
    // Fallback для любых других форматов
    if (range.distance?.amount) return `${range.distance.amount} фт.`;
    return JSON.stringify(range);
  };

  const formatSpellComponents = (comp: any): string => {
    if (!comp) return '';
    const parts: string[] = [];
    if (comp.v) parts.push('В');
    if (comp.s) parts.push('С');
    if (comp.m) {
      const mat = typeof comp.m === 'string' ? comp.m : comp.m?.text || '';
      if (mat) {
        const cost = comp.m?.cost ? ` (${comp.m.cost / 100} зм)` : '';
        const consumed = comp.m?.consume ? ' (расходуется)' : '';
        parts.push(`М (${mat}${cost}${consumed})`);
      } else {
        parts.push('М');
      }
    }
    return parts.join(', ');
  };

  const formatSpellDuration = (duration: any[]): string => {
    if (!duration?.length) return '';
    return duration.map(d => {
      if (d.type === 'instant') return 'Мгновенная';
      if (d.type === 'permanent') {
        const ends = d.ends?.join(', ') || '';
        return ends ? `Пока не ${ends}` : 'Постоянная';
      }
      if (d.type === 'special') return 'Особая';
      if (d.type === 'timed' && d.duration) {
        const units: Record<string, string> = {
          round: d.duration.amount === 1 ? 'раунд' : 'раундов',
          minute: d.duration.amount === 1 ? 'минута' : 'минут',
          hour: d.duration.amount === 1 ? 'час' : 'часов',
          day: d.duration.amount === 1 ? 'день' : 'дней',
        };
        const conc = d.concentration ? 'Концентрация, ' : '';
        return `${conc}${d.duration.amount} ${units[d.duration.type] || d.duration.type}`;
      }
      return '';
    }).filter(Boolean).join(' или ');
  };

  // ─── Форматирование требований черты ───
  const formatPrerequisite = (prereq: any[]): string => {
    if (!prereq?.length) return '';
    return prereq.map((p: any) => {
      const parts: string[] = [];
      // Уровень - может быть числом или объектом
      if (p.level) {
        if (typeof p.level === 'number') {
          const cls = p.class ? ` ${p.class.name}` : '';
          parts.push(`${p.level}+ уровень${cls}`);
        } else if (typeof p.level === 'object' && p.level.level) {
          const lvl = p.level.level;
          const cls = p.level.class?.name ? ` ${p.level.class.name}` : '';
          parts.push(`${lvl}+ уровень${cls}`);
        }
      }
      if (p.ability) {
        const abilities: Record<string, string> = {
          str: 'Сила', dex: 'Ловкость', con: 'Телосложение',
          int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма',
        };
        const abReqs = p.ability.map((ab: any) =>
          Object.entries(ab).map(([k, v]) => `${abilities[k] || k} ${v}+`).join(', ')
        ).join(' или ');
        if (abReqs) parts.push(abReqs);
      }
      if (p.spellcasting) parts.push('Умение накладывать заклинания');
      if (p.spellcastingFeature) parts.push('Умение накладывать заклинания');
      if (p.pact) parts.push(`Пакт: ${p.pact}`);
      if (p.patron) parts.push(`Покровитель: ${p.patron}`);
      if (p.spell) {
        // Требуется заклинание
        const spells = p.spell.map((s: any) => {
          if (typeof s === 'string') return s.split('|')[0];
          if (s.entry) return s.entry;
          if (s.entrySummary) return s.entrySummary;
          return '';
        }).filter(Boolean);
        if (spells.length > 0) parts.push(spells.join(', '));
      }
      if (p.race) {
        const races = p.race.map((r: any) => r.name || r).join(' или ');
        parts.push(`Раса: ${races}`);
      }
      if (p.feat) {
        const feats = p.feat.map((f: any) => typeof f === 'string' ? f.split('|')[0] : f).join(', ');
        parts.push(`Черта: ${feats}`);
      }
      if (p.proficiency) {
        const profs = p.proficiency.map((pr: any) =>
          Object.entries(pr).map(([k]) => k).join(', ')
        ).join(', ');
        if (profs) parts.push(`Владение: ${profs}`);
      }
      if (p.other) parts.push(p.other);
      return parts.join(', ');
    }).filter(Boolean).join('; ');
  };

  // ─── Форматирование бонусов характеристик (для черт и предысторий) ───
  const formatAbilityBonus = (ability: any[]): string => {
    if (!ability?.length) return '';
    const abilities: Record<string, string> = {
      str: 'Сила', dex: 'Ловкость', con: 'Телосложение',
      int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма',
    };
    return ability.map((a: any) => {
      // Выбор из нескольких
      if (a.choose) {
        if (a.choose.from) {
          const opts = a.choose.from.map((ab: string) => abilities[ab] || ab).join('/');
          const count = a.choose.count || 1;
          const amount = a.choose.amount || 1;
          return `+${amount} к одной из: ${opts}${count > 1 ? ` (${count} раза)` : ''}`;
        }
        if (a.choose.weighted?.from) {
          const opts = a.choose.weighted.from.map((ab: string) => abilities[ab] || ab).join('/');
          return `Выбор из: ${opts}`;
        }
        return 'Выбор характеристики';
      }
      // Фиксированные бонусы
      const fixed = Object.entries(a)
        .filter(([k]) => ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(k))
        .map(([k, v]) => `${abilities[k]} +${v}`)
        .join(', ');
      return fixed;
    }).filter(Boolean).join('; ');
  };

  // ─── Рендеринг выбранного элемента ───
  const renderDetail = () => {
    if (!selectedEntry || !EntryRenderer) return null;
    const d = selectedEntry.data;
    const type = activeCategory;
    const constants = categoryData?.constants || {};

    // Получаем entries из разных источников
    let entries: any[] = [];
    if (d.entries) entries = d.entries;
    else if (d.raw?.entries) entries = d.raw.entries;
    else if (d.entriesTemplate) entries = d.entriesTemplate;

    // Для классов — показываем classFeatures как entries, с объединением подкласса если выбран
    if (type === 'classes' && d.classFeatures && !entries.length) {
      const isPlaceholder = (name: string) =>
        name === 'Subclass Feature' || name.endsWith(' Subclass');

      if (selectedSubclass) {
        // Объединённый вид: заменяем плейсхолдеры реальными фичами подкласса
        const subFeaturesByLevel = new Map<number, any[]>();
        for (const f of selectedSubclass.features) {
          const arr = subFeaturesByLevel.get(f.level) || [];
          arr.push(f);
          subFeaturesByLevel.set(f.level, arr);
        }

        entries = [];
        for (const f of d.classFeatures) {
          if (isPlaceholder(f.name)) {
            const subFeats = subFeaturesByLevel.get(f.level) || [];
            for (const sf of subFeats) {
              entries.push({
                type: 'entries',
                name: `${sf.name} (ур. ${sf.level}) — ${selectedSubclass.name}`,
                entries: [sf.description, ...(sf.details ? Object.values(sf.details).filter(Boolean) : [])],
                _isSubclass: true,
              });
            }
            subFeaturesByLevel.delete(f.level);
          } else {
            entries.push({
              type: 'entries',
              name: `${f.name} (ур. ${f.level})`,
              entries: [f.description, ...(f.details ? Object.values(f.details) : [])],
            });
          }
        }
        // Добавить оставшиеся фичи подкласса, не попавшие в плейсхолдеры
        for (const [, feats] of subFeaturesByLevel) {
          for (const sf of feats) {
            entries.push({
              type: 'entries',
              name: `${sf.name} (ур. ${sf.level}) — ${selectedSubclass.name}`,
              entries: [sf.description, ...(sf.details ? Object.values(sf.details).filter(Boolean) : [])],
              _isSubclass: true,
            });
          }
        }
        // Сортируем по уровню
        entries.sort((a: any, b: any) => {
          const lvlA = parseInt(a.name.match(/ур\. (\d+)/)?.[1] || '0');
          const lvlB = parseInt(b.name.match(/ур\. (\d+)/)?.[1] || '0');
          return lvlA - lvlB;
        });
      } else {
        // Без подкласса — скрываем плейсхолдеры
        entries = d.classFeatures
          .filter((f: any) => !isPlaceholder(f.name))
          .map((f: any) => ({
            type: 'entries',
            name: `${f.name} (ур. ${f.level})`,
            entries: [f.description, ...(f.details ? Object.values(f.details) : [])],
          }));
      }
    }

    if (type === 'subclasses' && d.features && !entries.length) {
      entries = d.features.map((f: any) => ({
        type: 'entries',
        name: `${f.name} (ур. ${f.level})`,
        entries: [f.description, ...(f.details ? Object.values(f.details).filter(Boolean) : [])],
      }));
    }

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl border-2 border-gold max-w-3xl w-full max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 bg-gray-900 border-b border-border-default p-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-medieval text-gold">{d.name || 'Запись'}</h2>
            <button onClick={() => setSelectedEntry(null)} className="text-text-secondary hover:text-text-primary">
              <X size={24} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            {/* Мета-информация (теги) */}
            <div className="flex flex-wrap gap-2">
              {d.source && (
                <span className="px-2 py-1 bg-bg-panel-solid text-text-primary rounded text-xs">{d.source}</span>
              )}
              {d.level !== undefined && type === 'spells' && (
                <span className="px-2 py-1 bg-purple-900/40 text-purple-300 rounded text-xs">
                  {d.level === 0 ? 'Заговор' : `${d.level} уровень`}
                </span>
              )}
              {d.school && (
                <span className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs">
                  {constants.SCHOOL_NAMES?.[d.school] || d.school}
                </span>
              )}
              {d.rarity && (
                <span className="px-2 py-1 bg-amber-900/40 text-amber-300 rounded text-xs">{d.rarity}</span>
              )}
              {d.category && type === 'feats' && (
                <span className="px-2 py-1 bg-green-900/40 text-green-300 rounded text-xs">
                  {constants.FEAT_CATEGORY_NAMES?.[d.category] || d.category}
                </span>
              )}
            </div>

            {/* ═══════════ ЗАКЛИНАНИЯ ═══════════ */}
            {type === 'spells' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div><span className="text-text-secondary">Время накладывания: </span><span className="text-text-primary">{formatSpellTime(d.time) || '—'}</span></div>
                  <div><span className="text-text-secondary">Дистанция: </span><span className="text-text-primary">{formatSpellRange(d.range)}</span></div>
                  <div><span className="text-text-secondary">Компоненты: </span><span className="text-text-primary">{formatSpellComponents(d.components) || '—'}</span></div>
                  <div><span className="text-text-secondary">Длительность: </span><span className="text-text-primary">{formatSpellDuration(d.duration) || '—'}</span></div>
                </div>
                {(d.savingThrow || d.damageInflict) && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-border-default">
                    {d.savingThrow && (
                      <div><span className="text-text-secondary">Спасбросок: </span><span className="text-text-primary">{d.savingThrow.join(', ')}</span></div>
                    )}
                    {d.damageInflict && (
                      <div><span className="text-text-secondary">Тип урона: </span><span className="text-text-primary">{d.damageInflict.join(', ')}</span></div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ ЧЕРТЫ ═══════════ */}
            {type === 'feats' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.prerequisite && d.prerequisite.length > 0 && (
                  <div><span className="text-text-secondary">Требования: </span><span className="text-text-primary">{formatPrerequisite(d.prerequisite)}</span></div>
                )}
                {d.ability && d.ability.length > 0 && (
                  <div><span className="text-text-secondary">Бонус характеристики: </span><span className="text-text-primary">
                    {formatAbilityBonus(d.ability)}
                  </span></div>
                )}
                {d.additionalSpells && (
                  <div><span className="text-text-secondary">Заклинания: </span><span className="text-text-primary">Да</span></div>
                )}
              </div>
            )}

            {/* ═══════════ ВИДЫ ═══════════ */}
            {type === 'species' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {d.size && (
                    <div><span className="text-text-secondary">Размер: </span><span className="text-text-primary">
                      {d.size.map((s: string) => constants.SIZE_NAMES?.[s] || s).join(' или ')}
                    </span></div>
                  )}
                  {d.speed !== undefined && (
                    <div><span className="text-text-secondary">Скорость: </span><span className="text-text-primary">
                      {typeof d.speed === 'number' ? `${d.speed} фт.` :
                        Object.entries(d.speed).map(([k, v]) => k === 'walk' ? `${v} фт.` : `${k}: ${v} фт.`).join(', ')}
                    </span></div>
                  )}
                  {d.darkvision && (
                    <div><span className="text-text-secondary">Тёмное зрение: </span><span className="text-text-primary">{d.darkvision} фт.</span></div>
                  )}
                  {d.creatureTypes && (
                    <div><span className="text-text-secondary">Тип существа: </span><span className="text-text-primary">{d.creatureTypes.join(', ')}</span></div>
                  )}
                </div>
                {d.resist && (
                  <div><span className="text-text-secondary">Сопротивление: </span><span className="text-text-primary">{d.resist.join(', ')}</span></div>
                )}
                {d.traitTags && (
                  <div><span className="text-text-secondary">Особенности: </span><span className="text-text-primary">{d.traitTags.join(', ')}</span></div>
                )}
              </div>
            )}

            {/* ═══════════ ПРЕДЫСТОРИИ ═══════════ */}
            {type === 'backgrounds' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.ability && d.ability.length > 0 && (
                  <div><span className="text-text-secondary">Характеристики: </span><span className="text-text-primary">{formatAbilityBonus(d.ability)}</span></div>
                )}
                {d.skillProficiencies && d.skillProficiencies.length > 0 && (
                  <div><span className="text-text-secondary">Навыки: </span><span className="text-text-primary">
                    {d.skillProficiencies.map((sp: any) => Object.keys(sp).filter(k => k !== 'choose').join(', ')).join('; ')}
                  </span></div>
                )}
                {d.toolProficiencies && d.toolProficiencies.length > 0 && (
                  <div><span className="text-text-secondary">Инструменты: </span><span className="text-text-primary">
                    {d.toolProficiencies.map((tp: any) => Object.keys(tp).filter(k => k !== 'choose').join(', ')).join('; ')}
                  </span></div>
                )}
                {d.languageProficiencies && d.languageProficiencies.length > 0 && (
                  <div><span className="text-text-secondary">Языки: </span><span className="text-text-primary">
                    {d.languageProficiencies.map((lp: any) => {
                      const langs = Object.entries(lp).filter(([k]) => k !== 'anyStandard' && k !== 'choose');
                      const anyCount = lp.anyStandard || lp.choose?.count || 0;
                      const fixed = langs.map(([k]) => k).join(', ');
                      const any = anyCount > 0 ? `+${anyCount} на выбор` : '';
                      return [fixed, any].filter(Boolean).join(', ');
                    }).join('; ')}
                  </span></div>
                )}
                {d.feats && d.feats.length > 0 && (
                  <div><span className="text-text-secondary">Черта: </span><span className="text-text-primary">
                    {d.feats.map((f: any) => Object.keys(f)[0]?.split('|')[0]).join(', ')}
                  </span></div>
                )}
                {d.startingEquipment && d.startingEquipment.length > 0 && (
                  <div className="pt-2 border-t border-border-default">
                    <span className="text-text-secondary">Начальное снаряжение: </span>
                    <span className="text-text-primary">
                      {d.startingEquipment.map((eq: any) => {
                        if (eq.A) {
                          return eq.A.map((item: any) => {
                            if (typeof item === 'string') return item;
                            if (item.item) return item.displayName || item.item.split('|')[0];
                            if (item.value) return `${item.value / 100} зм`;
                            return '';
                          }).filter(Boolean).join(', ');
                        }
                        return '';
                      }).filter(Boolean).join(' или ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ ПРЕДМЕТЫ ═══════════ */}
            {type === 'items' && (() => {
              const typeCode = (d.type || '').split('|')[0];
              const rarityLabel = d.rarity && d.rarity !== 'none' ? d.rarity : null;
              const dmgTypes: Record<string, string> = { S: 'рубящий', P: 'колющий', B: 'дробящий', F: 'огонь', C: 'холод', L: 'молния', T: 'яд', N: 'некротический', A: 'кислота', Y: 'психический', O: 'силовое поле' };
              const propNames: Record<string, string> = { F: 'Фехтовальное', L: 'Лёгкое', H: 'Тяжёлое', '2H': 'Двуручное', V: 'Универсальное', T: 'Метательное', AM: 'Боеприпас', LD: 'Перезарядка', R: 'Досягаемость', S: 'Особое' };
              return (
                <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                  {typeCode && <div><span className="text-text-secondary">Тип: </span><span className="text-text-primary">{typeCode}</span></div>}
                  {rarityLabel && <div><span className="text-text-secondary">Редкость: </span><span className="text-text-primary">{rarityLabel}</span></div>}
                  {d.weight != null && <div><span className="text-text-secondary">Вес: </span><span className="text-text-primary">{d.weight} фунт.</span></div>}
                  {d.value != null && <div><span className="text-text-secondary">Цена: </span><span className="text-text-primary">{d.value >= 100 ? `${d.value / 100} зм` : `${d.value} мм`}</span></div>}
                  {d.dmg1 && <div><span className="text-text-secondary">Урон: </span><span className="text-text-primary">{d.dmg1} {dmgTypes[d.dmgType] || d.dmgType || ''}{d.dmg2 ? ` (универсальное ${d.dmg2})` : ''}</span></div>}
                  {d.range && <div><span className="text-text-secondary">Дальность: </span><span className="text-text-primary">{d.range} фт.</span></div>}
                  {d.ac != null && <div><span className="text-text-secondary">КД: </span><span className="text-text-primary">{d.ac}</span></div>}
                  {d.property?.length > 0 && <div><span className="text-text-secondary">Свойства: </span><span className="text-text-primary">{d.property.map((p: string) => propNames[p.split('|')[0]] || p.split('|')[0]).join(', ')}</span></div>}
                  {d.reqAttune && <div><span className="text-text-secondary">Настройка: </span><span className="text-text-primary">{typeof d.reqAttune === 'string' ? d.reqAttune : 'Требуется'}</span></div>}
                  {d._description && !entries.length && <div className="text-text-primary pt-1">{d._description}</div>}
                </div>
              );
            })()}

            {/* ═══════════ СПОСОБНОСТИ (Optional Features) ═══════════ */}
            {type === 'optionalfeatures' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.featureType && (
                  <div><span className="text-text-secondary">Тип: </span><span className="text-text-primary">
                    {d.featureType.map((t: string) => constants.FEATURE_TYPE_NAMES?.[t] || t).join(', ')}
                  </span></div>
                )}
                {d.prerequisite && d.prerequisite.length > 0 && (
                  <div><span className="text-text-secondary">Требования: </span><span className="text-text-primary">{formatPrerequisite(d.prerequisite)}</span></div>
                )}
              </div>
            )}

            {/* ═══════════ СОСТОЯНИЯ ═══════════ */}
            {type === 'conditions' && d.type && (
              <div className="bg-bg-panel rounded-lg p-4 text-sm">
                <span className="text-text-secondary">Тип: </span><span className="text-text-primary">{d.type === 'condition' ? 'Состояние' : 'Болезнь'}</span>
              </div>
            )}

            {/* ═══════════ КЛАССЫ ═══════════ */}
            {type === 'classes' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.hitDie && (
                  <div><span className="text-text-secondary">Кость хитов: </span><span className="text-text-primary font-bold">{d.hitDie}</span></div>
                )}
                {d.primaryAbility && (
                  <div><span className="text-text-secondary">Основная характеристика: </span><span className="text-text-primary">{d.primaryAbility.join(', ')}</span></div>
                )}
                {d.savingThrows && (
                  <div><span className="text-text-secondary">Спасброски: </span><span className="text-text-primary">{d.savingThrows.join(', ')}</span></div>
                )}
                {d.spellcaster !== undefined && (
                  <div><span className="text-text-secondary">Заклинатель: </span><span className="text-text-primary">{d.spellcaster ? 'Да' : 'Нет'}</span></div>
                )}
                {d.proficiencies && (
                  <>
                    {d.proficiencies.armor?.length > 0 && (
                      <div><span className="text-text-secondary">Доспехи: </span><span className="text-text-primary">{d.proficiencies.armor.join(', ')}</span></div>
                    )}
                    {d.proficiencies.weapons?.length > 0 && (
                      <div><span className="text-text-secondary">Оружие: </span><span className="text-text-primary">{d.proficiencies.weapons.join(', ')}</span></div>
                    )}
                    {d.proficiencies.tools?.length > 0 && (
                      <div><span className="text-text-secondary">Инструменты: </span><span className="text-text-primary">{d.proficiencies.tools.join(', ')}</span></div>
                    )}
                  </>
                )}
                {d.description && (
                  <div className="pt-2 border-t border-border-default text-text-primary">{d.description}</div>
                )}
              </div>
            )}

            {/* Подклассы внутри деталей класса */}
            {type === 'classes' && d.id && (
              <SubclassListForClass
                classId={d.id}
                selectedSubclassId={selectedSubclass?.id}
                onSelect={(sub) => setSelectedSubclass((prev: any) => prev?.id === sub.id ? null : sub)}
              />
            )}

            {/* ═══════════ ПОДКЛАССЫ ═══════════ */}
            {type === 'subclasses' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.classId && (
                  <div><span className="text-text-secondary">Класс: </span><span className="text-text-primary">{d.classId}</span></div>
                )}
                {d.level && (
                  <div><span className="text-text-secondary">Уровень получения: </span><span className="text-text-primary">{d.level}</span></div>
                )}
                {d.source && (
                  <div><span className="text-text-secondary">Источник: </span><span className="text-text-primary">{d.source}</span></div>
                )}
                {d.shortDescription && (
                  <div className="text-text-primary italic mt-2">{d.shortDescription}</div>
                )}
              </div>
            )}

            {/* ═══════════ ОПЦИИ СОЗДАНИЯ ═══════════ */}
            {type === 'charoptions' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.optionType && (
                  <div><span className="text-text-secondary">Тип: </span><span className="text-text-primary">
                    {d.optionType.map((t: string) => constants.OPTION_TYPE_NAMES?.[t] || t).join(', ')}
                  </span></div>
                )}
              </div>
            )}

            {/* ═══════════ ОСНОВНОЙ КОНТЕНТ ═══════════ */}
            {entries.length > 0 && (
              <div className="prose prose-invert prose-sm max-w-none">
                {type === 'classes' && selectedSubclass ? (
                  entries.map((entry: any, i: number) => (
                    <div key={i} className={entry._isSubclass ? 'border-l-2 border-gold pl-3 my-2' : ''}>
                      <EntryRenderer entries={[entry]} context={d.name || ''} onNavigate={handleNavigate} />
                    </div>
                  ))
                ) : (
                  <EntryRenderer entries={entries} context={d.name || ''} onNavigate={handleNavigate} />
                )}
              </div>
            )}

            {/* EntriesHigherLevel для заклинаний */}
            {d.entriesHigherLevel?.length > 0 && (
              <div className="pt-4 border-t border-border-default">
                <h4 className="text-sm font-medium text-text-primary mb-2">На более высоких уровнях</h4>
                <EntryRenderer entries={d.entriesHigherLevel} context={d.name || ''} onNavigate={handleNavigate} />
              </div>
            )}

            {/* Fluff текст */}
            {d.fluff && (
              <div className="pt-4 border-t border-border-default">
                <div className="text-sm italic text-text-secondary">
                  {Array.isArray(d.fluff) ? (
                    <EntryRenderer entries={d.fluff} context={d.name || ''} onNavigate={handleNavigate} />
                  ) : typeof d.fluff === 'object' && d.fluff.entries ? (
                    <EntryRenderer entries={d.fluff.entries} context={d.name || ''} onNavigate={handleNavigate} />
                  ) : (
                    String(d.fluff)
                  )}
                </div>
              </div>
            )}

            {/* Классы для заклинаний */}
            {type === 'spells' && d.classes?.fromClassList && (
              <div className="pt-4 border-t border-border-default text-sm">
                <span className="text-text-secondary">Классы: </span>
                <span className="text-text-primary">{d.classes.fromClassList.map((c: any) => c.name).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Главный экран: список категорий ───
  if (!activeCategory) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </button>
          <h2 className="text-2xl font-medieval text-gold">База знаний</h2>
          <div className="w-24" />
        </div>

        <p className="text-text-secondary text-sm mb-4 text-center">
          Выберите категорию для просмотра. Данные загружаются по запросу.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const cached = categoryCache[cat.key];
            return (
              <button
                key={cat.key}
                onClick={() => selectCategory(cat.key)}
                className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border-default glass-panel hover:border-gold/50 hover:bg-gold/5 transition-all group"
              >
                <div className="w-14 h-14 rounded-full bg-bg-panel flex items-center justify-center group-hover:bg-gold/10 transition-colors">
                  <Icon size={28} className="text-text-secondary group-hover:text-gold transition-colors" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-text-primary group-hover:text-gold text-sm transition-colors">
                    {cat.label}
                  </div>
                  {cached && (
                    <div className="text-xs text-text-muted mt-1">{cached.items.length} записей</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Экран категории ───
  const activeCat = CATEGORIES.find(c => c.key === activeCategory);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBackToCategories} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
          <span>Категории</span>
        </button>
        <h2 className="text-xl font-medieval text-gold">
          {activeCat?.label || 'База знаний'}
          {categoryData && <span className="text-sm font-normal text-text-secondary ml-2">({filteredItems.length})</span>}
        </h2>
        <div className="w-24" />
      </div>

      {/* Состояние загрузки */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-gold" />
          <span className="ml-3 text-text-secondary">Загрузка данных...</span>
        </div>
      )}

      {/* Ошибка */}
      {loadError && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="text-red-bright">{loadError}</div>
          <button onClick={() => selectCategory(activeCategory)} className="px-4 py-2 bg-bg-panel-solid text-text-primary rounded hover:bg-gray-600">
            Повторить
          </button>
        </div>
      )}

      {/* Данные загружены */}
      {!loading && !loadError && categoryData && (
        <>
          {/* Поиск */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-bg-panel-solid border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-gold/50 transition-colors text-sm"
            />
          </div>

          {/* Список */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
            {filteredItems.map((item: any, index: number) => (
              <button
                key={`${item.name}-${index}`}
                onClick={() => { setSelectedEntry({ type: activeCategory, data: item }); setSelectedSubclass(null); }}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-bg-primary/40 hover:bg-bg-panel-solid border border-transparent hover:border-border-default transition-all text-left group"
              >
                <div className="min-w-0">
                  <div className="text-sm text-text-primary group-hover:text-gold font-medium truncate">
                    {item.name || 'Без названия'}
                  </div>
                  <div className="text-xs text-text-muted truncate">{getItemSubtitle(item)}</div>
                </div>
                <ChevronRight size={16} className="text-gray-600 group-hover:text-gold shrink-0" />
              </button>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center text-text-muted py-8">
                {searchQuery ? 'Ничего не найдено' : 'Нет записей'}
              </div>
            )}
          </div>
        </>
      )}

      {/* Модальное окно */}
      {selectedEntry && renderDetail()}
    </div>
  );
};
