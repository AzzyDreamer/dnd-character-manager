// Центральный реестр всех данных — ленивая загрузка модулей
// НЕ импортирует данные на верхнем уровне, чтобы не грузить ~3500 JSON в dev mode

// ─── Типы (только описания, без runtime-импортов) ───
export interface RegistryEntry {
  type: string;
  name: string;
  source?: string;
  entries?: any[];
  data: any;
}

// ─── Кеш загруженных модулей ───
let _spells: any = null;
let _feats: any = null;
let _species: any = null;
let _conditions: any = null;
let _senses: any = null;
let _skills: any = null;
let _variantrule: any = null;
let _optfeatures: any = null;
let _backgrounds: any = null;
let _itemsBase: any = null;
let _items: any = null;

let _initialized = false;
let _initializing: Promise<void> | null = null;

// ─── Инициализация: загружает все модули данных ───
export async function initRegistry(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    try {
      // Загружаем модули последовательно — каждый модуль имеет init() который
      // загружает JSON файлы через ленивый import.meta.glob
      _spells = await import('./spells');
      await _spells.init();

      _feats = await import('./feats');
      await _feats.init();

      _species = await import('./species');
      await _species.init();

      _conditions = await import('./conditionsdiseases');
      await _conditions.init();

      _senses = await import('./senses');
      await _senses.init();

      _skills = await import('./skills');
      await _skills.init();

      _variantrule = await import('./variantrule');
      await _variantrule.init();

      _optfeatures = await import('./optionalfeatures');
      await _optfeatures.init();

      _backgrounds = await import('./backgrounds/jsonBackgrounds');
      await _backgrounds.init();

      _itemsBase = await import('./items-base');
      await _itemsBase.init();

      _items = await import('./items');
      // items не использует glob, так что init не нужен

      _initialized = true;
    } catch (e) {
      console.error('Failed to initialize registry:', e);
      _initializing = null;
      throw e;
    }
  })();

  return _initializing;
}

export function isInitialized(): boolean {
  return _initialized;
}

// ─── Поиск по типу тега ───
export function lookupByTag(tagType: string, name: string): RegistryEntry | undefined {
  if (!_initialized) return undefined;

  const parts = name.split('|');
  const entityName = parts[0].trim();

  switch (tagType) {
    case 'spell': {
      const spell = _spells.getSpellByName(entityName);
      if (spell) return { type: 'spell', name: spell.name, source: spell.source, entries: spell.entries, data: spell };
      break;
    }
    case 'feat': {
      const feat = _feats.getFeatByName(entityName);
      if (feat) return { type: 'feat', name: feat.name, source: feat.source, entries: feat.entries, data: feat };
      break;
    }
    case 'condition': {
      const cond = _conditions.getConditionByName(entityName);
      if (cond) return { type: 'condition', name: cond.name, source: cond.source, entries: cond.entries, data: cond };
      break;
    }
    case 'disease': {
      const dis = _conditions.getConditionByName(entityName);
      if (dis) return { type: 'disease', name: dis.name, source: dis.source, entries: dis.entries, data: dis };
      break;
    }
    case 'skill': {
      const skill = _skills.getSkillByName(entityName);
      if (skill) return { type: 'skill', name: skill.name, source: skill.source, entries: skill.entries, data: skill };
      break;
    }
    case 'sense': {
      const sense = _senses.getSenseByName(entityName);
      if (sense) return { type: 'sense', name: sense.name, source: sense.source, entries: sense.entries, data: sense };
      break;
    }
    case 'variantrule': {
      let ruleName = entityName;
      const bracketIdx = ruleName.indexOf(' [');
      if (bracketIdx > -1) ruleName = ruleName.substring(0, bracketIdx);
      const rule = _variantrule.getVariantRuleByName(ruleName);
      if (rule) return { type: 'variantrule', name: rule.name, source: rule.source, entries: rule.entries, data: rule };
      break;
    }
    case 'optfeature': {
      const opt = _optfeatures.getOptionalFeatureByName(entityName);
      if (opt) return { type: 'optfeature', name: opt.name, source: opt.source, entries: opt.entries, data: opt };
      break;
    }
    case 'item': {
      const itemId = entityName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const item = _items.getItemTemplate(itemId);
      if (item) return { type: 'item', name: item.name, source: item.raw.source, entries: item.raw.entries, data: item };
      const itemBase = _itemsBase.getItemBaseByName(entityName);
      if (itemBase) return { type: 'item', name: itemBase.name, source: itemBase.source, entries: itemBase.entries, data: itemBase };
      break;
    }
    case 'background': {
      const bg = _backgrounds.getJsonBackgroundByName(entityName);
      if (bg) return { type: 'background', name: bg.name, source: bg.source, entries: bg.entries, data: bg };
      break;
    }
    case 'race':
    case 'species': {
      const sp = _species.getSpeciesByName(entityName);
      if (sp) return { type: 'species', name: sp.name, source: sp.source, entries: sp.entries, data: sp };
      break;
    }
    case 'action':
    case 'hazard':
    case 'quickref':
    case 'creature':
    case 'card':
    case 'itemProperty': {
      const actionRule = _variantrule.getVariantRuleByName(entityName);
      if (actionRule) return { type: tagType, name: actionRule.name, source: actionRule.source, entries: actionRule.entries, data: actionRule };
      break;
    }
    default:
      break;
  }

  return undefined;
}

// ─── Получить отображаемое имя тега (работает без инициализации) ───
export function getTagDisplayName(tagType: string, content: string): string {
  const parts = content.split('|');
  if (parts.length >= 3 && parts[2].trim()) return parts[2].trim();
  let name = parts[0].trim();
  const bracketMatch = name.match(/^(.+?)\s*\[(.+?)\]$/);
  if (bracketMatch) {
    return bracketMatch[2];
  }
  return name;
}

// ─── Доступ к данным (после инициализации) ───
export function getLoadedModules() {
  if (!_initialized) return null;
  return {
    spells: _spells,
    feats: _feats,
    species: _species,
    conditions: _conditions,
    senses: _senses,
    skills: _skills,
    variantrule: _variantrule,
    optfeatures: _optfeatures,
    backgrounds: _backgrounds,
    itemsBase: _itemsBase,
    items: _items,
  };
}
