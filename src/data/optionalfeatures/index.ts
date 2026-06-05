// Загрузка всех опциональных способностей из JSON файлов (ленивая batch загрузка)
import { applyOverlay } from '../translationOverlay';

export interface OptionalFeatureData {
  name: string;
  source: string;
  page?: number;
  featureType?: string[];
  prerequisite?: any[];
  entries: any[];
  [key: string]: any;
}

export const ALL_OPTIONAL_FEATURES: OptionalFeatureData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/optionalfeatures.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as OptionalFeatureData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_OPTIONAL_FEATURES.push(data as OptionalFeatureData);
      }
    }

    ALL_OPTIONAL_FEATURES.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('optionalfeatures', ALL_OPTIONAL_FEATURES, f => f.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_OPTIONAL_FEATURES.length = 0;
}

export function getOptionalFeatureByName(name: string): OptionalFeatureData | undefined {
  const lc = name.toLowerCase();
  return ALL_OPTIONAL_FEATURES.find(f => f.name.toLowerCase() === lc || (f as any)._origName?.toLowerCase() === lc);
}

import i18n from '../../i18n';

// Префиксы кодов трансформаций Grim Hollow (см. game.transformations).
// Композитный код вида "<префикс>:TB|TF" (например "AH:TB") разворачивается
// в «<Трансформация>: Дар/Изъян трансформации».
const TRANSFORMATION_PREFIXES = new Set([
  'AH', 'F', 'Fi', 'H', 'L', 'Ly', 'O', 'P', 'SG', 'Ser', 'Spec', 'V',
]);

function featureTypeLabel(code: string): string {
  const colon = code.indexOf(':');
  if (colon > 0) {
    const prefix = code.slice(0, colon);
    const suffix = code.slice(colon + 1);
    if ((suffix === 'TB' || suffix === 'TF') && TRANSFORMATION_PREFIXES.has(prefix)) {
      const tName = i18n.t(`transformations.${prefix}`, { ns: 'game', defaultValue: prefix });
      const kind = i18n.t(`transformationKinds.${suffix}`, { ns: 'game', defaultValue: suffix });
      return `${tName}: ${kind}`;
    }
  }
  // Двоеточие в коде i18next трактует как разделитель неймспейса — заменяем на '_'.
  return i18n.t(`featureTypes.${code.replace(/:/g, '_')}`, { ns: 'game', nsSeparator: false, defaultValue: code });
}

// Названия типов фич берём из i18n (game.featureTypes / transformations), чтобы они
// переключались вместе с языком. Доступ остаётся прежним: FEATURE_TYPE_NAMES[code].
export const FEATURE_TYPE_NAMES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, code) {
    if (typeof code !== 'string') return undefined;
    return featureTypeLabel(code);
  },
});
