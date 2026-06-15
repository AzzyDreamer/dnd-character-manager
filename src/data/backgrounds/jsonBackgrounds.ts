// Загрузка JSON предысторий (5etools формат) из единого бандла (scripts/bundle-data.mjs).
import { applyOverlay } from '../translationOverlay';

export interface JsonBackgroundData {
  name: string;
  source: string;
  page?: number;
  edition?: string;
  ability?: any[];
  feats?: any[];
  skillProficiencies?: any[];
  toolProficiencies?: any[];
  startingEquipment?: any[];
  entries: any[];
  fluff?: string[];
  /** Имя исходного файла = ключ перевода (см. scripts/bundle-data.mjs). */
  _i18nStem?: string;
  [key: string]: any;
}

export const ALL_JSON_BACKGROUNDS: JsonBackgroundData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/backgrounds.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as JsonBackgroundData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_JSON_BACKGROUNDS.push(data as JsonBackgroundData);
      }
    }

    // Resolve _copy references: inherit fields from parent background
    // Multiple passes to handle chained copies (A -> B -> C)
    for (let pass = 0; pass < 3; pass++) {
      for (const bg of ALL_JSON_BACKGROUNDS) {
        if (!bg._copy) continue;
        // Try exact match first, then fallback to name-only match
        const parent = ALL_JSON_BACKGROUNDS.find(
          p => p.name === bg._copy.name && p.source === bg._copy.source
        ) ?? ALL_JSON_BACKGROUNDS.find(
          p => p.name === bg._copy.name && p !== bg
        );
        if (parent) {
          const copyFields = [
            'ability', 'feats', 'skillProficiencies', 'toolProficiencies',
            'languageProficiencies', 'startingEquipment', 'entries', 'edition',
          ];
          for (const field of copyFields) {
            if (bg[field] === undefined && parent[field] !== undefined) {
              bg[field] = parent[field];
            }
          }
        }
      }
    }

    ALL_JSON_BACKGROUNDS.sort((a, b) => a.name.localeCompare(b.name));
    // Ключ перевода — стем файла (_i18nStem), а не name: иначе предыстории с
    // одинаковым name (Courtier SCAG/GHPG24, Baldur's Gate Criminal/Entertainer)
    // схлопывались бы в один перевод. Фоллбек на name — для устаревшего бандла.
    await applyOverlay('backgrounds', ALL_JSON_BACKGROUNDS, b => b._i18nStem ?? b.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_JSON_BACKGROUNDS.length = 0;
}

export function getJsonBackgroundByName(name: string): JsonBackgroundData | undefined {
  const lc = name.toLowerCase();
  return ALL_JSON_BACKGROUNDS.find(b => b.name.toLowerCase() === lc || (b as any)._origName?.toLowerCase() === lc);
}

/**
 * Заклинания, которыми предыстория расширяет список класса (Ravnica/Strixhaven:
 * additionalSpells.expanded). Возвращает имена в нижнем регистре без тегов
 * источника/заговора ("encode thoughts|ggr#c" → "encode thoughts").
 */
export function getBackgroundExpandedSpellNames(bg: JsonBackgroundData | undefined): string[] {
  if (!bg?.additionalSpells) return [];
  const names: string[] = [];
  for (const group of bg.additionalSpells as { expanded?: Record<string, unknown[]> }[]) {
    const exp = group?.expanded;
    if (!exp) continue;
    for (const arr of Object.values(exp)) {
      if (!Array.isArray(arr)) continue;
      for (const raw of arr) {
        if (typeof raw === 'string') {
          names.push(raw.replace(/#c$/, '').split('|')[0].trim().toLowerCase());
        }
      }
    }
  }
  return [...new Set(names)];
}
