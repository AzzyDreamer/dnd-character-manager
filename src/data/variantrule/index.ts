// Загрузка всех вариантных правил из JSON файлов (ленивая загрузка)
import { applyOverlay } from '../translationOverlay';
import { makeLabelProxy } from '../labelProxy';

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
    const mod = await import('../_bundles/variantrule.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as VariantRuleData[];
    for (const data of items) {
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

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_VARIANT_RULES.length = 0;
}

export function getVariantRuleByName(name: string): VariantRuleData | undefined {
  const lc = name.toLowerCase();
  return ALL_VARIANT_RULES.find(r => r.name.toLowerCase() === lc || (r as any)._origName?.toLowerCase() === lc);
}

// Названия типов правил берём из i18n (game.ruleTypes), чтобы они переключались
// вместе с языком. Доступ остаётся прежним: RULE_TYPE_NAMES[code].
export const RULE_TYPE_NAMES: Record<string, string> = makeLabelProxy('ruleTypes', 'game');
