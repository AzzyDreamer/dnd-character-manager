// Центральный реестр всех данных — обеспечивает поиск по типу тега и имени
import { ALL_SPELLS, getSpellByName, type SpellData } from './spells';
import { ALL_FEATS, getFeatByName, type FeatData } from './feats';
import { ALL_SPECIES, getSpeciesByName, type SpeciesData } from './species';
import { ALL_CONDITIONS, getConditionByName, type ConditionDiseaseData } from './conditionsdiseases';
import { ALL_SENSES, getSenseByName, type SenseData } from './senses';
import { ALL_SKILLS, getSkillByName, type SkillData } from './skills';
import { ALL_VARIANT_RULES, getVariantRuleByName, type VariantRuleData } from './variantrule';
import { ALL_OPTIONAL_FEATURES, getOptionalFeatureByName, type OptionalFeatureData } from './optionalfeatures';
import { ALL_JSON_BACKGROUNDS, getJsonBackgroundByName, type JsonBackgroundData } from './backgrounds/jsonBackgrounds';
import { ALL_ITEMS_BASE, getItemBaseByName, type ItemBaseData } from './items-base';
import { ITEM_TEMPLATES, getItemTemplate, type ItemTemplate } from './items';

// Тип для результата поиска
export interface RegistryEntry {
  type: string;
  name: string;
  source?: string;
  entries?: any[];
  data: any;
}

// Тип тега → функция поиска
export function lookupByTag(tagType: string, name: string): RegistryEntry | undefined {
  // Убираем source часть из имени (формат: "Name|Source|DisplayName")
  const parts = name.split('|');
  const entityName = parts[0].trim();
  // const source = parts[1]?.trim(); // можно использовать для фильтрации

  switch (tagType) {
    case 'spell': {
      const spell = getSpellByName(entityName);
      if (spell) return { type: 'spell', name: spell.name, source: spell.source, entries: spell.entries, data: spell };
      break;
    }
    case 'feat': {
      const feat = getFeatByName(entityName);
      if (feat) return { type: 'feat', name: feat.name, source: feat.source, entries: feat.entries, data: feat };
      break;
    }
    case 'condition': {
      const cond = getConditionByName(entityName);
      if (cond) return { type: 'condition', name: cond.name, source: cond.source, entries: cond.entries, data: cond };
      break;
    }
    case 'disease': {
      const dis = getConditionByName(entityName);
      if (dis) return { type: 'disease', name: dis.name, source: dis.source, entries: dis.entries, data: dis };
      break;
    }
    case 'skill': {
      const skill = getSkillByName(entityName);
      if (skill) return { type: 'skill', name: skill.name, source: skill.source, entries: skill.entries, data: skill };
      break;
    }
    case 'sense': {
      const sense = getSenseByName(entityName);
      if (sense) return { type: 'sense', name: sense.name, source: sense.source, entries: sense.entries, data: sense };
      break;
    }
    case 'variantrule': {
      // Поддержка формата "Name [Alias]|Source|Display"
      let ruleName = entityName;
      const bracketIdx = ruleName.indexOf(' [');
      if (bracketIdx > -1) ruleName = ruleName.substring(0, bracketIdx);
      const rule = getVariantRuleByName(ruleName);
      if (rule) return { type: 'variantrule', name: rule.name, source: rule.source, entries: rule.entries, data: rule };
      break;
    }
    case 'optfeature': {
      const opt = getOptionalFeatureByName(entityName);
      if (opt) return { type: 'optfeature', name: opt.name, source: opt.source, entries: opt.entries, data: opt };
      break;
    }
    case 'item': {
      // Сначала ищем в items (loaded from items/index.ts)
      const itemId = entityName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const item = getItemTemplate(itemId);
      if (item) return { type: 'item', name: item.name, source: item.raw.source, entries: item.raw.entries, data: item };
      // Затем в items-base
      const itemBase = getItemBaseByName(entityName);
      if (itemBase) return { type: 'item', name: itemBase.name, source: itemBase.source, entries: itemBase.entries, data: itemBase };
      break;
    }
    case 'background': {
      const bg = getJsonBackgroundByName(entityName);
      if (bg) return { type: 'background', name: bg.name, source: bg.source, entries: bg.entries, data: bg };
      break;
    }
    case 'race':
    case 'species': {
      const sp = getSpeciesByName(entityName);
      if (sp) return { type: 'species', name: sp.name, source: sp.source, entries: sp.entries, data: sp };
      break;
    }
    case 'action':
    case 'hazard':
    case 'quickref':
    case 'creature':
    case 'card':
    case 'itemProperty': {
      // Пытаемся найти в variant rules (actions часто описаны там)
      const actionRule = getVariantRuleByName(entityName);
      if (actionRule) return { type: tagType, name: actionRule.name, source: actionRule.source, entries: actionRule.entries, data: actionRule };
      break;
    }
    default:
      break;
  }

  return undefined;
}

// Получить отображаемое имя тега
export function getTagDisplayName(tagType: string, content: string): string {
  const parts = content.split('|');
  // Если есть третья часть — это display name
  if (parts.length >= 3 && parts[2].trim()) return parts[2].trim();
  // Иначе берём первую часть (имя)
  let name = parts[0].trim();
  // Удаляем часть в квадратных скобках: "Name [Alias]" → "Alias" или "Name"
  const bracketMatch = name.match(/^(.+?)\s*\[(.+?)\]$/);
  if (bracketMatch) {
    return bracketMatch[2]; // Возвращаем alias
  }
  return name;
}

// Экспорт всех коллекций
export {
  ALL_SPELLS, getSpellByName, type SpellData,
  ALL_FEATS, getFeatByName, type FeatData,
  ALL_SPECIES, getSpeciesByName, type SpeciesData,
  ALL_CONDITIONS, getConditionByName, type ConditionDiseaseData,
  ALL_SENSES, getSenseByName, type SenseData,
  ALL_SKILLS, getSkillByName, type SkillData,
  ALL_VARIANT_RULES, getVariantRuleByName, type VariantRuleData,
  ALL_OPTIONAL_FEATURES, getOptionalFeatureByName, type OptionalFeatureData,
  ALL_JSON_BACKGROUNDS, getJsonBackgroundByName, type JsonBackgroundData,
  ALL_ITEMS_BASE, getItemBaseByName, type ItemBaseData,
  ITEM_TEMPLATES, getItemTemplate, type ItemTemplate,
};

// Типы категорий для глоссария
export type GlossaryCategory =
  | 'spells'
  | 'feats'
  | 'species'
  | 'backgrounds'
  | 'conditions'
  | 'senses'
  | 'skills'
  | 'rules'
  | 'optionalfeatures'
  | 'items';

export const GLOSSARY_CATEGORIES: { key: GlossaryCategory; label: string; count: () => number }[] = [
  { key: 'spells', label: 'Заклинания', count: () => ALL_SPELLS.length },
  { key: 'feats', label: 'Черты', count: () => ALL_FEATS.length },
  { key: 'species', label: 'Виды', count: () => ALL_SPECIES.length },
  { key: 'backgrounds', label: 'Предыстории', count: () => ALL_JSON_BACKGROUNDS.length },
  { key: 'conditions', label: 'Состояния и болезни', count: () => ALL_CONDITIONS.length },
  { key: 'senses', label: 'Чувства', count: () => ALL_SENSES.length },
  { key: 'skills', label: 'Навыки', count: () => ALL_SKILLS.length },
  { key: 'rules', label: 'Правила', count: () => ALL_VARIANT_RULES.length },
  { key: 'optionalfeatures', label: 'Особые способности', count: () => ALL_OPTIONAL_FEATURES.length },
  { key: 'items', label: 'Предметы', count: () => ITEM_TEMPLATES.length + ALL_ITEMS_BASE.length },
];
