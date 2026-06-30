import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ArrowLeft, BookOpen, Sparkles, Swords, Shield, Eye, Brain, Scroll, Star, Wand2, ChevronRight, X, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Filter, ChevronDown } from 'lucide-react';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { normalizeSkillKey } from '../utils/dnd';
import { getClassById, translateProficiencies } from '../data/classes';
import { ItemRenderBody } from '../utils/itemRender';

// Приводит сырой ключ данных ("disguise kit", "aberrant dragonmark") к читаемому
// виду с заглавных букв. Полная локализация инструментов/черт предыстории — за
// пайплайном i18n gamedata; здесь хотя бы убираем «ключевой» вид.
function prettifyDataKey(key: string): string {
  return key.split(/\s+/).map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

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
  | 'classes' | 'subclasses' | 'charoptions' | 'actions';

interface CategoryConfig {
  key: GlossaryCategory;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

interface GlossaryProps {
  onBack: () => void;
  activeCategory?: string | null;
  onCategoryChange?: (category: string) => void;
  // Префильтр из тега {@filter}: категория + «сырые» параметры 5etools.
  prefilter?: { category: string; params: Record<string, string[]> } | null;
}

// ─── Сортировка ───
interface SortOption {
  key: string;
  label: string;
  getValue: (item: any, constants: Record<string, any>) => string | number;
}

type TFunc = (key: string, options?: Record<string, any>) => string;

function buildSortOptions(t: TFunc) {
  const SORT_NAME: SortOption = { key: 'name', label: t('sort.name'), getValue: (item) => item.name?.toLowerCase() || '' };
  const SORT_SOURCE: SortOption = { key: 'source', label: t('sort.source'), getValue: (item) => item.source || '' };

  const CATEGORY_SORT_OPTIONS: Partial<Record<GlossaryCategory, SortOption[]>> = {
    spells: [
      SORT_NAME,
      { key: 'level', label: t('sort.level'), getValue: (item) => item.level ?? 0 },
      { key: 'school', label: t('sort.school'), getValue: (item, c) => c.SCHOOL_NAMES?.[item.school] || item.school || '' },
      SORT_SOURCE,
    ],
    feats: [
      SORT_NAME,
      { key: 'category', label: t('sort.category'), getValue: (item, c) => c.FEAT_CATEGORY_NAMES?.[item.category || ''] || '' },
      SORT_SOURCE,
    ],
    items: [
      SORT_NAME,
      { key: 'rarity', label: t('sort.rarity'), getValue: (item) => {
        const order: Record<string, number> = { common: 0, uncommon: 1, rare: 2, 'very rare': 3, legendary: 4, artifact: 5 };
        return order[(item.rarity || 'common').toLowerCase()] ?? -1;
      }},
      { key: 'value', label: t('sort.value'), getValue: (item) => item.value ?? 0 },
      { key: 'weight', label: t('sort.weight'), getValue: (item) => item.weight ?? 0 },
      SORT_SOURCE,
    ],
    classes: [
      SORT_NAME,
      { key: 'hitDie', label: t('sort.hitDie'), getValue: (item) => parseInt(item.hitDie?.replace(/\D/g, '') || '0') },
      SORT_SOURCE,
    ],
    subclasses: [
      SORT_NAME,
      { key: 'classId', label: t('sort.class'), getValue: (item) => item.classId || '' },
      { key: 'level', label: t('sort.level'), getValue: (item) => item.level ?? 0 },
      SORT_SOURCE,
    ],
    skills: [
      SORT_NAME,
      { key: 'ability', label: t('sort.ability'), getValue: (item, c) => c.ABILITY_ABBR_NAMES?.[item.ability] || item.ability || '' },
    ],
    species: [
      SORT_NAME,
      SORT_SOURCE,
    ],
    optionalfeatures: [
      SORT_NAME,
      { key: 'featureType', label: t('sort.featureType'), getValue: (item, c) => item.featureType?.map((ft: string) => c.FEATURE_TYPE_NAMES?.[ft] || ft).join(', ') || '' },
      SORT_SOURCE,
    ],
  };

  return { SORT_NAME, CATEGORY_SORT_OPTIONS };
}

// ─── Фильтры ───
interface FilterDimension {
  key: string;
  label: string;
  getLabel: (value: string, constants: Record<string, any>) => string;
  getValue: (item: any, constants: Record<string, any>) => string[];
  order?: string[]; // фиксированный порядок значений
}

function buildFilterConfigs(t: TFunc): Partial<Record<GlossaryCategory, FilterDimension[]>> {
  const sourceFilter: FilterDimension = {
    key: 'source', label: t('filter.source'),
    getLabel: (v) => v,
    getValue: (item) => item.source ? [item.source] : [],
  };

  return {
    spells: [
      {
        key: 'level', label: t('filter.level'),
        getLabel: (v) => v === '0' ? t('filter.cantrip') : t('filter.levelShort', { level: v }),
        getValue: (item) => [String(item.level ?? 0)],
        order: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
      },
      {
        key: 'school', label: t('filter.school'),
        getLabel: (v, c) => c.SCHOOL_NAMES?.[v] || v,
        getValue: (item) => item.school ? [item.school] : [],
      },
      sourceFilter,
    ],
    feats: [
      {
        key: 'category', label: t('filter.category'),
        getLabel: (v, c) => c.FEAT_CATEGORY_NAMES?.[v] || v || t('filter.noCategory'),
        getValue: (item) => [item.category || ''],
      },
      sourceFilter,
    ],
    items: [
      {
        key: 'rarity', label: t('filter.rarity'),
        getLabel: (v) => {
          const keyMap: Record<string, string> = { none: 'none', common: 'common', uncommon: 'uncommon', rare: 'rare', 'very rare': 'veryRare', legendary: 'legendary', artifact: 'artifact' };
          return t(`rarityNames.${keyMap[v] || v}`, { defaultValue: v });
        },
        getValue: (item) => [item.rarity || 'none'],
        order: ['none', 'common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'],
      },
      sourceFilter,
    ],
    classes: [
      {
        key: 'spellcaster', label: t('filter.spellcaster'),
        getLabel: (v) => v === 'true' ? t('filter.yes') : t('filter.no'),
        getValue: (item) => [String(!!item.spellcaster)],
      },
      sourceFilter,
    ],
    subclasses: [
      {
        key: 'classId', label: t('filter.class'),
        getLabel: (v) => v,
        getValue: (item) => item.classId ? [item.classId] : [],
      },
      sourceFilter,
    ],
    skills: [
      {
        key: 'ability', label: t('filter.ability'),
        getLabel: (v, c) => c.ABILITY_ABBR_NAMES?.[v] || v,
        getValue: (item) => item.ability ? [item.ability] : [],
      },
    ],
    species: [
      {
        key: 'size', label: t('filter.size'),
        getLabel: (v, c) => c.SIZE_NAMES?.[v] || v,
        getValue: (item) => item.size || [],
      },
      sourceFilter,
    ],
    conditions: [
      {
        key: 'type', label: t('filter.type'),
        getLabel: (v) => v === 'condition' ? t('filter.conditionType') : v === 'disease' ? t('filter.diseaseType') : v,
        getValue: (item) => item.type ? [item.type] : [],
      },
    ],
    optionalfeatures: [
      {
        key: 'featureType', label: t('filter.featureType'),
        getLabel: (v, c) => c.FEATURE_TYPE_NAMES?.[v] || v,
        getValue: (item) => item.featureType || [],
      },
      sourceFilter,
    ],
    backgrounds: [
      sourceFilter,
    ],
    charoptions: [
      {
        key: 'optionType', label: t('filter.optionType'),
        getLabel: (v, c) => c.OPTION_TYPE_NAMES?.[v] || v,
        getValue: (item) => item.optionType || [],
      },
      sourceFilter,
    ],
    rules: [
      {
        key: 'ruleType', label: t('filter.ruleType'),
        getLabel: (v, c) => c.RULE_TYPE_NAMES?.[v] || v,
        getValue: (item) => item.ruleType ? [item.ruleType] : [],
      },
      sourceFilter,
    ],
  };
}

// ─── Кеш загруженных данных по категориям ───
interface CategoryData {
  items: any[];
  constants: Record<string, any>;
}

const categoryCache: Partial<Record<GlossaryCategory, CategoryData>> = {};
let entryRendererCache: {
  EntryRenderer: React.FC<any>;
  registerLoadedData: (type: string, items: any[]) => void;
  renderTaggedString: (text: string, context?: string, onNavigate?: (entry: RegistryEntry) => void) => React.ReactNode;
} | null = null;

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
        constants: { SCHOOL_NAMES: mod.SCHOOL_NAMES, getImageUrl: mod.getSpellImageUrl },
      };
      break;
    }
    case 'feats': {
      const mod = await import('../data/feats');
      await mod.init();
      result = {
        items: mod.ALL_FEATS,
        constants: { FEAT_CATEGORY_NAMES: mod.FEAT_CATEGORY_NAMES, getImageUrl: mod.getFeatImageUrl },
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
      result = { items: mod.ALL_CONDITIONS, constants: { getImageUrl: mod.getConditionImageUrl } };
      break;
    }
    case 'senses': {
      const mod = await import('../data/senses');
      await mod.init();
      result = { items: mod.ALL_SENSES, constants: { getImageUrl: mod.getSenseImageUrl } };
      break;
    }
    case 'skills': {
      const mod = await import('../data/skills');
      await mod.init();
      result = {
        items: mod.ALL_SKILLS,
        constants: { ABILITY_ABBR_NAMES: mod.ABILITY_ABBR_NAMES, getImageUrl: mod.getSkillImageUrl },
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
      for (const t of items.getStaticItemTemplates()) {
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
      result = { items: allItems, constants: { getImageUrl: itemsBase.getItemBaseImageUrl } };
      break;
    }
    case 'classes': {
      const mod = await import('../data/classes/classJsonLoader');
      await mod.init();
      result = { items: mod.ALL_CLASS_DATA, constants: { getImageUrl: mod.getClassImageUrl, imageUrlField: 'id' } };
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
    case 'actions': {
      const mod = await import('../data/actions');
      await mod.init();
      result = { items: mod.ALL_ACTIONS, constants: {} };
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
    renderTaggedString: mod.renderTaggedString,
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

  const { t } = useTranslation('glossary');

  if (!loaded) {
    return <div className="text-sm text-text-muted animate-pulse py-2">{t('subclassList.loading')}</div>;
  }
  if (subclasses.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
        <Shield size={14} />
        {t('subclassList.title', { count: subclasses.length })}
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
              <div className="text-xs text-text-muted mt-1">{t('subclassList.levelShort', { level: sub.level })} • {sub.source}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Конфигурация категорий (иконки) ───
const CATEGORY_ICONS: Record<GlossaryCategory, React.FC<{ size?: number; className?: string }>> = {
  spells: Wand2, feats: Star, species: Sparkles, backgrounds: BookOpen,
  conditions: Shield, senses: Eye, skills: Brain, rules: Scroll,
  optionalfeatures: Swords, items: Shield, classes: Swords, subclasses: Shield,
  charoptions: Sparkles, actions: Swords,
};
const CATEGORY_KEYS: GlossaryCategory[] = [
  'spells', 'feats', 'species', 'backgrounds', 'conditions', 'senses',
  'skills', 'rules', 'optionalfeatures', 'items', 'classes', 'subclasses',
  'charoptions', 'actions',
];
function buildCategories(t: TFunc): CategoryConfig[] {
  return CATEGORY_KEYS.map(key => ({
    key,
    label: t(`categories.${key}`),
    icon: CATEGORY_ICONS[key],
  }));
}

// Тип записи из registry → категория глоссария. Нужно для навигации по ссылкам
// (@spell, @class, @subclass …) между категориями: детальная панель рендерится
// по activeCategory, поэтому при переходе на чужой тип надо сменить категорию.
const TYPE_TO_CATEGORY: Record<string, GlossaryCategory> = {
  spell: 'spells', feat: 'feats', species: 'species', background: 'backgrounds',
  condition: 'conditions', disease: 'conditions', sense: 'senses', skill: 'skills',
  variantrule: 'rules', optfeature: 'optionalfeatures', item: 'items',
  class: 'classes', subclass: 'subclasses', charoption: 'charoptions', action: 'actions',
};

export const Glossary: React.FC<GlossaryProps> = ({ onBack, activeCategory: externalCategory, onCategoryChange, prefilter }) => {
  const { t } = useTranslation('glossary');
  const CATEGORIES = useMemo(() => buildCategories(t), [t]);
  const { SORT_NAME, CATEGORY_SORT_OPTIONS } = useMemo(() => buildSortOptions(t), [t]);
  const CATEGORY_FILTERS = useMemo(() => buildFilterConfigs(t), [t]);

  const [internalCategory, setInternalCategory] = useState<GlossaryCategory | null>(null);
  const activeCategory = (externalCategory as GlossaryCategory | null) ?? internalCategory;
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<{ type: string; data: any } | null>(null);
  const [EntryRenderer, setEntryRenderer] = useState<React.FC<any> | null>(null);
  const [selectedSubclass, setSelectedSubclass] = useState<any | null>(null);
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  // Browser Back closes an open detail overlay instead of leaving the glossary.
  useBackDismiss(selectedEntry !== null, () => setSelectedEntry(null));
  useBackDismiss(selectedSubclass !== null, () => setSelectedSubclass(null));

  // Загрузка категории при выборе
  const selectCategory = useCallback(async (category: GlossaryCategory) => {
    setInternalCategory(category);
    onCategoryChange?.(category);
    setSearchQuery('');
    setSelectedEntry(null);
    setSelectedSubclass(null);
    setSortKey('name');
    setSortDirection('asc');
    setActiveFilters({});
    setExpandedFilter(null);
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
      setLoadError(err?.message || t('ui.loadError'));
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

  // Применяем префильтр из тега {@filter}: сопоставляем сырые параметры 5etools с
  // измерениями фильтра по нормализованному ключу, а значения — case-insensitive с
  // реальными значениями в данных. Что не сопоставилось — молча пропускаем (переход
  // в категорию всё равно полезен). Срабатывает после загрузки данных нужной категории.
  useEffect(() => {
    if (!prefilter || !categoryData) return;
    if (prefilter.category !== activeCategory) return; // ждём, пока категория переключится
    const dims = CATEGORY_FILTERS[activeCategory as GlossaryCategory];
    if (!dims) return;

    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const constants = categoryData.constants;
    const next: Record<string, Set<string>> = {};

    for (const [pKey, pVals] of Object.entries(prefilter.params)) {
      const dim = dims.find(d => norm(d.key) === norm(pKey));
      if (!dim) continue;
      const available = new Set<string>();
      for (const item of categoryData.items) {
        for (const v of dim.getValue(item, constants)) {
          if (v !== undefined && v !== null) available.add(v);
        }
      }
      const matched = new Set<string>();
      for (const pv of pVals) {
        const hit = [...available].find(av => av.toLowerCase() === pv.toLowerCase());
        if (hit) matched.add(hit);
      }
      if (matched.size) next[dim.key] = matched;
    }

    setActiveFilters(Object.keys(next).length ? next : {});
  }, [prefilter, categoryData, activeCategory, CATEGORY_FILTERS]);

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

  // Доступные значения фильтров (извлекаем из данных)
  const filterOptions = useMemo(() => {
    if (!categoryData || !activeCategory) return new Map<string, string[]>();
    const filters = CATEGORY_FILTERS[activeCategory];
    if (!filters) return new Map<string, string[]>();
    const constants = categoryData.constants;
    const result = new Map<string, string[]>();
    for (const dim of filters) {
      const valuesSet = new Set<string>();
      for (const item of categoryData.items) {
        for (const v of dim.getValue(item, constants)) {
          if (v !== undefined && v !== null) valuesSet.add(v);
        }
      }
      let values = Array.from(valuesSet);
      if (dim.order) {
        const orderMap = new Map(dim.order.map((v, i) => [v, i]));
        values.sort((a, b) => (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999));
      } else {
        values.sort((a, b) => dim.getLabel(a, constants).localeCompare(dim.getLabel(b, constants)));
      }
      result.set(dim.key, values);
    }
    return result;
  }, [categoryData, activeCategory]);

  // Переключение значения фильтра
  const toggleFilter = useCallback((dimKey: string, value: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      const set = new Set(next[dimKey] || []);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      if (set.size === 0) {
        delete next[dimKey];
      } else {
        next[dimKey] = set;
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
    setExpandedFilter(null);
  }, []);

  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  // Фильтрованный и отсортированный список
  const filteredItems = useMemo(() => {
    if (!categoryData) return [];
    const constants = categoryData.constants;
    const q = searchQuery.toLowerCase().trim();
    let items = categoryData.items;

    // Текстовый поиск
    if (q) {
      items = items.filter((item: any) => item.name?.toLowerCase().includes(q));
    }

    // Применение фильтров (AND по измерениям, OR внутри одного измерения)
    const filters = activeCategory ? CATEGORY_FILTERS[activeCategory] : undefined;
    if (filters) {
      for (const dim of filters) {
        const selected = activeFilters[dim.key];
        if (selected && selected.size > 0) {
          items = items.filter((item: any) => {
            const itemValues = dim.getValue(item, constants);
            return itemValues.some(v => selected.has(v));
          });
        }
      }
    }

    // Сортировка
    const sortOptions = (activeCategory ? CATEGORY_SORT_OPTIONS[activeCategory] : null) || [SORT_NAME];
    const sortOption = sortOptions.find(s => s.key === sortKey) || SORT_NAME;
    const dir = sortDirection === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      const va = sortOption.getValue(a, constants);
      const vb = sortOption.getValue(b, constants);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [categoryData, searchQuery, sortKey, sortDirection, activeCategory, activeFilters]);

  // Получить subtitle для элемента
  const getItemSubtitle = (item: any): string => {
    if (!activeCategory || !categoryData) return '';
    const { constants } = categoryData;

    switch (activeCategory) {
      case 'spells': {
        const level = item.level === 0 ? t('filter.cantrip') : t('filter.levelShort', { level: item.level });
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
        return `${item.classId || ''} • ${t('subclassList.levelShort', { level: item.level || '?' })} • ${item.source || ''}`;
      case 'charoptions': {
        const optTypes = item.optionType?.map((t: string) => constants.OPTION_TYPE_NAMES?.[t] || t).join(', ');
        return optTypes || item.source || '';
      }
      case 'actions': {
        const time = item.time?.[0];
        const timeStr = time ? `${time.number} ${time.unit}` : '';
        return timeStr ? `${timeStr} • ${item.source || ''}` : item.source || '';
      }
      default:
        return item.source || '';
    }
  };

  // Обработка навигации по тегам
  // Отложенный выбор записи после смены категории (categoryData грузится async).
  const pendingSelectRef = useRef<{ type: string; data: any } | null>(null);

  const handleNavigate = useCallback((entry: RegistryEntry) => {
    const targetCat = TYPE_TO_CATEGORY[entry.type];
    if (targetCat && targetCat !== activeCategory) {
      // Ссылка ведёт в другую категорию — переключаемся и выбираем запись после загрузки.
      pendingSelectRef.current = { type: entry.type, data: entry.data };
      selectCategory(targetCat);
    } else {
      setSelectedEntry({ type: entry.type, data: entry.data });
      setSelectedSubclass(null);
    }
  }, [activeCategory, selectCategory]);

  // Применяем отложенный выбор, когда данные новой категории загрузились.
  useEffect(() => {
    if (categoryData && pendingSelectRef.current) {
      setSelectedEntry(pendingSelectRef.current);
      setSelectedSubclass(null);
      pendingSelectRef.current = null;
    }
  }, [categoryData]);

  // ─── Форматирование данных заклинания ───
  const formatSpellTime = (time: any[]): string => {
    if (!time?.length) return '';
    return time.map(ti => {
      const num = ti.number || 1;
      const unitMap: Record<string, string> = {
        action: t('spell.time.action'),
        bonus: t('spell.time.bonusAction'),
        reaction: t('spell.time.reaction'),
        minute: t('spell.time.minute', { count: num }),
        hour: t('spell.time.hour', { count: num }),
      };
      const unit = unitMap[ti.unit] || ti.unit;
      if (ti.unit === 'action' || ti.unit === 'bonus' || ti.unit === 'reaction') {
        return `1 ${unit}`;
      }
      return `${num} ${unit}`;
    }).join(t('spell.or'));
  };

  const formatSpellRange = (range: any): string => {
    if (!range) return t('spell.range.notSpecified');
    if (typeof range === 'string') return range;
    if (typeof range === 'number') return t('spell.range.feet', { amount: range });
    if (range.type === 'special') return t('spell.range.special');
    if (range.type === 'sight') return t('spell.range.sight');
    if (range.type === 'unlimited') return t('spell.range.unlimited');
    if (range.type === 'self') {
      if (range.distance?.type === 'radius') return t('spell.range.selfRadius', { amount: range.distance.amount });
      if (range.distance?.type === 'cone') return t('spell.range.selfCone', { amount: range.distance.amount });
      if (range.distance?.type === 'line') return t('spell.range.selfLine', { amount: range.distance.amount });
      if (range.distance?.type === 'sphere') return t('spell.range.selfSphere', { amount: range.distance.amount });
      return t('spell.range.self');
    }
    if (range.type === 'touch') return t('spell.range.touch');
    if (range.type === 'point' && range.distance) {
      const amt = range.distance.amount;
      if (range.distance.type === 'feet') return t('spell.range.feet', { amount: amt });
      if (range.distance.type === 'miles') return t('spell.range.miles', { amount: amt });
      if (range.distance.type === 'self') return t('spell.range.self');
      return `${amt} ${range.distance.type}`;
    }
    // Fallback для любых других форматов
    if (range.distance?.amount) return t('spell.range.feet', { amount: range.distance.amount });
    return JSON.stringify(range);
  };

  const formatSpellComponents = (comp: any): string => {
    if (!comp) return '';
    const parts: string[] = [];
    if (comp.v) parts.push('V');
    if (comp.s) parts.push('S');
    if (comp.m) {
      const mat = typeof comp.m === 'string' ? comp.m : comp.m?.text || '';
      if (mat) {
        const cost = comp.m?.cost ? ` (${comp.m.cost / 100} ${t('spell.components.gold')})` : '';
        const consumed = comp.m?.consume ? ` ${t('spell.components.consumed')}` : '';
        parts.push(`M (${mat}${cost}${consumed})`);
      } else {
        parts.push('M');
      }
    }
    return parts.join(', ');
  };

  const formatSpellDuration = (duration: any[]): string => {
    if (!duration?.length) return '';
    return duration.map(dur => {
      if (dur.type === 'instant') return t('spell.duration.instant');
      if (dur.type === 'permanent') {
        const ends = dur.ends?.join(', ') || '';
        return ends ? t('spell.duration.untilX', { condition: ends }) : t('spell.duration.permanent');
      }
      if (dur.type === 'special') return t('spell.duration.special');
      if (dur.type === 'timed' && dur.duration) {
        const amt = dur.duration.amount;
        const unitMap: Record<string, string> = {
          round: t('spell.duration.round', { count: amt }),
          minute: t('spell.duration.minute', { count: amt }),
          hour: t('spell.duration.hour', { count: amt }),
          day: t('spell.duration.day', { count: amt }),
        };
        const conc = dur.concentration ? t('spell.duration.concentration') : '';
        return `${conc}${amt} ${unitMap[dur.duration.type] || dur.duration.type}`;
      }
      return '';
    }).filter(Boolean).join(t('spell.or'));
  };

  // ─── Форматирование требований черты ───
  const formatPrerequisite = (prereq: any[]): string => {
    if (!prereq?.length) return '';
    return prereq.map((p: any) => {
      const parts: string[] = [];
      // Уровень - может быть числом или объектом
      if (p.level) {
        if (typeof p.level === 'number') {
          const cls = p.class ? p.class.name : '';
          parts.push(cls ? t('feat.levelReqClass', { level: p.level, class: cls }) : t('feat.levelReq', { level: p.level }));
        } else if (typeof p.level === 'object' && p.level.level) {
          const lvl = p.level.level;
          const cls = p.level.class?.name || '';
          parts.push(cls ? t('feat.levelReqClass', { level: lvl, class: cls }) : t('feat.levelReq', { level: lvl }));
        }
      }
      if (p.ability) {
        const abReqs = p.ability.map((ab: any) =>
          Object.entries(ab).map(([k, v]) => `${t(`abilities.${k}`, { defaultValue: k })} ${v}+`).join(', ')
        ).join(t('spell.or'));
        if (abReqs) parts.push(abReqs);
      }
      if (p.spellcasting) parts.push(t('feat.spellcasting'));
      if (p.spellcastingFeature) parts.push(t('feat.spellcasting'));
      if (p.pact) parts.push(t('feat.pact', { pact: p.pact }));
      if (p.patron) parts.push(t('feat.patron', { patron: p.patron }));
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
        const races = p.race.map((r: any) => r.name || r).join(t('spell.or'));
        parts.push(t('feat.race', { races }));
      }
      if (p.feat) {
        const feats = p.feat.map((f: any) => typeof f === 'string' ? f.split('|')[0] : f).join(', ');
        parts.push(t('feat.feat', { feats }));
      }
      if (p.proficiency) {
        const profs = p.proficiency.map((pr: any) =>
          Object.entries(pr).map(([k]) => k).join(', ')
        ).join(', ');
        if (profs) parts.push(t('feat.proficiency', { profs }));
      }
      if (p.other) parts.push(p.other);
      return parts.join(', ');
    }).filter(Boolean).join('; ');
  };

  // Как formatPrerequisite, но прогоняет результат через renderTaggedString,
  // чтобы 5etools-теги (например {@charoption ...} в требованиях трансформаций)
  // стали кликабельными ссылками, а не сырым текстом.
  const renderPrerequisite = (prereq: any[], context: string): React.ReactNode => {
    const str = formatPrerequisite(prereq);
    const rts = entryRendererCache?.renderTaggedString;
    return rts ? rts(str, context, handleNavigate) : str;
  };

  // ─── Форматирование бонусов характеристик (для черт и предысторий) ───
  const formatAbilityBonus = (ability: any[]): string => {
    if (!ability?.length) return '';
    return ability.map((a: any) => {
      // Выбор из нескольких
      if (a.choose) {
        if (a.choose.from) {
          const opts = a.choose.from.map((ab: string) => t(`abilities.${ab}`, { defaultValue: ab })).join('/');
          const count = a.choose.count || 1;
          const amount = a.choose.amount || 1;
          return count > 1
            ? t('abilityBonus.chooseFromMulti', { amount, options: opts, count })
            : t('abilityBonus.chooseFrom', { amount, options: opts });
        }
        if (a.choose.weighted?.from) {
          const opts = a.choose.weighted.from.map((ab: string) => t(`abilities.${ab}`, { defaultValue: ab })).join('/');
          return t('abilityBonus.selectFrom', { options: opts });
        }
        return t('abilityBonus.selectAbility');
      }
      // Фиксированные бонусы
      const fixed = Object.entries(a)
        .filter(([k]) => ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(k))
        .map(([k, v]) => `${t(`abilities.${k}`, { defaultValue: k })} +${v}`)
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
        // Объединённый вид: заменяем плейсхолдеры реальными фичами подкласса.
        // Уровень получения подкласса (мин. уровень плейсхолдеров, обычно 3) —
        // фичи подкласса не должны показываться раньше него (часть данных хранит
        // устаревшие уровни 1/2 из правил 2014 года).
        const placeholderLevels = d.classFeatures
          .filter((f: any) => isPlaceholder(f.name))
          .map((f: any) => f.level as number);
        const introLevel = placeholderLevels.length
          ? Math.min(...placeholderLevels)
          : (selectedSubclass.level ?? 3);

        // Таблица заклинаний подкласса (домен/клятва/покровитель и т.п.):
        // строки «уровень класса → заклинания». {@spell} рендерятся как ссылки.
        const spellTableFor = (sf: any) => {
          const list: any[] | null =
            Array.isArray(sf.spellList) && sf.spellList.length ? sf.spellList
            : Array.isArray(sf.spells) && sf.spells.length ? sf.spells
            : null;
          if (!list) return null;
          const rows: string[][] = [];
          for (const item of list) {
            if (!item || typeof item !== 'object' || !Array.isArray(item.spells) || !item.spells.length) continue;
            let lvl: number | undefined;
            for (const [k, v] of Object.entries(item)) {
              if (k !== 'spells' && typeof v === 'number') { lvl = v; break; }
            }
            rows.push([String(lvl ?? ''), item.spells.join(', ')]);
          }
          if (!rows.length) return null;
          return {
            type: 'table',
            colLabels: [t('classFeature.spellTableLevel'), t('classFeature.spellTableSpells')],
            rows,
          };
        };

        const makeSubEntry = (sf: any) => {
          const lvl = Math.max(sf.level ?? introLevel, introLevel);
          const subEntries: any[] = [sf.description, ...(sf.details ? Object.values(sf.details).filter(Boolean) : [])];
          const table = spellTableFor(sf);
          if (table) subEntries.push(table);
          return {
            type: 'entries',
            name: `${sf.name} (${t('classFeature.levelLabel', { level: lvl })}) — ${selectedSubclass.name}`,
            entries: subEntries,
            _isSubclass: true,
            _level: lvl,
          };
        };

        // Группируем по «прижатому» уровню, чтобы фичи попадали в плейсхолдер 3-го ур.
        const subFeaturesByLevel = new Map<number, any[]>();
        for (const f of selectedSubclass.features) {
          const key = Math.max(f.level ?? introLevel, introLevel);
          const arr = subFeaturesByLevel.get(key) || [];
          arr.push(f);
          subFeaturesByLevel.set(key, arr);
        }

        entries = [];
        for (const f of d.classFeatures) {
          if (isPlaceholder(f.name)) {
            const subFeats = subFeaturesByLevel.get(f.level) || [];
            for (const sf of subFeats) entries.push(makeSubEntry(sf));
            subFeaturesByLevel.delete(f.level);
          } else {
            entries.push({
              type: 'entries',
              name: `${f.name} (${t('classFeature.levelLabel', { level: f.level })})`,
              entries: [f.description, ...(f.details ? Object.values(f.details) : [])],
              _level: f.level,
            });
          }
        }
        // Оставшиеся фичи подкласса, не попавшие в плейсхолдеры
        for (const [, feats] of subFeaturesByLevel) {
          for (const sf of feats) entries.push(makeSubEntry(sf));
        }
        // Сортируем по уровню
        entries.sort((a: any, b: any) => (a._level ?? 0) - (b._level ?? 0));
      } else {
        // Без подкласса — скрываем плейсхолдеры
        entries = d.classFeatures
          .filter((f: any) => !isPlaceholder(f.name))
          .map((f: any) => ({
            type: 'entries',
            name: `${f.name} (${t('classFeature.levelLabel', { level: f.level })})`,
            entries: [f.description, ...(f.details ? Object.values(f.details) : [])],
            _level: f.level,
          }));
      }
    }

    if (type === 'subclasses' && d.features && !entries.length) {
      entries = d.features.map((f: any) => ({
        type: 'entries',
        name: `${f.name} (${t('classFeature.levelLabel', { level: f.level })})`,
        entries: [f.description, ...(f.details ? Object.values(f.details).filter(Boolean) : [])],
      }));
    }

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEntry(null)}>
        <div className="bg-gray-900 rounded-xl border-2 border-gold max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-gray-900 border-b border-border-default p-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              {(() => {
                const getImageUrl = constants.getImageUrl as ((key: string) => string) | undefined;
                const imageUrlField = (constants.imageUrlField as string) || 'name';
                const lookupKey = imageUrlField === 'name' ? (d._origName ?? d.name) : d[imageUrlField];
                const detailImgSrc = getImageUrl && lookupKey ? getImageUrl(lookupKey) : null;
                return detailImgSrc ? (
                  <img
                    src={detailImgSrc}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover bg-bg-panel shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : null;
              })()}
              <h2 className="text-xl font-medieval text-gold">{d.name || t('detail.entry')}</h2>
            </div>
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
                  {d.level === 0 ? t('detail.cantrip') : t('detail.levelN', { level: d.level })}
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
                  <div><span className="text-text-secondary">{t('spell.castingTime')} </span><span className="text-text-primary">{formatSpellTime(d.time) || '—'}</span></div>
                  <div><span className="text-text-secondary">{t('spell.distance')} </span><span className="text-text-primary">{formatSpellRange(d.range)}</span></div>
                  <div><span className="text-text-secondary">{t('spell.componentsLabel')} </span><span className="text-text-primary">{formatSpellComponents(d.components) || '—'}</span></div>
                  <div><span className="text-text-secondary">{t('spell.durationLabel')} </span><span className="text-text-primary">{formatSpellDuration(d.duration) || '—'}</span></div>
                </div>
                {(d.savingThrow || d.damageInflict) && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-border-default">
                    {d.savingThrow && (
                      <div><span className="text-text-secondary">{t('spell.savingThrow')} </span><span className="text-text-primary">{d.savingThrow.map((s: string) => t(`abilities.${s}`, { ns: 'game', defaultValue: s })).join(', ')}</span></div>
                    )}
                    {d.damageInflict && (
                      <div><span className="text-text-secondary">{t('spell.damageType')} </span><span className="text-text-primary">{d.damageInflict.map((dmg: string) => t(`damageTypesFull.${dmg}`, { ns: 'game', defaultValue: dmg })).join(', ')}</span></div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ ЧЕРТЫ ═══════════ */}
            {type === 'feats' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.prerequisite && d.prerequisite.length > 0 && (
                  <div><span className="text-text-secondary">{t('feat.prerequisites')} </span><span className="text-text-primary">{renderPrerequisite(d.prerequisite, d.name || '')}</span></div>
                )}
                {d.ability && d.ability.length > 0 && (
                  <div><span className="text-text-secondary">{t('feat.abilityBonus')} </span><span className="text-text-primary">
                    {formatAbilityBonus(d.ability)}
                  </span></div>
                )}
                {d.additionalSpells && (
                  <div><span className="text-text-secondary">{t('feat.hasSpells')}</span></div>
                )}
              </div>
            )}

            {/* ═══════════ ВИДЫ ═══════════ */}
            {type === 'species' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {d.size && (
                    <div><span className="text-text-secondary">{t('species.size')} </span><span className="text-text-primary">
                      {d.size.map((s: string) => constants.SIZE_NAMES?.[s] || s).join(t('spell.or'))}
                    </span></div>
                  )}
                  {d.speed !== undefined && (
                    <div><span className="text-text-secondary">{t('species.speed')} </span><span className="text-text-primary">
                      {typeof d.speed === 'number' ? `${d.speed} ${t('species.ft')}` :
                        Object.entries(d.speed).map(([k, v]) => k === 'walk' ? `${v} ${t('species.ft')}` : `${k}: ${v} ${t('species.ft')}`).join(', ')}
                    </span></div>
                  )}
                  {d.darkvision && (
                    <div><span className="text-text-secondary">{t('species.darkvision')} </span><span className="text-text-primary">{d.darkvision} {t('species.ft')}</span></div>
                  )}
                  {d.creatureTypes && (
                    <div><span className="text-text-secondary">{t('species.creatureType')} </span><span className="text-text-primary">{d.creatureTypes.map((ct: string) => t(`creatureTypes.${ct}`, { ns: 'game', defaultValue: ct })).join(', ')}</span></div>
                  )}
                </div>
                {Array.isArray(d.resist) && (() => {
                  // resist может содержать строки ("fire") и объекты ({ resist:[...] }
                  // или { choose:{ from:[...] } }) — раньше объекты давали "[object Object]".
                  const dt = (x: string) => t(`damageTypesFull.${x}`, { ns: 'game', defaultValue: x });
                  const parts: string[] = [];
                  for (const r of d.resist) {
                    if (typeof r === 'string') parts.push(dt(r));
                    else if (r && typeof r === 'object') {
                      const arr = (r.resist || r.choose?.from) as string[] | undefined;
                      if (Array.isArray(arr)) parts.push(arr.map(dt).join('/'));
                    }
                  }
                  return parts.length > 0 ? (
                    <div><span className="text-text-secondary">{t('species.resistance')} </span><span className="text-text-primary">{parts.join(', ')}</span></div>
                  ) : null;
                })()}
                {d.traitTags && (
                  <div><span className="text-text-secondary">{t('species.traits')} </span><span className="text-text-primary">{d.traitTags.join(', ')}</span></div>
                )}
              </div>
            )}

            {/* ═══════════ ПРЕДЫСТОРИИ ═══════════ */}
            {type === 'backgrounds' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.ability && d.ability.length > 0 && (
                  <div><span className="text-text-secondary">{t('background.abilities')} </span><span className="text-text-primary">{formatAbilityBonus(d.ability)}</span></div>
                )}
                {d.skillProficiencies && d.skillProficiencies.length > 0 && (
                  <div><span className="text-text-secondary">{t('background.skills')} </span><span className="text-text-primary">
                    {d.skillProficiencies.map((sp: any) => Object.keys(sp).filter(k => k !== 'choose')
                      .map(k => { const nk = normalizeSkillKey(k); return t(`skills.${nk}`, { ns: 'game', defaultValue: prettifyDataKey(k) }); })
                      .join(', ')).join('; ')}
                  </span></div>
                )}
                {d.toolProficiencies && d.toolProficiencies.length > 0 && (
                  <div><span className="text-text-secondary">{t('background.tools')} </span><span className="text-text-primary">
                    {d.toolProficiencies.map((tp: any) => Object.keys(tp).filter(k => k !== 'choose')
                      .map(k => prettifyDataKey(k)).join(', ')).join('; ')}
                  </span></div>
                )}
                {d.languageProficiencies && d.languageProficiencies.length > 0 && (
                  <div><span className="text-text-secondary">{t('background.languages')} </span><span className="text-text-primary">
                    {d.languageProficiencies.map((lp: any) => {
                      const langs = Object.entries(lp).filter(([k]) => k !== 'anyStandard' && k !== 'choose');
                      const anyCount = lp.anyStandard || lp.choose?.count || 0;
                      const fixed = langs.map(([k]) => k).join(', ');
                      const anyStr = anyCount > 0 ? t('background.anyChoice', { count: anyCount }) : '';
                      return [fixed, anyStr].filter(Boolean).join(', ');
                    }).join('; ')}
                  </span></div>
                )}
                {d.feats && d.feats.length > 0 && (
                  <div><span className="text-text-secondary">{t('background.feat')} </span><span className="text-text-primary">
                    {d.feats.map((f: any) => prettifyDataKey(Object.keys(f)[0]?.split('|')[0] || '')).join(', ')}
                  </span></div>
                )}
                {d.startingEquipment && d.startingEquipment.length > 0 && (
                  <div className="pt-2 border-t border-border-default">
                    <span className="text-text-secondary">{t('background.equipment')} </span>
                    <span className="text-text-primary">
                      {d.startingEquipment.map((eq: any) => {
                        if (eq.A) {
                          return eq.A.map((item: any) => {
                            if (typeof item === 'string') return item;
                            if (item.item) return item.displayName || item.item.split('|')[0];
                            if (item.value) return `${item.value / 100} ${t('background.gold')}`;
                            return '';
                          }).filter(Boolean).join(', ');
                        }
                        return '';
                      }).filter(Boolean).join(t('spell.or'))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ ПРЕДМЕТЫ ═══════════ */}
            {type === 'items' && (
              <ItemRenderBody raw={d} EntryRenderer={EntryRenderer} onNavigate={handleNavigate} />
            )}

            {/* ═══════════ СПОСОБНОСТИ (Optional Features) ═══════════ */}
            {type === 'optionalfeatures' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.featureType && (
                  <div><span className="text-text-secondary">{t('optionalFeature.type')} </span><span className="text-text-primary">
                    {d.featureType.map((ft: string) => constants.FEATURE_TYPE_NAMES?.[ft] || ft).join(', ')}
                  </span></div>
                )}
                {d.prerequisite && d.prerequisite.length > 0 && (
                  <div><span className="text-text-secondary">{t('feat.prerequisites')} </span><span className="text-text-primary">{renderPrerequisite(d.prerequisite, d.name || '')}</span></div>
                )}
              </div>
            )}

            {/* ═══════════ СОСТОЯНИЯ ═══════════ */}
            {type === 'conditions' && d.type && (
              <div className="bg-bg-panel rounded-lg p-4 text-sm">
                <span className="text-text-secondary">{t('condition.type')} </span><span className="text-text-primary">{d.type === 'condition' ? t('condition.conditionLabel') : t('condition.diseaseLabel')}</span>
              </div>
            )}

            {/* ═══════════ КЛАССЫ ═══════════ */}
            {type === 'classes' && (
              <div className="bg-bg-panel rounded-lg p-4 space-y-2 text-sm">
                {d.hitDie && (
                  <div><span className="text-text-secondary">{t('classDetail.hitDie')} </span><span className="text-text-primary font-bold">{d.hitDie}</span></div>
                )}
                {d.primaryAbility && (
                  <div><span className="text-text-secondary">{t('classDetail.primaryAbility')} </span><span className="text-text-primary">{d.primaryAbility.map((a: string) => t(`abilities.${a.toLowerCase()}`, { ns: 'game', defaultValue: a })).join(', ')}</span></div>
                )}
                {d.savingThrows && (
                  <div><span className="text-text-secondary">{t('classDetail.savingThrows')} </span><span className="text-text-primary">{d.savingThrows.map((a: string) => t(`abilities.${a.toLowerCase()}`, { ns: 'game', defaultValue: a })).join(', ')}</span></div>
                )}
                {d.spellcaster !== undefined && (
                  <div><span className="text-text-secondary">{t('classDetail.spellcaster')} </span><span className="text-text-primary">{d.spellcaster ? t('classDetail.yes') : t('classDetail.no')}</span></div>
                )}
                {d.proficiencies && (() => {
                  // Данные классов хранят владения английскими фразами ("Light armor").
                  // В реестре CLASS_REGISTRY они лежат ключами с готовым переводом —
                  // берём перевод оттуда по id, иначе показываем исходные фразы.
                  const classDef = d.id ? getClassById(d.id) : undefined;
                  const prof = classDef ? translateProficiencies(classDef) : d.proficiencies;
                  return (
                    <>
                      {prof.armor?.length > 0 && (
                        <div><span className="text-text-secondary">{t('classDetail.armor')} </span><span className="text-text-primary">{prof.armor.join(', ')}</span></div>
                      )}
                      {prof.weapons?.length > 0 && (
                        <div><span className="text-text-secondary">{t('classDetail.weapons')} </span><span className="text-text-primary">{prof.weapons.join(', ')}</span></div>
                      )}
                      {prof.tools?.length > 0 && (
                        <div><span className="text-text-secondary">{t('classDetail.tools')} </span><span className="text-text-primary">{prof.tools.join(', ')}</span></div>
                      )}
                    </>
                  );
                })()}
                {Array.isArray(d.fluff) && d.fluff.length > 0 && (
                  <div className="pt-2 border-t border-border-default text-text-primary prose prose-invert prose-sm max-w-none">
                    <EntryRenderer entries={d.fluff} context={d.name || ''} onNavigate={handleNavigate} />
                  </div>
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
                  <div><span className="text-text-secondary">{t('subclassDetail.class')} </span><span className="text-text-primary">{d.classId}</span></div>
                )}
                {d.level && (
                  <div><span className="text-text-secondary">{t('subclassDetail.level')} </span><span className="text-text-primary">{d.level}</span></div>
                )}
                {d.source && (
                  <div><span className="text-text-secondary">{t('subclassDetail.source')} </span><span className="text-text-primary">{d.source}</span></div>
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
                  <div><span className="text-text-secondary">{t('charOptionDetail.type')} </span><span className="text-text-primary">
                    {d.optionType.map((ot: string) => constants.OPTION_TYPE_NAMES?.[ot] || ot).join(', ')}
                  </span></div>
                )}
              </div>
            )}

            {/* ═══════════ ОСНОВНОЙ КОНТЕНТ ═══════════ */}
            {/* Предметы рендерятся целиком в ItemRenderBody выше (описание +
                свойства + мастерство), поэтому общий блок entries для них пропускаем. */}
            {entries.length > 0 && type !== 'items' && (
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
                <h4 className="text-sm font-medium text-text-primary mb-2">{t('spell.higherLevels')}</h4>
                <EntryRenderer entries={d.entriesHigherLevel} context={d.name || ''} onNavigate={handleNavigate} />
              </div>
            )}

            {/* Fluff текст. У заклинаний fluff — это объект { images: [...] } без
                entries, поэтому раньше тут рендерился "[object Object]". Берём
                только реальный текст (массив строк или { entries: [...] }). */}
            {(() => {
              const fluffEntries = Array.isArray(d.fluff)
                ? d.fluff
                : (d.fluff && typeof d.fluff === 'object' && Array.isArray(d.fluff.entries))
                  ? d.fluff.entries
                  : typeof d.fluff === 'string'
                    ? [d.fluff]
                    : null;
              if (!fluffEntries || fluffEntries.length === 0) return null;
              return (
                <div className="pt-4 border-t border-border-default">
                  <div className="text-sm italic text-text-secondary">
                    <EntryRenderer entries={fluffEntries} context={d.name || ''} onNavigate={handleNavigate} />
                  </div>
                </div>
              );
            })()}

            {/* Классы для заклинаний */}
            {type === 'spells' && d.classes?.fromClassList && (
              <div className="pt-4 border-t border-border-default text-sm">
                <span className="text-text-secondary">{t('spell.classes')} </span>
                <span className="text-text-primary">{d.classes.fromClassList.map((c: any) => t(`classes.${String(c.name).toLowerCase().replace(/\s+/g, '-')}.name`, { ns: 'game', defaultValue: c.name })).join(', ')}</span>
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
            <span>{t('ui.back')}</span>
          </button>
          <h2 className="text-2xl font-medieval text-gold">{t('ui.title')}</h2>
          <div className="w-24" />
        </div>

        <p className="text-text-secondary text-sm mb-4 text-center">
          {t('ui.selectCategory')}
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
                    <div className="text-xs text-text-muted mt-1">{t('ui.entriesCount', { count: cached.items.length })}</div>
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
          <span>{t('ui.categories')}</span>
        </button>
        <h2 className="text-xl font-medieval text-gold">
          {activeCat?.label || t('ui.title')}
          {categoryData && <span className="text-sm font-normal text-text-secondary ml-2">({filteredItems.length})</span>}
        </h2>
        <div className="w-24" />
      </div>

      {/* Состояние загрузки */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-gold" />
          <span className="ml-3 text-text-secondary">{t('ui.loadingData')}</span>
        </div>
      )}

      {/* Ошибка */}
      {loadError && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="text-red-bright">{loadError}</div>
          <button onClick={() => selectCategory(activeCategory)} className="px-4 py-2 bg-bg-panel-solid text-text-primary rounded hover:bg-gray-600">
            {t('ui.retry')}
          </button>
        </div>
      )}

      {/* Данные загружены */}
      {!loading && !loadError && categoryData && (
        <>
          {/* Поиск и сортировка */}
          <div className="space-y-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
              <input
                type="text"
                placeholder={t('ui.search')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-bg-panel-solid border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-gold/50 transition-colors text-sm"
              />
            </div>
            {(() => {
              const sortOptions = (activeCategory ? CATEGORY_SORT_OPTIONS[activeCategory] : null) || [SORT_NAME];
              if (sortOptions.length <= 1) return null;
              return (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ArrowUpDown size={14} className="text-text-muted shrink-0" />
                  {sortOptions.map(opt => {
                    const isActive = sortKey === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => {
                          if (isActive) {
                            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey(opt.key);
                            setSortDirection('asc');
                          }
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                          isActive
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'bg-bg-panel-solid text-text-secondary border border-border-default hover:border-gold/30 hover:text-text-primary'
                        }`}
                      >
                        {opt.label}
                        {isActive && (sortDirection === 'asc'
                          ? <ArrowUp size={12} />
                          : <ArrowDown size={12} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Фильтры */}
            {(() => {
              const filters = activeCategory ? CATEGORY_FILTERS[activeCategory] : undefined;
              if (!filters || filters.length === 0) return null;
              const constants = categoryData?.constants || {};
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter size={14} className={hasActiveFilters ? 'text-gold shrink-0' : 'text-text-muted shrink-0'} />
                    {filters.map(dim => {
                      const selected = activeFilters[dim.key];
                      const count = selected?.size || 0;
                      const isExpanded = expandedFilter === dim.key;
                      return (
                        <button
                          key={dim.key}
                          onClick={() => setExpandedFilter(isExpanded ? null : dim.key)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                            count > 0
                              ? 'bg-gold/15 text-gold border border-gold/30'
                              : isExpanded
                                ? 'bg-bg-panel-solid text-text-primary border border-gold/30'
                                : 'bg-bg-panel-solid text-text-secondary border border-border-default hover:border-gold/30 hover:text-text-primary'
                          }`}
                        >
                          {dim.label}
                          {count > 0 && <span className="bg-gold/25 text-gold px-1 rounded-sm">{count}</span>}
                          <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      );
                    })}
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 border border-red-900/30 hover:border-red-700/40 bg-red-900/10 transition-colors"
                      >
                        <X size={12} />
                        {t('ui.reset')}
                      </button>
                    )}
                  </div>
                  {expandedFilter && (() => {
                    const dim = filters.find(f => f.key === expandedFilter);
                    if (!dim) return null;
                    const values = filterOptions.get(dim.key) || [];
                    const selected = activeFilters[dim.key];
                    return (
                      <div className="flex flex-wrap gap-1 p-2 bg-bg-panel-solid rounded-lg border border-border-default">
                        {values.map(val => {
                          const isSelected = selected?.has(val) || false;
                          return (
                            <button
                              key={val}
                              onClick={() => toggleFilter(dim.key, val)}
                              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                isSelected
                                  ? 'bg-gold/20 text-gold border border-gold/40'
                                  : 'bg-bg-primary/60 text-text-secondary border border-transparent hover:text-text-primary hover:border-border-default'
                              }`}
                            >
                              {dim.getLabel(val, constants)}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>

          {/* Список */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
            {filteredItems.map((item: any, index: number) => {
              const getImageUrl = categoryData?.constants?.getImageUrl as ((key: string) => string) | undefined;
              const imageUrlField = (categoryData?.constants?.imageUrlField as string) || 'name';
              const lookupKey = imageUrlField === 'name' ? (item._origName ?? item.name) : item[imageUrlField];
              const imgSrc = getImageUrl && lookupKey ? getImageUrl(lookupKey) : null;
              return (
                <button
                  key={`${item.name}-${index}`}
                  onClick={() => { setSelectedEntry({ type: activeCategory, data: item }); setSelectedSubclass(null); }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-bg-primary/40 hover:bg-bg-panel-solid border border-transparent hover:border-border-default transition-all text-left group"
                >
                  {imgSrc && (
                    <img
                      src={imgSrc}
                      alt=""
                      className="w-8 h-8 rounded object-cover shrink-0 bg-bg-panel"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text-primary group-hover:text-gold font-medium truncate">
                      {item.name || t('ui.noTitle')}
                    </div>
                    <div className="text-xs text-text-muted truncate">{getItemSubtitle(item)}</div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-gold shrink-0" />
                </button>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="text-center text-text-muted py-8">
                {searchQuery ? t('ui.nothingFound') : t('ui.noEntries')}
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
