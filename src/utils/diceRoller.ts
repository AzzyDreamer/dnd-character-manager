// ─── Dice Rolling Utility ───

export interface DiceRollResult {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
}

export interface AdvantageRollResult {
  mode: 'advantage' | 'disadvantage';
  roll1: DiceRollResult;
  roll2: DiceRollResult;
  chosen: DiceRollResult;
}

export interface DiceExpression {
  count: number;
  sides: number;
  modifier: number;
}

/**
 * Parse a simple dice expression like "2d6+3", "1d8 - 2", "1d20"
 */
export function parseDiceExpression(expr: string): DiceExpression | null {
  const cleaned = expr.replace(/\s/g, '');
  const match = cleaned.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!match) return null;
  return {
    count: parseInt(match[1], 10),
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0,
  };
}

/**
 * Roll dice for a given simple expression string
 */
export function rollDice(expr: string, extraModifier = 0, multiplier = 1): DiceRollResult {
  const parsed = parseDiceExpression(expr);
  if (!parsed) {
    return { expression: expr, rolls: [], modifier: 0, total: 0 };
  }

  const totalCount = parsed.count * multiplier;
  const rolls: number[] = [];
  for (let i = 0; i < totalCount; i++) {
    rolls.push(Math.floor(Math.random() * parsed.sides) + 1);
  }

  const diceSum = rolls.reduce((a, b) => a + b, 0);
  const totalMod = parsed.modifier + extraModifier;

  return {
    expression: expr,
    rolls,
    modifier: totalMod,
    total: diceSum + totalMod,
  };
}

/**
 * Roll with advantage or disadvantage (roll twice, pick best/worst)
 */
export function rollWithAdvantage(
  expr: string,
  mode: 'advantage' | 'disadvantage',
  extraModifier = 0,
): AdvantageRollResult {
  const roll1 = rollDice(expr, extraModifier);
  const roll2 = rollDice(expr, extraModifier);
  const chosen = mode === 'advantage'
    ? (roll1.total >= roll2.total ? roll1 : roll2)
    : (roll1.total <= roll2.total ? roll1 : roll2);

  return { mode, roll1, roll2, chosen };
}

// ─── Advanced Dice Console Engine ───

export interface ConsoleRollResult {
  label: string;
  input: string;
  breakdown: string;
  total: number | string;
  isError?: boolean;
}

function rollOne(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function rollNDice(count: number, sides: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < count; i++) res.push(rollOne(sides));
  return res;
}

/**
 * Parse and evaluate a single dice group like "4d6kh3", "2d4r1", "2d4x4"
 */
function evalDiceGroup(expr: string): { rolls: number[]; kept: number[]; dropped: number[]; total: number; detail: string } {
  // Parse: NdS[modifier][suffix]
  const m = expr.match(/^(\d+)d(\d+)((?:[a-z]+[<>=]*\d+)*)$/i);
  if (!m) {
    // Maybe just a number
    const num = parseFloat(expr);
    if (!isNaN(num)) return { rolls: [], kept: [], dropped: [], total: num, detail: String(num) };
    throw new Error(`Не удалось разобрать: ${expr}`);
  }

  let count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const suffixStr = m[3] || '';

  // Parse all suffixes
  const suffixes: { op: string; cmp: string; val: number }[] = [];
  const suffixRegex = /([a-z]+)([<>=]*)(\d+)/gi;
  let sm: RegExpExecArray | null;
  while ((sm = suffixRegex.exec(suffixStr)) !== null) {
    suffixes.push({ op: sm[1].toLowerCase(), cmp: sm[2], val: parseInt(sm[3], 10) });
  }

  let rolls = rollNDice(count, sides);
  const allRolls = [...rolls];
  let dropped: number[] = [];

  // Process suffixes in order
  for (const { op, cmp, val } of suffixes) {
    switch (op) {
      case 'kh': { // keep highest N
        const sorted = [...rolls].sort((a, b) => b - a);
        const kept = sorted.slice(0, val);
        dropped = dropped.concat(sorted.slice(val));
        rolls = kept;
        break;
      }
      case 'kl': { // keep lowest N
        const sorted = [...rolls].sort((a, b) => a - b);
        const kept = sorted.slice(0, val);
        dropped = dropped.concat(sorted.slice(val));
        rolls = kept;
        break;
      }
      case 'dh': { // drop highest N
        const sorted = [...rolls].sort((a, b) => b - a);
        dropped = dropped.concat(sorted.slice(0, val));
        rolls = sorted.slice(val);
        break;
      }
      case 'dl': { // drop lowest N
        const sorted = [...rolls].sort((a, b) => a - b);
        dropped = dropped.concat(sorted.slice(0, val));
        rolls = sorted.slice(val);
        break;
      }
      case 'r': { // reroll matching
        const check = makeCompare(cmp, val);
        rolls = rolls.map(r => check(r) ? rollOne(sides) : r);
        break;
      }
      case 'x': { // explode matching
        const check = makeCompare(cmp, val);
        const extra: number[] = [];
        for (const r of rolls) {
          if (check(r)) extra.push(rollOne(sides));
        }
        rolls = [...rolls, ...extra];
        break;
      }
      case 'cs': { // count successes
        const check = makeCompare(cmp, val);
        const successes = rolls.filter(r => check(r)).length;
        const detail = `[${rolls.join(', ')}] → ${successes} усп.`;
        return { rolls: allRolls, kept: rolls, dropped, total: successes, detail };
      }
      case 'ms': { // margin of success
        const total = rolls.reduce((a, b) => a + b, 0);
        const margin = total - val;
        const detail = `[${rolls.join(', ')}] = ${total} vs ${val} → ${margin >= 0 ? '+' : ''}${margin}`;
        return { rolls: allRolls, kept: rolls, dropped, total: margin, detail };
      }
    }
  }

  const total = rolls.reduce((a, b) => a + b, 0);
  let detail: string;
  if (dropped.length > 0) {
    const keptStr = rolls.map(r => String(r)).join(' + ');
    const droppedStr = dropped.map(r => `~~${r}~~`).join(', ');
    detail = `[${keptStr}] (отброшено: ${droppedStr})`;
  } else {
    detail = `[${rolls.join(', ')}]`;
  }

  return { rolls: allRolls, kept: rolls, dropped, total, detail };
}

function makeCompare(cmp: string, val: number): (n: number) => boolean {
  switch (cmp) {
    case '<': return (n) => n < val;
    case '<=': return (n) => n <= val;
    case '>': return (n) => n > val;
    case '>=': return (n) => n >= val;
    case '=': return (n) => n === val;
    default: return (n) => n === val; // no comparator = equal
  }
}

// ─── Built-in functions ───

function evalFunction(name: string, innerExpr: string): { total: number; detail: string } {
  const fn = name.toLowerCase();
  switch (fn) {
    case 'floor': {
      const v = evalFullExpression(innerExpr);
      return { total: Math.floor(v.total), detail: `floor(${v.detail}) = ${Math.floor(v.total)}` };
    }
    case 'ceil': {
      const v = evalFullExpression(innerExpr);
      return { total: Math.ceil(v.total), detail: `ceil(${v.detail}) = ${Math.ceil(v.total)}` };
    }
    case 'round': {
      const v = evalFullExpression(innerExpr);
      return { total: Math.round(v.total), detail: `round(${v.detail}) = ${Math.round(v.total)}` };
    }
    case 'abs': {
      const v = evalFullExpression(innerExpr);
      return { total: Math.abs(v.total), detail: `abs(${v.detail}) = ${Math.abs(v.total)}` };
    }
    case 'sign': {
      const v = evalFullExpression(innerExpr);
      const s = Math.sign(v.total);
      return { total: s, detail: `sign(${v.detail}) = ${s}` };
    }
    case 'avg': {
      // Calculate average by parsing dice and computing expected value
      const m = innerExpr.match(/^(\d+)d(\d+)$/);
      if (m) {
        const count = parseInt(m[1], 10);
        const sides = parseInt(m[2], 10);
        const avg = count * (sides + 1) / 2;
        return { total: avg, detail: `avg(${innerExpr}) = ${avg}` };
      }
      const v = evalFullExpression(innerExpr);
      return { total: v.total, detail: `avg(${v.detail}) = ${v.total}` };
    }
    case 'dmax': {
      const m = innerExpr.match(/^(\d+)d(\d+)$/);
      if (m) {
        const count = parseInt(m[1], 10);
        const sides = parseInt(m[2], 10);
        const max = count * sides;
        return { total: max, detail: `dmax(${innerExpr}) = ${max}` };
      }
      const v = evalFullExpression(innerExpr);
      return { total: v.total, detail: `dmax(${v.detail}) = ${v.total}` };
    }
    case 'dmin': {
      const m = innerExpr.match(/^(\d+)d(\d+)$/);
      if (m) {
        const count = parseInt(m[1], 10);
        return { total: count, detail: `dmin(${innerExpr}) = ${count}` };
      }
      const v = evalFullExpression(innerExpr);
      return { total: v.total, detail: `dmin(${v.detail}) = ${v.total}` };
    }
    default:
      throw new Error(`Неизвестная функция: ${fn}`);
  }
}

// ─── Dice pool: {2d8, 1d6} ───

function evalDicePool(poolExpr: string, suffix: string): { total: number; detail: string } {
  const parts = poolExpr.split(',').map(p => p.trim());
  const results = parts.map(p => evalFullExpression(p));
  let totals = results.map(r => r.total);
  let detail = `{${results.map(r => `${r.detail}=${r.total}`).join(', ')}}`;

  // Apply pool suffix (e.g. kh1)
  if (suffix) {
    const sm = suffix.match(/^(kh|kl|dh|dl)(\d+)$/i);
    if (sm) {
      const op = sm[1].toLowerCase();
      const val = parseInt(sm[2], 10);
      const sorted = [...totals].sort((a, b) => b - a);
      switch (op) {
        case 'kh': totals = sorted.slice(0, val); break;
        case 'kl': totals = sorted.slice(-val); break;
        case 'dh': totals = sorted.slice(val); break;
        case 'dl': totals = sorted.slice(0, -val); break;
      }
      detail += suffix;
    }
  }

  return { total: totals.reduce((a, b) => a + b, 0), detail };
}

// ─── Full expression evaluator ───

function evalFullExpression(expr: string): { total: number; detail: string } {
  expr = expr.trim();

  // Dice pool: {expr, expr}suffix
  const poolMatch = expr.match(/^\{([^}]+)\}(\w+)?$/);
  if (poolMatch) {
    return evalDicePool(poolMatch[1], poolMatch[2] || '');
  }

  // Function: name(expr)
  const funcMatch = expr.match(/^(\w+)\((.+)\)$/);
  if (funcMatch && !expr.match(/^\d+d\d+/i)) {
    return evalFunction(funcMatch[1], funcMatch[2]);
  }

  // Tokenize: split by + and - while preserving operators, handling dice groups
  const tokens: { op: '+' | '-'; value: string }[] = [];
  let current = '';
  let sign: '+' | '-' = '+';
  let depth = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(' || ch === '{') { depth++; current += ch; continue; }
    if (ch === ')' || ch === '}') { depth--; current += ch; continue; }
    if (depth === 0 && (ch === '+' || ch === '-') && current.trim()) {
      tokens.push({ op: sign, value: current.trim() });
      current = '';
      sign = ch as '+' | '-';
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push({ op: sign, value: current.trim() });

  let totalResult = 0;
  const details: string[] = [];

  for (const token of tokens) {
    let val: number;
    let det: string;

    // Check if it's a function
    const fMatch = token.value.match(/^(\w+)\((.+)\)$/);
    if (fMatch && !token.value.match(/^\d+d\d+/i)) {
      const res = evalFunction(fMatch[1], fMatch[2]);
      val = res.total;
      det = res.detail;
    } else if (/^\d+d\d+/i.test(token.value)) {
      // Dice group
      const res = evalDiceGroup(token.value);
      val = res.total;
      det = res.detail;
    } else {
      // Plain number
      val = parseFloat(token.value);
      if (isNaN(val)) throw new Error(`Не удалось разобрать: ${token.value}`);
      det = String(val);
    }

    if (token.op === '-') {
      totalResult -= val;
      details.push(`- ${det}`);
    } else {
      totalResult += val;
      details.push(details.length === 0 ? det : `+ ${det}`);
    }
  }

  return { total: totalResult, detail: details.join(' ') };
}

// ─── Public console eval ───

export function evalConsoleExpression(input: string): ConsoleRollResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { label: '', input: trimmed, breakdown: '', total: '', isError: true };
  }

  // Extract label (anything before colon)
  let label = '';
  let expr = trimmed;
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0 && colonIdx < trimmed.length - 1) {
    label = trimmed.slice(0, colonIdx).trim();
    expr = trimmed.slice(colonIdx + 1).trim();
  }

  try {
    const result = evalFullExpression(expr);
    return {
      label,
      input: expr,
      breakdown: result.detail,
      total: result.total,
    };
  } catch (e: any) {
    return {
      label,
      input: expr,
      breakdown: e.message || 'Ошибка',
      total: 'Ошибка',
      isError: true,
    };
  }
}
