// Coin economy helpers. 5etools item `value` is stored in copper pieces (cp).
// Conversion: 1 pp = 1000 cp, 1 gp = 100 cp, 1 ep = 50 cp, 1 sp = 10 cp.

export interface Currency {
  copper: number;
  silver: number;
  electrum: number;
  gold: number;
  platinum: number;
}

const COIN_TO_CP = { copper: 1, silver: 10, electrum: 50, gold: 100, platinum: 1000 } as const;

/** Total wealth expressed in copper pieces. */
export function currencyToCopper(c: Currency): number {
  return (
    (c.copper ?? 0) * COIN_TO_CP.copper +
    (c.silver ?? 0) * COIN_TO_CP.silver +
    (c.electrum ?? 0) * COIN_TO_CP.electrum +
    (c.gold ?? 0) * COIN_TO_CP.gold +
    (c.platinum ?? 0) * COIN_TO_CP.platinum
  );
}

/**
 * Convert a copper amount back into a coin breakdown, preferring larger
 * denominations. Electrum is not produced (it folds into gold/silver), so any
 * transaction normalises electrum away — an accepted simplification.
 */
export function copperToCurrency(totalCp: number): Currency {
  let cp = Math.max(0, Math.round(totalCp));
  const platinum = Math.floor(cp / COIN_TO_CP.platinum); cp %= COIN_TO_CP.platinum;
  const gold = Math.floor(cp / COIN_TO_CP.gold); cp %= COIN_TO_CP.gold;
  const silver = Math.floor(cp / COIN_TO_CP.silver); cp %= COIN_TO_CP.silver;
  return { platinum, gold, electrum: 0, silver, copper: cp };
}

/** Add a copper delta (positive = gain, negative = spend) and re-normalise coins. */
export function adjustCurrency(c: Currency, deltaCp: number): Currency {
  return copperToCurrency(currencyToCopper(c) + deltaCp);
}
