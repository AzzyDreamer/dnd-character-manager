// Утилиты для тега {@scaledamage BASE|RANGE|PER_LEVEL} и сестринского {@scaledice}.
//
// Формат: {@scaledamage 3d6|1-9|1d6} — базовый урон 3d6, при касте на уровень ячейки
// N (в пределах диапазона 1–9) добавляется (N - baseLevel) × 1d6.

export interface ScaledDamageParts {
  base: string;            // "3d6" | "2d8 + 1d6"
  range: [number, number]; // [1, 9]
  perLevel: string;        // "1d6"
}

// faces === 0 — плоский числовой модификатор (например "+5").
interface DiceTerm {
  count: number;
  faces: number;
}

function parseTerms(expr: string): DiceTerm[] {
  const terms: DiceTerm[] = [];
  for (const raw of expr.split('+')) {
    const t = raw.trim();
    if (!t) continue;
    const dice = t.match(/^(\d+)\s*d\s*(\d+)$/i);
    if (dice) {
      terms.push({ count: parseInt(dice[1], 10), faces: parseInt(dice[2], 10) });
      continue;
    }
    const flat = t.match(/^(\d+)$/);
    if (flat) {
      terms.push({ count: parseInt(flat[1], 10), faces: 0 });
    }
    // Прочее (текстовые куски вроде "your modifier") игнорируем.
  }
  return terms;
}

function formatTerms(terms: DiceTerm[]): string {
  return terms
    .filter(t => t.count !== 0)
    .map(t => (t.faces === 0 ? String(t.count) : `${t.count}d${t.faces}`))
    .join(' + ');
}

// Прибавляет к `into` термы `add`, умноженные на `multiplier`, сливая одинаковые кубики.
function addScaledTerms(into: DiceTerm[], add: DiceTerm[], multiplier: number): void {
  for (const term of add) {
    const count = term.count * multiplier;
    const existing = into.find(t => t.faces === term.faces);
    if (existing) existing.count += count;
    else into.push({ count, faces: term.faces });
  }
}

export function parseScaledDamage(content: string): ScaledDamageParts | null {
  const parts = content.split('|');
  if (parts.length < 3) return null;

  const base = parts[0].trim();
  const perLevel = parts[2].trim();
  if (!base || !perLevel) return null;

  const rangeRaw = parts[1].trim();
  let range: [number, number] = [1, 9];
  const m = rangeRaw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) {
    range = [parseInt(m[1], 10), parseInt(m[2], 10)];
  } else {
    const single = rangeRaw.match(/^(\d+)$/);
    if (single) range = [parseInt(single[1], 10), parseInt(single[1], 10)];
  }

  return { base, range, perLevel };
}

/**
 * Пересчитать дайс-строку для каста на уровне `castLevel`:
 * base + (castLevel - baseLevel) × perLevel, со слиянием одинаковых кубиков.
 * castLevel ограничивается верхней границей диапазона.
 */
export function computeScaledDice(parts: ScaledDamageParts, baseLevel: number, castLevel: number): string {
  const effectiveCast = Math.min(castLevel, parts.range[1]);
  const extra = Math.max(0, effectiveCast - baseLevel);

  const terms = parseTerms(parts.base);
  if (extra > 0) addScaledTerms(terms, parseTerms(parts.perLevel), extra);

  return formatTerms(terms) || parts.base;
}

/** Умножить выражение из кубиков на множитель (для бонуса прироста за уровни ячейки). */
export function scaleDiceExpression(expr: string, multiplier: number): string {
  if (multiplier <= 0) return '';
  const terms = parseTerms(expr).map(t => ({ count: t.count * multiplier, faces: t.faces }));
  return formatTerms(terms);
}
