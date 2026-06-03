// Загрузка всех навыков из JSON файлов (ленивая загрузка)
import { applyOverlay } from '../translationOverlay';
import { asset } from '../../utils/asset';

export interface SkillData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  ability: string;
  entries: any[];
  [key: string]: any;
}

export const ALL_SKILLS: SkillData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/skills.json');
    const items = (mod.default ?? mod) as SkillData[];
    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_SKILLS.push(data as SkillData);
      }
    }
    ALL_SKILLS.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('skills', ALL_SKILLS, s => s.name);
    _initialized = true;
  })();

  return _initializing;
}

export function getSkillByName(name: string): SkillData | undefined {
  const lc = name.toLowerCase();
  return ALL_SKILLS.find(s => s.name.toLowerCase() === lc || (s as any)._origName?.toLowerCase() === lc);
}

// Конвертирует "Animal Handling" → "animalHandling" (camelCase, как в файлах изображений)
function toCamelCase(name: string): string {
  return name
    .split(/\s+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function getSkillImageUrl(name: string): string {
  // Resolve back to the English name (overlay preserves it as _origName) so
  // translated names map to the correct camelCase image filename.
  const skill = getSkillByName(name);
  const baseName = (skill as { _origName?: string } | undefined)?._origName ?? skill?.name ?? name;
  return asset(`/images/skills/${toCamelCase(baseName)}.webp`);
}

import i18n from '../../i18n';

// Маппинг сокращений 5etools → полные ключи i18n
const ABBR_TO_FULL: Record<string, string> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
};

// Объект-прокси для обратной совместимости (ABILITY_ABBR_NAMES['str'] → "Сила")
export const ABILITY_ABBR_NAMES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    const fullKey = ABBR_TO_FULL[prop];
    if (fullKey) return i18n.t(`abilities.${fullKey}`, { ns: 'game' });
    return prop;
  },
});
