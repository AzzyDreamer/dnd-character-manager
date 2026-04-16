// Загрузка всех вариантных правил из JSON файлов (ленивая загрузка)
import { applyOverlay } from '../translationOverlay';
const modules = import.meta.glob('./*.json');

export interface VariantRuleData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  ruleType?: string;
  entries: any[];
  [key: string]: any;
}

export const ALL_VARIANT_RULES: VariantRuleData[] = [];

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
        ALL_VARIANT_RULES.push(data as VariantRuleData);
      }
    }
    ALL_VARIANT_RULES.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('variantrule', ALL_VARIANT_RULES, v => v.name);
    _initialized = true;
  })();

  return _initializing;
}

export function getVariantRuleByName(name: string): VariantRuleData | undefined {
  const lc = name.toLowerCase();
  return ALL_VARIANT_RULES.find(r => r.name.toLowerCase() === lc || (r as any)._origName?.toLowerCase() === lc);
}

export const RULE_TYPE_NAMES: Record<string, string> = {
  O: 'Опциональное правило',
  V: 'Вариантное правило',
  C: 'Основное правило',
  U: 'Неклассифицированное',
};
