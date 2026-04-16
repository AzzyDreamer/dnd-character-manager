// Загрузка всех действий из JSON файлов
import { applyOverlay } from '../translationOverlay';
const modules = import.meta.glob('./*.json');

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
    const entries = Object.entries(modules);
    for (const [, loader] of entries) {
      const mod = await (loader as () => Promise<any>)();
      const data = mod.default ?? mod;
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

export function getActionByName(name: string): ActionData | undefined {
  const lc = name.toLowerCase();
  return ALL_ACTIONS.find(a => a.name.toLowerCase() === lc || (a as any)._origName?.toLowerCase() === lc);
}
