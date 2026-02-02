// Загрузка всех вариантных правил из JSON файлов
const modules = import.meta.glob('./*.json', { eager: true });

export interface VariantRuleData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  ruleType?: string;
  entries: any[];
  [key: string]: any;
}

const ALL_VARIANT_RULES: VariantRuleData[] = [];

for (const path of Object.keys(modules)) {
  const mod = modules[path] as any;
  const data = mod.default ?? mod;
  if (data && typeof data === 'object' && data.name) {
    ALL_VARIANT_RULES.push(data as VariantRuleData);
  }
}

ALL_VARIANT_RULES.sort((a, b) => a.name.localeCompare(b.name));

export { ALL_VARIANT_RULES };

export function getVariantRuleByName(name: string): VariantRuleData | undefined {
  return ALL_VARIANT_RULES.find(r => r.name.toLowerCase() === name.toLowerCase());
}

export const RULE_TYPE_NAMES: Record<string, string> = {
  O: 'Опциональное правило',
  V: 'Вариантное правило',
  C: 'Основное правило',
  U: 'Неклассифицированное',
};
