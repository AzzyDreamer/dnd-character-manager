// Парсер тега {@filter Отображаемый текст|категория5etools|key=value;value2|key2=value}.
//
// parts[0] — видимый (переводимый) текст.
// parts[1] — категория в терминах 5etools (feats/spells/items/…).
// parts[2..] — опциональные параметры фильтра key=value (несколько значений через ';').

export interface ParsedFilter {
  displayText: string;
  category5etools: string;
  params: Record<string, string[]>;
}

export function parseFilterTag(content: string): ParsedFilter {
  const parts = content.split('|');
  const displayText = parts[0]?.trim() ?? '';
  const category5etools = parts[1]?.trim() ?? '';
  const params: Record<string, string[]> = {};

  for (let i = 2; i < parts.length; i++) {
    const seg = parts[i];
    const eq = seg.indexOf('=');
    if (eq === -1) continue;
    const key = seg.slice(0, eq).trim();
    const valRaw = seg.slice(eq + 1).trim();
    if (!key) continue;
    const values = valRaw.split(';').map(v => v.trim()).filter(Boolean);
    if (values.length) params[key] = values;
  }

  return { displayText, category5etools, params };
}

// Категория 5etools → категория глоссария приложения. null — категории нет в приложении
// (bestiary и т.п.), такой @filter рендерится как статический текст без клика.
const CATEGORY_MAP: Record<string, string> = {
  feats: 'feats',
  spells: 'spells',
  items: 'items',
  races: 'species',
  species: 'species',
  backgrounds: 'backgrounds',
  optionalfeatures: 'optionalfeatures',
  conditionsdiseases: 'conditions',
  conditions: 'conditions',
  actions: 'actions',
  variantrules: 'rules',
};

export function mapFilterCategory(category5etools: string): string | null {
  if (!category5etools) return null;
  return CATEGORY_MAP[category5etools.toLowerCase()] ?? null;
}
