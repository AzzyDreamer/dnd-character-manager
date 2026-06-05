// Загрузка всех опций создания персонажа из JSON файлов (ленивая batch загрузка)
import { applyOverlay } from '../translationOverlay';
import { makeLabelProxy } from '../labelProxy';

export interface CharacterCreationOptionData {
  name: string;
  source: string;
  page?: number;
  optionType?: string[];
  entries: any[];
  hasFluffImages?: boolean;
  fluff?: any;
  [key: string]: any;
}

export const ALL_CHARACTER_CREATION_OPTIONS: CharacterCreationOptionData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/charactercreationoptions.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as CharacterCreationOptionData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_CHARACTER_CREATION_OPTIONS.push(data as CharacterCreationOptionData);
      }
    }

    ALL_CHARACTER_CREATION_OPTIONS.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('charactercreationoptions', ALL_CHARACTER_CREATION_OPTIONS, c => c.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_CHARACTER_CREATION_OPTIONS.length = 0;
}

export function getCharacterCreationOptionByName(name: string): CharacterCreationOptionData | undefined {
  const lc = name.toLowerCase();
  return ALL_CHARACTER_CREATION_OPTIONS.find(o => o.name.toLowerCase() === lc || (o as any)._origName?.toLowerCase() === lc);
}

// Названия типов опций берём из i18n (character.creation.optionTypes), чтобы они
// переключались вместе с языком. Доступ остаётся прежним: OPTION_TYPE_NAMES[code].
export const OPTION_TYPE_NAMES: Record<string, string> = makeLabelProxy('creation.optionTypes', 'character');
