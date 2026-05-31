// Центральный реестр всех данных — предзагрузка при старте приложения

import i18n from '../i18n';

// ─── Типы ───
export interface RegistryEntry {
  type: string;
  name: string;
  source?: string;
  entries?: any[];
  data: any;
}

export interface LoadProgress {
  phase: string;
  loaded: number;
  total: number;
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
let _charCreationOptions: any = null;
let _classes: any = null;
let _subclasses: any = null;
let _actions: any = null;
let _itemProperties: any = null;

let _initialized = false;
let _initializing: Promise<void> | null = null;

const PHASE_KEYS = [
  'spells', 'feats', 'species', 'conditions', 'senses', 'skills',
  'rules', 'optfeatures', 'backgrounds', 'classes', 'subclasses',
  'itemsBase', 'items', 'charOptions', 'actions', 'itemProperties',
];

function getPhaseLabel(key: string): string {
  return i18n.t(`registry.${key}`, { ns: 'game' });
}

// ─── Инициализация с прогрессом ───
export async function initRegistry(onProgress?: (p: LoadProgress) => void): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  const total = PHASE_KEYS.length;
  let loaded = 0;

  const report = (key: string) => {
    loaded++;
    onProgress?.({ phase: getPhaseLabel(key), loaded, total });
  };

  _initializing = (async () => {
    try {
      _spells = await import('./spells');
      await _spells.init();
      report('spells');

      _feats = await import('./feats');
      await _feats.init();
      report('feats');

      _species = await import('./species');
      await _species.init();
      report('species');

      _conditions = await import('./conditionsdiseases');
      await _conditions.init();
      report('conditions');

      _senses = await import('./senses');
      await _senses.init();
      report('senses');

      _skills = await import('./skills');
      await _skills.init();
      report('skills');

      _variantrule = await import('./variantrule');
      await _variantrule.init();
      report('rules');

      _optfeatures = await import('./optionalfeatures');
      await _optfeatures.init();
      report('optfeatures');

      _backgrounds = await import('./backgrounds/jsonBackgrounds');
      await _backgrounds.init();
      report('backgrounds');

      _classes = await import('./classes/classJsonLoader');
      await _classes.init();
      report('classes');

      _subclasses = await import('./classes/subclassJsonLoader');
      await _subclasses.init();
      report('subclasses');

      _itemsBase = await import('./items-base');
      await _itemsBase.init();
      report('itemsBase');

      _items = await import('./items');
      await _items.init();
      _items.buildAllTemplatesCache(_itemsBase);
      report('items');

      _charCreationOptions = await import('./charactercreationoptions');
      await _charCreationOptions.init();
      report('charOptions');

      _actions = await import('./actions');
      await _actions.init();
      report('actions');

      _itemProperties = await import('./itemproperties');
      await _itemProperties.init();
      report('itemProperties');

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
  const entitySource = parts[1]?.trim();

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
    case 'status': {
      const status = _conditions.getConditionByName(entityName);
      if (status) return { type: 'condition', name: status.name, source: status.source, entries: status.entries, data: status };
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
      // Сначала ищем по полному имени, потом без скобок
      let rule = _variantrule.getVariantRuleByName(entityName);
      if (!rule) {
        const bracketIdx = entityName.indexOf(' [');
        if (bracketIdx > -1) {
          const shortName = entityName.substring(0, bracketIdx);
          rule = _variantrule.getVariantRuleByName(shortName);
        }
      }
      if (rule) return { type: 'variantrule', name: rule.name, source: rule.source, entries: rule.entries, data: rule };
      break;
    }
    case 'optfeature': {
      const opt = _optfeatures.getOptionalFeatureByName(entityName);
      if (opt) return { type: 'optfeature', name: opt.name, source: opt.source, entries: opt.entries, data: opt };
      break;
    }
    case 'invocation': {
      // @invocation — алиас @optfeature, неявно отфильтрованный по featureType=EI (Eldritch Invocation).
      // Данные уже лежат в optionalfeatures, отдельной загрузки не нужно.
      if (_optfeatures) {
        const opt = _optfeatures.getOptionalFeatureByName(entityName);
        if (opt) return { type: 'optfeature', name: opt.name, source: opt.source, entries: opt.entries, data: opt };
      }
      break;
    }
    case 'class': {
      // {@class Wizard|XPHB|display|hash|Subclass|SubSource} — источник в parts[1] игнорируем (single-source).
      if (_classes) {
        const cls = _classes.getClassDataByName(entityName);
        if (cls) {
          const entries: any[] = Array.isArray(cls.fluff) ? cls.fluff : [];
          return { type: 'class', name: cls.name, source: cls.source, entries, data: cls };
        }
      }
      break;
    }
    case 'subclass': {
      // {@subclass Bladesinger|Wizard|TCE|display} — parts[1] это ИМЯ КЛАССА, не источник.
      if (_subclasses && _classes) {
        const className = parts[1]?.trim();
        if (className) {
          const cls = _classes.getClassDataByName(className);
          if (cls) {
            const sub = _subclasses.getSubclassByName(cls.id, entityName);
            if (sub) {
              const entries: any[] = [];
              if (sub.shortDescription) entries.push(sub.shortDescription);
              else if (sub.description) entries.push(sub.description);
              return { type: 'subclass', name: sub.name, source: sub.source, entries, data: sub };
            }
          }
        }
      }
      break;
    }
    case 'item': {
      const fullItem = _items.getItemByName(entityName, entitySource);
      if (fullItem) return { type: 'item', name: fullItem.name, source: fullItem.source, entries: fullItem.entries, data: fullItem };
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
    case 'charoption': {
      const charOpt = _charCreationOptions.getCharacterCreationOptionByName(entityName);
      if (charOpt) return { type: 'charoption', name: charOpt.name, source: charOpt.source, entries: charOpt.entries, data: charOpt };
      break;
    }
    case 'action': {
      if (_actions) {
        const action = _actions.getActionByName(entityName);
        if (action) return { type: 'action', name: action.name, source: action.source, entries: action.entries, data: action };
      }
      // Фоллбэк на варианты правил
      const actionRule = _variantrule.getVariantRuleByName(entityName);
      if (actionRule) return { type: 'action', name: actionRule.name, source: actionRule.source, entries: actionRule.entries, data: actionRule };
      break;
    }
    case 'itemProperty': {
      // Тег формата {@itemProperty CODE|SOURCE|DisplayName}, например L|XPHB|Light.
      // Сначала ищем по коду свойства (case-insensitive, с предпочтением источника).
      if (_itemProperties) {
        const prop = _itemProperties.getItemPropertyByCode(entityName, entitySource);
        if (prop) return { type: 'itemProperty', name: prop.name, source: prop.source, entries: prop.entries, data: prop };
      }
      // Фоллбэк на варианты правил — если кто-то использовал тег с полным именем правила.
      const rule = _variantrule.getVariantRuleByName(entityName);
      if (rule) return { type: 'itemProperty', name: rule.name, source: rule.source, entries: rule.entries, data: rule };
      break;
    }
    case 'hazard':
    case 'quickref':
    case 'creature':
    case 'card': {
      const rule = _variantrule.getVariantRuleByName(entityName);
      if (rule) return { type: tagType, name: rule.name, source: rule.source, entries: rule.entries, data: rule };
      break;
    }
    default:
      break;
  }

  return undefined;
}

// ─── Получить отображаемое имя тега ───
export function getTagDisplayName(tagType: string, content: string): string {
  const parts = content.split('|');
  // {@subclass Name|className|source|displayText} — отображаемый текст в 4-м сегменте,
  // parts[2] здесь это источник, а не текст ссылки.
  if (tagType === 'subclass') {
    if (parts.length >= 4 && parts[3].trim()) return parts[3].trim();
    return parts[0].trim();
  }
  if (parts.length >= 3 && parts[2].trim()) return parts[2].trim();
  let name = parts[0].trim();
  const bracketMatch = name.match(/^(.+?)\s*\[(.+?)\]$/);
  if (bracketMatch) {
    return bracketMatch[2];
  }
  return name;
}

// ─── Доступ к данным ───
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
    classes: _classes,
    subclasses: _subclasses,
    itemsBase: _itemsBase,
    items: _items,
    charCreationOptions: _charCreationOptions,
    actions: _actions,
    itemProperties: _itemProperties,
  };
}
