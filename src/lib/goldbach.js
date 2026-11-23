// Goldbach levels (Hopiplaka's PO3 framework) for gold and silver.
// A PO3 dealing range is a block of price whose size is a power of 3, anchored so its low is an
// exact multiple of that size: low = floor(price / size) * size. Inside it, levels sit at fixed
// Goldbach percentages (prime-number partitions of 100).
export const PO3 = [3, 9, 27, 81, 243, 729, 2187, 6561];

export const LEVELS = [
  { p: 100, key: 'high', name: 'Range high', short: 'High', zone: 'edge', note: 'Top of the dealing range. Liquidity above old highs; a break opens the next range up.' },
  { p: 97, key: 'rb', name: 'Rejection block', short: 'RB 97', zone: 'premium', note: 'Last line before the high. Strong reversal zone: look for shorts on rejection.' },
  { p: 89, key: 'ob', name: 'Order block', short: 'OB 89', zone: 'premium', note: 'Highest-probability reaction in premium. Sell zone when the trend is down.' },
  { p: 83, key: 'fvg', name: 'Fair value gap', short: 'FVG 83', zone: 'premium', note: 'Imbalance that tends to get filled; a price magnet.' },
  { p: 71, key: 'lv', name: 'Liquidity void', short: 'LV 71', zone: 'premium', note: 'Price moves fast through 71→83. Use it to confirm momentum, not to fade it.' },
  { p: 59, key: 'br', name: 'Breaker', short: 'BR 59', zone: 'premium', note: 'Structure flip zone. Continuation more likely than reversal.' },
  { p: 53, key: 'mb', name: 'Mitigation block', short: 'MB 53', zone: 'premium', note: 'Tight band above equilibrium. Trend continuation, don\'t look for reversals.' },
  { p: 50, key: 'eq', name: 'Equilibrium', short: 'EQ 50', zone: 'eq', note: 'Middle of the range. Above = premium (sell area), below = discount (buy area).' },
  { p: 47, key: 'mb', name: 'Mitigation block', short: 'MB 47', zone: 'discount', note: 'Tight band below equilibrium. Trend continuation.' },
  { p: 41, key: 'br', name: 'Breaker', short: 'BR 41', zone: 'discount', note: 'Structure flip zone. Continuation more likely than reversal.' },
  { p: 29, key: 'lv', name: 'Liquidity void', short: 'LV 29', zone: 'discount', note: 'Price moves fast through 17→29. Confirms momentum.' },
  { p: 17, key: 'fvg', name: 'Fair value gap', short: 'FVG 17', zone: 'discount', note: 'Imbalance that tends to get filled; a price magnet.' },
  { p: 11, key: 'ob', name: 'Order block', short: 'OB 11', zone: 'discount', note: 'Highest-probability reaction in discount. Buy zone when the trend is up.' },
  { p: 3, key: 'rb', name: 'Rejection block', short: 'RB 3', zone: 'discount', note: 'Last line before the low. Strong reversal zone: look for longs on rejection.' },
  { p: 0, key: 'low', name: 'Range low', short: 'Low', zone: 'edge', note: 'Bottom of the dealing range. Liquidity below old lows; a break opens the next range down.' },
];

// How each instrument is counted: gold in dollars, silver in cents (so PO3 sizes fit their daily ranges)
export const INSTRUMENTS = {
  XAUUSD: { name: 'Gold', unit: 1, unitLabel: '$1', digits: 2 },
  XAGUSD: { name: 'Silver', unit: 100, unitLabel: '1¢', digits: 3 },
};

/** Smallest PO3 that covers the average daily range (in units) */
export function autoPo3(adrUnits) {
  if (!Number.isFinite(adrUnits) || adrUnits <= 0) return 81;
  return PO3.find((s) => s >= adrUnits) || PO3.at(-1);
}

/** Dealing range for a price (in price terms) */
export function dealingRange(price, size, unit = 1) {
  const u = price * unit;
  const low = Math.floor(u / size) * size;
  return { low: low / unit, high: (low + size) / unit, size, sizePrice: size / unit };
}

/** All Goldbach levels of a range, plus where price sits */
export function goldbach(price, size, unit = 1) {
  const r = dealingRange(price, size, unit);
  const levels = LEVELS.map((l) => ({ ...l, price: r.low + (r.sizePrice * l.p) / 100 }));
  const pct = ((price - r.low) / r.sizePrice) * 100;
  const above = levels.filter((l) => l.price > price).at(-1) || null;
  const below = levels.find((l) => l.price <= price) || null;
  return { ...r, levels, pct, zone: pct > 50 ? 'premium' : pct < 50 ? 'discount' : 'eq', above, below };
}
