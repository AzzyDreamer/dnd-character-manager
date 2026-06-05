// Загрузка всех действий из единого бандла (scripts/bundle-data.mjs).
import { applyOverlay } from '../translationOverlay';

export interface ActionData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  time?: any[];
  entries: any[];
  [key: string]: any;
}

export const ALL_ACTIONS: ActionData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/actions.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as ActionData[];
    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_ACTIONS.push(data as ActionData);
      }
    }
    ALL_ACTIONS.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('actions', ALL_ACTIONS, a => a.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_ACTIONS.length = 0;
}

export function getActionByName(name: string): ActionData | undefined {
  const lc = name.toLowerCase();
  return ALL_ACTIONS.find(a => a.name.toLowerCase() === lc || (a as any)._origName?.toLowerCase() === lc);
}
