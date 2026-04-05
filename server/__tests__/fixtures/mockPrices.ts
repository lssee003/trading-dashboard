/**
 * Generates a linear price series from start to end over N days.
 * Useful for creating predictable MA crossovers.
 */
export function linearPrices(start: number, end: number, days: number): number[] {
  const step = (end - start) / (days - 1);
  return Array.from({ length: days }, (_, i) => +(start + step * i).toFixed(4));
}

/**
 * UPTREND: 300 bars, climbing from 100 to 200.
 * Current price (200) is above all MAs.
 * Last day change: positive (advancing).
 * 52-week high: 200 (current = high, within 5%).
 */
export const UPTREND_300 = linearPrices(100, 200, 300);

/**
 * DOWNTREND: 300 bars, falling from 200 to 100.
 * Current price (100) is below all MAs.
 * Last day change: negative (declining).
 * 52-week low: 100 (current = low, within 5%).
 */
export const DOWNTREND_300 = linearPrices(200, 100, 300);

/**
 * FLAT / CONSOLIDATION: 300 bars at exactly 150.
 * Price = all MAs = 150 (not strictly "above").
 * Unchanged (0% daily move, below 0.05% threshold).
 */
export const FLAT_300 = Array.from({ length: 300 }, () => 150);

/**
 * SHORT HISTORY: only 15 bars.
 * Below the 20-bar minimum — excluded from breadth calculation.
 */
export const SHORT_15 = linearPrices(100, 110, 15);

/**
 * EXACTLY 20 bars: minimum threshold for inclusion.
 * SMA(20) computable, SMA(50) and SMA(200) are null.
 */
export const MINIMAL_20 = linearPrices(100, 120, 20);

/**
 * BURST scenario: 290 bars flat at 100, then 10 days with known ±5% moves.
 * Moves: +5%, -5%, +5%, -5%, +5%, +5%, +5%, -5%, +5%, -5%
 * → 6 breakouts (>=4%), 4 breakdowns (<=−4%)
 * → burstRatio = 6/4 = 1.5
 */
export function makeBurstPrices(): number[] {
  const prices = Array.from({ length: 290 }, () => 100);
  let p = 100;
  const moves = [0.05, -0.05, 0.05, -0.05, 0.05, 0.05, 0.05, -0.05, 0.05, -0.05];
  for (const m of moves) {
    p = +(p * (1 + m)).toFixed(4);
    prices.push(p);
  }
  return prices;
}

/**
 * QUARTERLY SURGE: stock up 30% over last 65 trading days.
 * First 235 bars at 100, then linear climb to 130 over 65 bars.
 */
export function makeQuarterlySurge(): number[] {
  const flat = Array.from({ length: 235 }, () => 100);
  const climb = linearPrices(100, 130, 65);
  return [...flat, ...climb];
}

/**
 * QUARTERLY CRASH: stock down 30% over last 65 trading days.
 * First 235 bars at 100, then linear fall to 70 over 65 bars.
 */
export function makeQuarterlyCrash(): number[] {
  const flat = Array.from({ length: 235 }, () => 100);
  const fall = linearPrices(100, 70, 65);
  return [...flat, ...fall];
}

/**
 * 20% STUDY SURGE: stock up 25% over last 5 trading days.
 * 294 bars flat at 100, then 5 bars climbing to 125 (25% gain).
 */
export function make5daySurge(): number[] {
  const flat = Array.from({ length: 295 }, () => 100);
  return [...flat, ...linearPrices(100, 125, 5)];
}

/**
 * 20% STUDY CRASH: stock down 25% over last 5 trading days.
 * 294 bars flat at 100, then 5 bars falling to 75 (25% loss).
 */
export function make5dayCrash(): number[] {
  const flat = Array.from({ length: 295 }, () => 100);
  return [...flat, ...linearPrices(100, 75, 5)];
}

/**
 * MONTHLY SURGE: stock up 30% over last 22 trading days.
 * 278 bars flat at 100, then linear climb to 130 over 22 bars.
 */
export function makeMonthlySurge(): number[] {
  const flat = Array.from({ length: 278 }, () => 100);
  return [...flat, ...linearPrices(100, 130, 22)];
}

/**
 * MONTHLY CRASH: stock down 30% over last 22 trading days.
 * 278 bars flat at 100, then linear fall to 70 over 22 bars.
 */
export function makeMonthlyCrash(): number[] {
  const flat = Array.from({ length: 278 }, () => 100);
  return [...flat, ...linearPrices(100, 70, 22)];
}
