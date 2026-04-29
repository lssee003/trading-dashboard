import YahooFinanceModule from "yahoo-finance2";
import type { DashboardData, MarketQuote, CategoryScore, BreadthMetrics, TerminalAnalysis, RSTickerData, SheetsCell } from "../shared/schema";
import { fetchBreadthMetrics } from "./breadthData";
import { fetchRelativeStrength } from "./rsData";
import { fetchGoogleSheetData } from "./sheetsData.ts";

// ── Sheets breadth cache (4h TTL, same as breadthData) ──
let sheetsBreadthCache: SheetsBreadthData | null = null;
let sheetsBreadthCacheTime = 0;
const SHEETS_BREADTH_TTL = 4 * 60 * 60 * 1000;

// Column indices matching the Google Sheet structure
const SCOL = {
  DATE: 0, UP_4: 1, DOWN_4: 2, RATIO_5D: 3, RATIO_10D: 4,
  UP_25Q: 5, DOWN_25Q: 6, UP_25M: 7, DOWN_25M: 8,
  UP_50M: 9, DOWN_50M: 10, UP_13: 11, DOWN_13: 12,
  WORDEN: 13, T2108: 14, SP: 15,
};

export interface SheetsBreadthData {
  up25q: number; down25q: number;
  up25m: number; down25m: number;
  ratio5d: number; ratio10d: number;
  breakouts5d: number; breakdowns5d: number;
  breakouts10d: number; breakdowns10d: number;
  t2108: number; up50m: number; down50m: number;
}

function sheetNum(row: SheetsCell[], ci: number): number | null {
  const v = row[ci]?.value;
  return typeof v === 'number' ? v : null;
}

async function fetchSheetsBreadthData(): Promise<SheetsBreadthData | null> {
  const now = Date.now();
  if (sheetsBreadthCache && (now - sheetsBreadthCacheTime) < SHEETS_BREADTH_TTL) {
    return sheetsBreadthCache;
  }
  try {
    const data = await fetchGoogleSheetData();
    // Valid data rows have a numeric value in the UP_4 column
    const valid = data.rows.filter(
      row => row.length > SCOL.SP && typeof row[SCOL.UP_4]?.value === 'number',
    );
    if (valid.length === 0) return null;

    // Sheet is ordered newest-first: valid[0] = most recent trading day
    const latest = valid[0];

    const result: SheetsBreadthData = {
      up25q:      sheetNum(latest, SCOL.UP_25Q)  ?? 0,
      down25q:    sheetNum(latest, SCOL.DOWN_25Q) ?? 0,
      up25m:      sheetNum(latest, SCOL.UP_25M)  ?? 0,
      down25m:    sheetNum(latest, SCOL.DOWN_25M) ?? 0,
      ratio5d:    sheetNum(latest, SCOL.RATIO_5D)  ?? 1,
      ratio10d:   sheetNum(latest, SCOL.RATIO_10D) ?? 1,
      // Today's counts — ratio is the sheet's precomputed rolling metric
      breakouts5d:  sheetNum(latest, SCOL.UP_4) ?? 0,
      breakdowns5d: sheetNum(latest, SCOL.DOWN_4) ?? 0,
      breakouts10d: sheetNum(latest, SCOL.UP_4) ?? 0,
      breakdowns10d: sheetNum(latest, SCOL.DOWN_4) ?? 0,
      t2108:  sheetNum(latest, SCOL.T2108)  ?? 50,
      up50m:  sheetNum(latest, SCOL.UP_50M) ?? 0,
      down50m: sheetNum(latest, SCOL.DOWN_50M) ?? 0,
    };
    sheetsBreadthCache = result;
    sheetsBreadthCacheTime = now;
    return result;
  } catch (e) {
    console.warn('Sheets breadth fetch failed:', (e as Error).message?.slice(0, 120));
    return sheetsBreadthCache; // return stale cache if available
  }
}

const YahooFinance = (YahooFinanceModule as any).default || YahooFinanceModule;
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Server-side cache
let cachedData: DashboardData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds

const SECTOR_ETFS: Record<string, string> = {
  XLK: "Technology",
  XLF: "Financials",
  XLE: "Energy",
  XLV: "Health Care",
  XLI: "Industrials",
  XLY: "Consumer Disc.",
  XLP: "Consumer Staples",
  XLU: "Utilities",
  XLB: "Materials",
  XLRE: "Real Estate",
  XLC: "Communication",
};

// Equal-weight sector ETFs for 25d RS momentum scoring
const RS_SECTOR_SYMBOLS = ["RSPG","RSPT","RSPH","RSPF","RSPD","RSPS","RSPC","RSPR","RSPU","RSPM","RSPN"];

const RS_SECTOR_NAMES: Record<string, string> = {
  RSPG: "Energy", RSPT: "Technology", RSPH: "Health Care", RSPF: "Financials",
  RSPD: "Consumer Disc", RSPS: "Consumer Staples", RSPC: "Communication",
  RSPR: "Real Estate", RSPU: "Utilities", RSPM: "Materials", RSPN: "Industrials",
};

// Short names for panel display (prevent overflow)
const RS_SECTOR_SHORT: Record<string, string> = {
  RSPG: "Engy", RSPT: "Tech", RSPH: "HC", RSPF: "Fin", RSPD: "Disc",
  RSPS: "Stpl", RSPC: "Comm", RSPR: "RE", RSPU: "Util", RSPM: "Matl", RSPN: "Indus",
};

// Defensive vs Cyclical classification for rotation analysis
const DEFENSIVE_SECTORS = new Set(["RSPU", "RSPS", "RSPH"]); // Utilities, Staples, Health Care
const CYCLICAL_SECTORS = new Set(["RSPT", "RSPD", "RSPN", "RSPF"]); // Tech, Cons Disc, Industrials, Financials

const TICKER_SYMBOLS = ["SPY", "QQQ", "^VIX", "^VIX3M", "^VIX9D", "^VVIX", "DX-Y.NYB", "^TNX"];
const ALL_SYMBOLS = [...TICKER_SYMBOLS, ...Object.keys(SECTOR_ETFS)];

interface HistoricalData {
  close: number[];
  dates: Date[];
}

async function getQuotes(symbols: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  const batchSize = 5;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(async (symbol) => {
      try {
        const quote = await yahooFinance.quote(symbol);
        results[symbol] = quote;
      } catch (e) {
        console.warn(`Failed to fetch quote for ${symbol}:`, (e as Error).message);
      }
    });
    await Promise.all(promises);
  }
  return results;
}

async function getHistorical(symbol: string, days: number): Promise<HistoricalData> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.ceil(days * 1.5) - 10); // buffer for weekends/holidays
    
    const result = await yahooFinance.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });
    
    const closes: number[] = [];
    const dates: Date[] = [];
    
    if (result && result.quotes) {
      for (const q of result.quotes) {
        if (q.close != null) {
          closes.push(q.close);
          dates.push(new Date(q.date));
        }
      }
    }
    
    return { close: closes.slice(-days), dates: dates.slice(-days) };
  } catch (e) {
    console.warn(`Failed to fetch historical for ${symbol}:`, (e as Error).message);
    return { close: [], dates: [] };
  }
}

function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(data: number[], period: number = 14): number | null {
  if (data.length < period + 1) return null;
  const changes = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i] - data[i - 1]);
  }
  const recent = changes.slice(-period);
  let gains = 0, losses = 0;
  for (const c of recent) {
    if (c > 0) gains += c;
    else losses += Math.abs(c);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSlope(data: number[], period: number = 5): number {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  const n = slice.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += slice[i];
    sumXY += i * slice[i];
    sumXX += i * i;
  }
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function percentile(value: number, data: number[]): number {
  const sorted = [...data].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= value);
  if (idx === -1) return 100;
  return Math.round((idx / sorted.length) * 100);
}

export function scoreVolatility(
  vixLevel: number,
  vixSlope: number,
  vix1YearData: number[],
  termStructureRatio: number,
  termStructureSlope: number,
  acutePanicRatio: number,
  vvixLevel: number,
  vvixPctile: number,
): { score: number; details: CategoryScore["details"] } {
  const details: CategoryScore["details"] = [];
  let score = 50;

  // ── 1. VIX Level (-25 to +20) ──
  if (vixLevel < 15) { score += 20; }
  else if (vixLevel < 20) { score += 12; }
  else if (vixLevel < 25) { score += 3; }
  else if (vixLevel < 30) { score -= 10; }
  else { score -= 25; }

  const vixPctile = vix1YearData.length > 0 ? percentile(vixLevel, vix1YearData) : 50;

  // ── 2. VIX Trend / 5-day slope (-8 to +8) ──
  if (vixSlope < -0.5) score += 8;
  else if (vixSlope < 0) score += 4;
  else if (vixSlope > 0.5) score -= 8;
  else if (vixSlope > 0) score -= 2;

  // ── 3. Term Structure: VIX/VIX3M ratio (-12 to +12) ──
  if (termStructureRatio < 0.85) { score += 8; }
  else if (termStructureRatio < 0.95) { score += 12; }
  else if (termStructureRatio < 1.0) { score += 2; }
  else if (termStructureRatio < 1.05) { score -= 6; }
  else { score -= 12; }

  // ── 4. VVIX level (-8 to +8) ──
  if (vvixLevel < 80) { score += 8; }
  else if (vvixLevel < 100) { score += 2; }
  else if (vvixLevel < 120) { score -= 5; }
  else { score -= 8; }

  // ── 5. VIX9D Acute Panic (-5 to +5) ──
  if (acutePanicRatio > 1.1) { score -= 5; }
  else if (acutePanicRatio > 1.0) { score -= 2; }
  else if (acutePanicRatio < 0.9) { score += 5; }
  else { score += 2; }

  // ── Detail rows ──

  const vixQuality = vixLevel < 15 ? "Low" : vixLevel < 20 ? "Normal" : vixLevel < 25 ? "Elevated" : vixLevel < 30 ? "High" : "Extreme";
  details.push({
    label: "VIX Level",
    value: `${vixLevel.toFixed(2)}  ${vixQuality}`,
    signal: vixLevel < 20 ? "bullish" : vixLevel < 30 ? "neutral" : "bearish",
    direction: vixSlope < -0.1 ? "down" : vixSlope > 0.1 ? "up" : "flat",
  });

  details.push({
    label: "VIX 1Y Percentile",
    value: `${vixPctile}th`,
    signal: vixPctile < 40 ? "bullish" : vixPctile < 70 ? "neutral" : "bearish",
    direction: "flat",
  });

  const tsLabel = termStructureRatio > 1.05 ? "Backwardation"
    : termStructureRatio > 1.0 ? "Flat/Inverting"
    : termStructureRatio > 0.95 ? "Mild Contango"
    : termStructureRatio > 0.85 ? "Contango"
    : "Steep Contango";
  details.push({
    label: "Term Structure",
    value: `${termStructureRatio.toFixed(2)}  ${tsLabel}`,
    signal: termStructureRatio > 1.0 ? "bearish" : termStructureRatio > 0.95 ? "neutral" : "bullish",
    direction: termStructureSlope > 0.005 ? "up" : termStructureSlope < -0.005 ? "down" : "flat",
  });

  const vvixQuality = vvixLevel < 80 ? "Calm" : vvixLevel < 100 ? "Normal" : vvixLevel < 120 ? "Elevated" : "Extreme";
  details.push({
    label: "VVIX",
    value: `${vvixLevel.toFixed(1)}  ${vvixQuality}`,
    signal: vvixLevel < 90 ? "bullish" : vvixLevel < 110 ? "neutral" : "bearish",
    direction: "flat",
  });

  const vixTrendQuality = Math.abs(vixSlope) > 1 ? "Spiking" : Math.abs(vixSlope) > 0.3 ? "Moving" : "Calm";
  details.push({
    label: "VIX Trend",
    value: `${vixSlope > 0 ? "Rising" : vixSlope < 0 ? "Falling" : "Flat"}  ${vixTrendQuality}`,
    signal: vixSlope < 0 ? "bullish" : vixSlope > 0 ? "bearish" : "neutral",
    direction: vixSlope < -0.1 ? "down" : vixSlope > 0.1 ? "up" : "flat",
  });

  return { score: Math.max(0, Math.min(100, score)), details };
}

function scoreTrend(
  spyPrice: number, spySMA20: number | null, spySMA50: number | null, spySMA200: number | null,
  qqqPrice: number, qqqSMA50: number | null,
): { score: number; details: CategoryScore["details"]; regime: string } {
  const details: CategoryScore["details"] = [];
  let score = 50;
  let bullishCount = 0;
  let bearishCount = 0;

  // SPY vs moving averages (increased weight per MA since RSI removed)
  if (spySMA20 && spyPrice > spySMA20) { score += 12; bullishCount++; }
  else if (spySMA20) { score -= 12; bearishCount++; }

  if (spySMA50 && spyPrice > spySMA50) { score += 12; bullishCount++; }
  else if (spySMA50) { score -= 12; bearishCount++; }

  if (spySMA200 && spyPrice > spySMA200) { score += 12; bullishCount++; }
  else if (spySMA200) { score -= 18; bearishCount++; }

  // QQQ vs 50d MA
  if (qqqSMA50 && qqqPrice > qqqSMA50) { score += 10; bullishCount++; }
  else if (qqqSMA50) { score -= 10; bearishCount++; }

  // Regime classification
  let regime = "CHOP";
  if (bullishCount >= 3) regime = "UPTREND";
  else if (bearishCount >= 3) regime = "DOWNTREND";

  details.push({
    label: "SPY vs 20d MA",
    value: spySMA20 ? `${((spyPrice / spySMA20 - 1) * 100).toFixed(2)}%` : "N/A",
    signal: spySMA20 && spyPrice > spySMA20 ? "bullish" : "bearish",
    direction: spySMA20 && spyPrice > spySMA20 ? "up" : "down",
  });

  details.push({
    label: "SPY vs 50d MA",
    value: spySMA50 ? `${((spyPrice / spySMA50 - 1) * 100).toFixed(2)}%` : "N/A",
    signal: spySMA50 && spyPrice > spySMA50 ? "bullish" : "bearish",
    direction: spySMA50 && spyPrice > spySMA50 ? "up" : "down",
  });

  details.push({
    label: "SPY vs 200d MA",
    value: spySMA200 ? `${((spyPrice / spySMA200 - 1) * 100).toFixed(2)}%` : "N/A",
    signal: spySMA200 && spyPrice > spySMA200 ? "bullish" : "bearish",
    direction: spySMA200 && spyPrice > spySMA200 ? "up" : "down",
  });

  details.push({
    label: "QQQ vs 50d MA",
    value: qqqSMA50 ? `${((qqqPrice / qqqSMA50 - 1) * 100).toFixed(2)}%` : "N/A",
    signal: qqqSMA50 && qqqPrice > qqqSMA50 ? "bullish" : "bearish",
    direction: qqqSMA50 && qqqPrice > qqqSMA50 ? "up" : "down",
  });

  details.push({
    label: "Regime",
    value: `${regime}  ${regime === "UPTREND" ? "Intact" : regime === "DOWNTREND" ? "Correcting" : "Choppy"}`,
    signal: regime === "UPTREND" ? "bullish" : regime === "DOWNTREND" ? "bearish" : "neutral",
    direction: regime === "UPTREND" ? "up" : regime === "DOWNTREND" ? "down" : "flat",
  });

  return { score: Math.max(0, Math.min(100, score)), details, regime };
}

export function scoreBreadth(breadth: BreadthMetrics | null, sectorPerformances: number[], sheets?: SheetsBreadthData | null): { score: number; details: CategoryScore["details"] } {
  const details: CategoryScore["details"] = [];
  let score = 50;

  if (breadth && breadth.totalStocks > 50) {
    // ─── Real breadth data from S&P 500 constituent analysis ───
    const pct50 = breadth.pctAbove50d;
    const pct200 = breadth.pctAbove200d;
    const pct20 = breadth.pctAbove20d;
    const adRatio = breadth.advDecRatio;

    // Score from % above 50d MA (primary breadth gauge)
    if (pct50 > 70) score += 25;
    else if (pct50 > 50) score += 10;
    else if (pct50 > 30) score -= 5;
    else score -= 20;

    // Score from % above 200d MA (structural health)
    if (pct200 > 60) score += 10;
    else if (pct200 > 40) score += 0;
    else score -= 10;

    // Score from A/D ratio
    if (adRatio > 2) score += 5;
    else if (adRatio < 0.5) score -= 10;

    // New lows dominance is very bearish
    if (breadth.newLows > breadth.newHighs * 3) score -= 10;
    else if (breadth.newHighs > breadth.newLows * 3) score += 5;

    // 4% burst ratio — thresholds match conditional formatting: >2 brightGreen, <0.5 red
    const burst = sheets?.ratio10d ?? breadth.burstRatio10d;
    if (burst > 2.0) score += 15;
    else if (burst < 0.5) score -= 15;

    // 10% Study (scored — extreme momentum oscillator, still S&P500-derived)
    const m20state = breadth.momentum20dState;
    if (m20state === "FROTHY") score -= 10;
    else if (m20state === "CAPITULATION") score += 15;

    // Quarterly breadth — CF threshold: up25q > down25q → green (+10), up25q < down25q → red (-15)
    if (sheets) {
      if (sheets.up25q > sheets.down25q) score += 10;
      else if (sheets.up25q < sheets.down25q) score -= 15;
    } else {
      const qNet = breadth.quarterlyBreadthNet;
      if (qNet > 0) score += 10;
      else if (qNet < 0) score -= 15;
    }

    const pct50Signal = pct50 > 60 ? "bullish" : pct50 > 40 ? "neutral" : "bearish";
    const pctQuality = (pct: number) => pct > 70 ? "Strong" : pct > 50 ? "Healthy" : pct > 30 ? "Weak" : "Very weak";
    const adQuality = adRatio > 2 ? "Bullish" : adRatio > 1 ? "Positive" : adRatio > 0.5 ? "Negative" : "Bearish";
    const hlQuality = breadth.newHighs > breadth.newLows * 2 ? "Highs lead" :
      breadth.newLows > breadth.newHighs * 2 ? "Lows dom." : "Mixed";

    details.push({
      label: "% > 50d MA",
      value: `${pct50}%  ${pctQuality(pct50)}`,
      signal: pct50Signal,
      direction: pct50 > 50 ? "up" : "down",
      oversoldAlert: breadth.isOversold, // flashing amber dot when < 25%
    });

    details.push({
      label: "% > 200d MA",
      value: `${pct200}%  ${pctQuality(pct200)}`,
      signal: pct200 > 60 ? "bullish" : pct200 > 40 ? "neutral" : "bearish",
      direction: pct200 > 50 ? "up" : "down",
    });

    details.push({
      label: "% > 20d MA",
      value: `${pct20}%  ${pctQuality(pct20)}`,
      signal: pct20 > 60 ? "bullish" : pct20 > 40 ? "neutral" : "bearish",
      direction: pct20 > 50 ? "up" : "down",
    });

    details.push({
      label: "NYSE A/D",
      value: `${adRatio.toFixed(1)}:1  ${adQuality}`,
      signal: adRatio > 1.5 ? "bullish" : adRatio > 0.8 ? "neutral" : "bearish",
      direction: adRatio > 1 ? "up" : "down",
    });

    details.push({
      label: "NAS Highs/Lows",
      value: `${breadth.newHighs}/${breadth.newLows}  ${hlQuality}`,
      signal: breadth.newHighs > breadth.newLows ? "bullish" : breadth.newLows > breadth.newHighs * 2 ? "bearish" : "neutral",
      direction: breadth.newHighs > breadth.newLows ? "up" : "down",
    });

    // 4% Burst Ratio — value uses sheets data if available
    const burstLabel = burst >= 2.0 ? "Breakouts dominating" :
      burst >= 1.0 ? "Balanced" :
      burst < 0.5 ? "Breakdowns dominating" : "Slight selling";
    details.push({
      label: "4% Burst (10d)",
      value: `${burst.toFixed(2)}x  ${burstLabel}`,
      signal: burst >= 1.5 ? "bullish" : burst >= 0.8 ? "neutral" : "bearish",
      direction: burst >= 1.0 ? "up" : "down",
      burstToggle: true,
    });

    // 10% Study (still S&P500-derived — no equivalent in sheets)
    const pctUp20 = breadth.totalStocks > 0 ? Math.round((breadth.momentum20dUp / breadth.totalStocks) * 1000) / 10 : 0;
    const pctDown20 = breadth.totalStocks > 0 ? Math.round((breadth.momentum20dDown / breadth.totalStocks) * 1000) / 10 : 0;
    const m20Label = m20state === "FROTHY" ? "Frothy" : m20state === "CAPITULATION" ? "Capitulation" : m20state === "LOW_ACTIVITY" ? "Low Activity" : "Normal";
    const m20Signal: "bullish" | "bearish" | "neutral" =
      m20state === "CAPITULATION" ? "bullish" : m20state === "FROTHY" ? "bearish" : "neutral";
    details.push({
      label: "10% Study",
      value: `${pctUp20}%↑/${pctDown20}%↓  ${m20Label}`,
      signal: m20Signal,
      direction: m20state === "CAPITULATION" ? "down" : m20state === "FROTHY" ? "up" : "flat",
      momentum20dToggle: true,
    });

    // Quarterly/Monthly Breadth — use sheets data if available
    const qNet = sheets ? (sheets.up25q - sheets.down25q) : breadth.quarterlyBreadthNet;
    const qLabel = qNet > 50 ? "Healthy" : qNet > 0 ? "Positive" : qNet > -50 ? "Caution" : "High-risk phase";
    details.push({
      label: "Qtrly Breadth",
      value: `${qNet > 0 ? "+" : ""}${qNet}  ${qLabel}`,
      signal: qNet > 0 ? "bullish" : qNet > -30 ? "neutral" : "bearish",
      direction: qNet > 0 ? "up" : "down",
      breadthToggleFlag: true,
    });
  } else {
    // ─── Fallback: estimate from sector ETFs ───
    const advancing = sectorPerformances.filter(p => p > 0).length;
    const declining = sectorPerformances.filter(p => p < 0).length;
    const advDecRatio = declining > 0 ? advancing / declining : advancing > 0 ? 10 : 1;
    const pctAbove = (advancing / sectorPerformances.length) * 100;
    if (pctAbove > 70) score += 25;
    else if (pctAbove > 50) score += 10;
    else if (pctAbove > 30) score -= 10;
    else score -= 25;

    details.push({
      label: "Sectors Advancing",
      value: `${advancing}/${sectorPerformances.length}`,
      signal: advancing > 7 ? "bullish" : advancing > 4 ? "neutral" : "bearish",
      direction: advancing > 6 ? "up" : advancing < 5 ? "down" : "flat",
    });
    details.push({
      label: "A/D Ratio",
      value: advDecRatio.toFixed(2),
      signal: advDecRatio > 1.5 ? "bullish" : advDecRatio > 0.8 ? "neutral" : "bearish",
      direction: advDecRatio > 1 ? "up" : "down",
    });
  }

  return { score: Math.max(0, Math.min(100, score)), details };
}

function scoreMomentum(
  sectorPerfs: { symbol: string; perf: number }[],
  rsSectors: RSTickerData[] | null,
): { score: number; details: CategoryScore["details"]; rotationType: string } {
  const details: CategoryScore["details"] = [];
  let score = 50;
  let rotationType = "Mixed";

  // ─── 25d RS-based scoring (preferred) ───
  if (rsSectors && rsSectors.length >= 8) {
    const sorted = [...rsSectors].sort((a, b) => b.rsVsBenchmark - a.rsVsBenchmark);
    const outperforming = sorted.filter(s => s.rsVsBenchmark > 1.0);
    const outCount = outperforming.length;
    const top2 = sorted.slice(0, 2);
    const bottom2 = sorted.slice(-2);

    // ── 1. RS participation: how many sectors beat SPY over 25d (-20 to +25)
    if (outCount >= 7) score += 25;
    else if (outCount >= 5) score += 12;
    else if (outCount >= 3) score += 0;
    else if (outCount >= 1) score -= 12;
    else score -= 20;

    // ── 2. Top RS strength (-5 to +10)
    const topAvgRS = top2.reduce((a, b) => a + b.rsVsBenchmark, 0) / 2;
    if (topAvgRS > 1.08) score += 10;
    else if (topAvgRS > 1.03) score += 5;
    else score -= 5;

    // ── 3. Bottom RS weakness (-10 to +5)
    const bottomAvgRS = bottom2.reduce((a, b) => a + b.rsVsBenchmark, 0) / 2;
    if (bottomAvgRS > 0.97) score += 5; // even laggards close to SPY
    else if (bottomAvgRS > 0.92) score += 0;
    else score -= 10;

    // ── 4. Defensive vs Cyclical rotation (-10 to +10)
    const defAvgRank = sorted.reduce((sum, s, i) => DEFENSIVE_SECTORS.has(s.symbol) ? sum + i : sum, 0)
      / (DEFENSIVE_SECTORS.size || 1);
    const cycAvgRank = sorted.reduce((sum, s, i) => CYCLICAL_SECTORS.has(s.symbol) ? sum + i : sum, 0)
      / (CYCLICAL_SECTORS.size || 1);

    if (cycAvgRank < defAvgRank - 1.5) {
      // Cyclicals rank higher (lower index = stronger) → risk-on
      rotationType = "Risk-On";
      score += 10;
    } else if (defAvgRank < cycAvgRank - 1.5) {
      // Defensives rank higher → risk-off
      rotationType = "Risk-Off";
      score -= 10;
    } else {
      rotationType = "Mixed";
    }

    // ── Detail rows (short names to prevent panel overflow) ──
    details.push({
      label: "25d Leaders",
      value: top2.map(s => RS_SECTOR_SHORT[s.symbol] || s.symbol).join(", "),
      signal: topAvgRS > 1.03 ? "bullish" : "neutral",
      direction: "up",
    });

    details.push({
      label: "25d Laggards",
      value: bottom2.map(s => RS_SECTOR_SHORT[s.symbol] || s.symbol).join(", "),
      signal: bottomAvgRS < 0.95 ? "bearish" : "neutral",
      direction: "down",
    });

    details.push({
      label: "Beating SPY",
      value: `${outCount}/11`,
      signal: outCount >= 6 ? "bullish" : outCount >= 4 ? "neutral" : "bearish",
      direction: outCount >= 6 ? "up" : outCount < 3 ? "down" : "flat",
    });

    details.push({
      label: "Rotation",
      value: rotationType,
      signal: rotationType === "Risk-On" ? "bullish" : rotationType === "Risk-Off" ? "bearish" : "neutral",
      direction: rotationType === "Risk-On" ? "up" : rotationType === "Risk-Off" ? "down" : "flat",
    });

  } else {
    // ─── Fallback: daily sector data ───
    const sorted = [...sectorPerfs].sort((a, b) => b.perf - a.perf);
    const positiveCount = sectorPerfs.filter(s => s.perf > 0).length;
    const avgTopPerf = sorted.slice(0, 3).reduce((a, b) => a + b.perf, 0) / 3;
    const avgBottomPerf = sorted.slice(-3).reduce((a, b) => a + b.perf, 0) / 3;

    if (avgTopPerf > 1) score += 15;
    else if (avgTopPerf > 0) score += 5;
    else score -= 15;

    if (avgBottomPerf > -0.5) score += 10;
    else if (avgBottomPerf > -1.5) score += 0;
    else score -= 10;

    const participation = positiveCount >= 8 ? "Broad" : positiveCount >= 5 ? "Moderate" : positiveCount >= 2 ? "Narrow" : "Very thin";

    details.push({
      label: "Sectors +",
      value: `${positiveCount}/11`,
      signal: positiveCount > 7 ? "bullish" : positiveCount > 4 ? "neutral" : "bearish",
      direction: positiveCount > 6 ? "up" : "down",
    });
    details.push({
      label: "Leader",
      value: SECTOR_ETFS[sorted[0]?.symbol] || sorted[0]?.symbol || "N/A",
      signal: sorted[0]?.perf > 0.5 ? "bullish" : "neutral",
      direction: "up",
    });
    details.push({
      label: "Laggard",
      value: SECTOR_ETFS[sorted[sorted.length - 1]?.symbol] || sorted[sorted.length - 1]?.symbol || "N/A",
      signal: sorted[sorted.length - 1]?.perf < -0.5 ? "bearish" : "neutral",
      direction: "down",
    });
    details.push({
      label: "Participation",
      value: participation,
      signal: participation === "Broad" ? "bullish" : participation === "Moderate" ? "neutral" : "bearish",
      direction: positiveCount > 6 ? "up" : positiveCount < 4 ? "down" : "flat",
    });
  }

  return { score: Math.max(0, Math.min(100, score)), details, rotationType };
}

function scoreMacro(tnxLevel: number, tnxSlope: number, dxySlope: number, dxyLevel: number): { score: number; details: CategoryScore["details"]; alerts: string[] } {
  const details: CategoryScore["details"] = [];
  const alerts: string[] = [];
  let score = 50;

  // 10Y yield — moderate is fine, extremes are bad
  if (tnxLevel < 3.5) score += 10;
  else if (tnxLevel < 4.5) score += 5;
  else if (tnxLevel < 5.0) score -= 5;
  else score -= 15;

  // Yield trend
  if (tnxSlope > 0.05) score -= 5; // rising yields = headwind
  else if (tnxSlope < -0.05) score += 5; // falling yields = tailwind

  // DXY trend (strong dollar = headwind for equities)
  if (dxySlope > 0.2) score -= 5;
  else if (dxySlope < -0.2) score += 5;

  // Fed stance estimate from yield level
  let fedStance = "NEUTRAL";
  if (tnxLevel > 4.5 && tnxSlope > 0) fedStance = "HAWKISH";
  else if (tnxLevel < 3.5 && tnxSlope < 0) fedStance = "DOVISH";

  details.push({
    label: "10Y Yield",
    value: `${tnxLevel.toFixed(2)}%`,
    signal: tnxLevel < 4.0 ? "bullish" : tnxLevel < 4.8 ? "neutral" : "bearish",
    direction: tnxSlope > 0.02 ? "up" : tnxSlope < -0.02 ? "down" : "flat",
  });

  details.push({
    label: "Yield Trend",
    value: `${tnxSlope > 0 ? "Rising" : tnxSlope < 0 ? "Falling" : "Flat"}  ${Math.abs(tnxSlope) > 0.05 ? "Active" : "Steady"}`,
    signal: tnxSlope < 0 ? "bullish" : tnxSlope > 0 ? "bearish" : "neutral",
    direction: tnxSlope > 0.02 ? "up" : tnxSlope < -0.02 ? "down" : "flat",
  });

  details.push({
    label: "DXY",
    value: dxyLevel > 0 ? dxyLevel.toFixed(2) : (dxySlope > 0.1 ? "Strengthening" : dxySlope < -0.1 ? "Weakening" : "Stable"),
    signal: dxySlope < 0 ? "bullish" : dxySlope > 0 ? "bearish" : "neutral",
    direction: dxySlope > 0.1 ? "up" : dxySlope < -0.1 ? "down" : "flat",
  });

  details.push({
    label: "Fed Stance",
    value: fedStance,
    signal: fedStance === "DOVISH" ? "bullish" : fedStance === "HAWKISH" ? "bearish" : "neutral",
    direction: "flat",
  });

  // FOMC 2026 dates (announcement days)
  const fomcDates2026 = [
    "2026-01-28", "2026-03-18", "2026-05-06", "2026-06-17",
    "2026-07-29", "2026-09-16", "2026-11-04", "2026-12-16",
  ];
  const now = new Date();
  const msPerDay = 86400000;
  for (const fomcDate of fomcDates2026) {
    const diff = (new Date(fomcDate).getTime() - now.getTime()) / msPerDay;
    if (diff >= -1 && diff <= 0) {
      // FOMC day
      alerts.push("FOMC decision TODAY — expect volatility");
      break;
    } else if (diff > 0 && diff <= 3) {
      alerts.push(`FOMC meeting in ${Math.ceil(diff)} day${diff > 1 ? "s" : ""} — position cautiously`);
      break;
    } else if (diff > 3 && diff <= 7) {
      alerts.push(`FOMC meeting next week (${fomcDate})`);
      break;
    }
  }

  return { score: Math.max(0, Math.min(100, score)), details, alerts };
}

function generateSummary(decision: string, score: number, regime: string, categories: CategoryScore[]): string {
  const volScore = categories.find(c => c.name === "Volatility")?.score ?? 50;
  const breadthScore = categories.find(c => c.name === "Breadth")?.score ?? 50;
  const momentumScore = categories.find(c => c.name === "Momentum")?.score ?? 50;

  const parts: string[] = [];

  if (regime === "UPTREND") parts.push("a trending environment");
  else if (regime === "DOWNTREND") parts.push("a bearish environment");
  else parts.push("a choppy, range-bound environment");

  if (volScore > 65) parts.push("with contained volatility");
  else if (volScore < 40) parts.push("with elevated volatility creating risk");

  if (breadthScore > 65) parts.push("and broad participation");
  else if (breadthScore < 40) parts.push("and narrow breadth");

  if (momentumScore > 65) parts.push("Strong sector rotation supports selective entries.");
  else if (momentumScore < 40) parts.push("Weak momentum suggests patience.");
  else parts.push("Momentum is mixed across sectors.");

  if (decision === "YES") {
    return `This is ${parts.join(" ")} Full position sizing warranted with disciplined risk management.`;
  } else if (decision === "CAUTION") {
    return `This is ${parts.join(" ")} Reduce position sizes and focus on A+ setups only.`;
  } else {
    return `This is ${parts.join(" ")} Preserve capital and wait for conditions to improve.`;
  }
}

function generateTerminalAnalysis(
  decision: string,
  score: number,
  regime: string,
  categories: CategoryScore[],
  breadth: BreadthMetrics | null,
  vixLevel: number,
  termStructureRatio: number,
  sectorPerfs: { symbol: string; perf: number }[],
  rsSectors: RSTickerData[] | null,
  tnxLevel: number,
  dxyLevel: number,
): TerminalAnalysis {
  // ── Regime traffic light ──
  let regimeSignal: "GREEN" | "AMBER" | "RED";
  let regimeLabel: string;

  if (regime === "UPTREND" && score >= 70) {
    regimeSignal = "GREEN"; regimeLabel = "UPTREND";
  } else if (regime === "DOWNTREND" && score < 50) {
    regimeSignal = "RED"; regimeLabel = "CORRECTION";
  } else if (regime === "DOWNTREND" || score < 45) {
    regimeSignal = "RED"; regimeLabel = "RISK-OFF";
  } else if (regime === "UPTREND" && score >= 60) {
    regimeSignal = "GREEN"; regimeLabel = "TRENDING";
  } else {
    regimeSignal = "AMBER"; regimeLabel = "CHOPPY";
  }

  // ── Synthesized narrative — hierarchical, max 3 sentences ──
  // Structure: (1) regime lead, (2) strongest supporting signal, (3) actionable exception only
  const parts: string[] = [];

  // Pre-compute key data
  const momentumScore = categories.find(c => c.name === "Momentum")?.score ?? 50;
  const trendScore = categories.find(c => c.name === "Trend")?.score ?? 50;
  const breadthScore = categories.find(c => c.name === "Breadth")?.score ?? 50;
  const pct50 = breadth?.pctAbove50d ?? 50;
  const m20 = breadth?.momentum20dState ?? "NORMAL";
  const burst = breadth?.burstRatio10d ?? 1.0;

  // RS rotation context
  let rotationRead = "";
  if (rsSectors && rsSectors.length >= 8) {
    const sorted = [...rsSectors].sort((a, b) => b.rsVsBenchmark - a.rsVsBenchmark);
    const top2 = sorted.slice(0, 2).map(s => RS_SECTOR_NAMES[s.symbol] || s.symbol).join(" and ");
    const outCount = sorted.filter(s => s.rsVsBenchmark > 1.0).length;
    const defAvgRank = sorted.reduce((sum, s, i) => DEFENSIVE_SECTORS.has(s.symbol) ? sum + i : sum, 0) / DEFENSIVE_SECTORS.size;
    const cycAvgRank = sorted.reduce((sum, s, i) => CYCLICAL_SECTORS.has(s.symbol) ? sum + i : sum, 0) / CYCLICAL_SECTORS.size;

    if (cycAvgRank < defAvgRank - 1.5) {
      rotationRead = `risk-on rotation (${top2} leading, ${outCount}/11 beating SPY)`;
    } else if (defAvgRank < cycAvgRank - 1.5) {
      rotationRead = `defensive rotation (${top2} leading, only ${outCount}/11 beating SPY)`;
    } else {
      rotationRead = `mixed rotation (${top2} leading, ${outCount}/11 beating SPY)`;
    }
  }

  if (regimeSignal === "RED") {
    // ── RED: bearish-only narrative, support the CASH stance ──

    // Sentence 1: regime + breadth
    if (breadth && pct50 < 25) {
      parts.push(`SPY is below all key moving averages with breadth deeply oversold at ${pct50}% above the 50d MA — selling is extreme but the trend remains broken.`);
    } else if (breadth && pct50 < 50) {
      parts.push(`SPY has broken below its key moving averages with only ${pct50}% of stocks above the 50d MA — breakouts lack follow-through in this environment.`);
    } else {
      parts.push("SPY has broken below its key moving averages — trend is corrective and breakouts are unreliable.");
    }

    // Sentence 2: strongest bearish supporting signal
    if (rotationRead.startsWith("defensive")) {
      parts.push(`25-day sector RS confirms ${rotationRead} — institutions are de-risking.`);
    } else if (burst < 0.5) {
      parts.push(`The 4% burst ratio at ${burst.toFixed(1)}x shows breakdowns dominating — selling conviction is strong.`);
    } else if (vixLevel > 30 && tnxLevel > 4.5) {
      parts.push("VIX at panic levels with yields spiking — liquidity stress is elevated.");
    } else if (vixLevel > 25 && termStructureRatio > 1.0) {
      parts.push("Elevated VIX with inverting term structure signals near-term stress.");
    } else if (rotationRead) {
      parts.push(`25-day sector RS shows ${rotationRead}.`);
    }

    // Sentence 3: only if bounce conditions are forming (actionable exception)
    if (m20 === "CAPITULATION") {
      parts.push("Capitulation signal active — watch for a 3-5 day reflex bounce but don't change bias.");
    } else if (pct50 < 25 && vixLevel > 30) {
      parts.push("Multiple oversold signals are stacking — a reflex bounce is likely but the trend remains down.");
    }

  } else if (regimeSignal === "GREEN") {
    // ── GREEN: bullish-only narrative, support the FULL SIZE stance ──

    // Sentence 1: regime + breadth
    if (breadth && pct50 > 70) {
      parts.push(`SPY is above all major moving averages with strong breadth at ${pct50}% above the 50d MA — breakouts are working with follow-through.`);
    } else if (breadth && pct50 < 50) {
      parts.push(`SPY is above all major moving averages but breadth is thinning at ${pct50}% above the 50d MA — uptrend intact with narrowing participation.`);
    } else {
      parts.push("SPY is holding above all major moving averages in a confirmed uptrend.");
    }

    // Sentence 2: strongest bullish supporting signal
    if (rotationRead.startsWith("risk-on")) {
      parts.push(`25-day sector RS confirms ${rotationRead} — risk appetite is healthy.`);
    } else if (burst >= 2.0) {
      parts.push(`The 4% burst ratio at ${burst.toFixed(1)}x confirms aggressive buying — big money is flowing in.`);
    } else if (vixLevel < 15) {
      parts.push("Low VIX confirms a complacent environment ideal for breakout follow-through.");
    } else if (rotationRead) {
      parts.push(`25-day sector RS shows ${rotationRead}.`);
    }

    // Sentence 3: only if imminent warning (actionable exception)
    if (m20 === "FROTHY") {
      parts.push("The 10% Study shows frothy conditions — scale into pullbacks rather than chasing.");
    } else if (breadth && pct50 > 80) {
      parts.push("Breadth above 80% is overextended — scale in rather than chasing.");
    } else if (tnxLevel > 4.8) {
      parts.push(`10Y yield at ${tnxLevel.toFixed(2)}% is a headwind for rate-sensitive sectors.`);
    }

  } else {
    // ── AMBER: mixed narrative, divergences are useful here ──

    // Sentence 1: choppy regime
    parts.push("SPY is caught between moving averages in a choppy, range-bound tape.");

    // Sentence 2: the key divergence or strongest signal
    if (momentumScore - trendScore > 25 && rotationRead) {
      parts.push(`Sector RS is strong (${rotationRead}) while the index trend is weak — stock-picker's market, not an index trade.`);
    } else if (breadthScore - trendScore > 30) {
      parts.push("Breadth is improving ahead of price — watch for SPY to reclaim the 20d MA to confirm a turn.");
    } else if (rotationRead.startsWith("defensive")) {
      parts.push(`25-day sector RS shows ${rotationRead} — lean defensive.`);
    } else if (rotationRead) {
      parts.push(`25-day sector RS shows ${rotationRead}.`);
    }

    // Sentence 3: macro/vol if extreme
    if (vixLevel > 30 && tnxLevel > 4.5) {
      parts.push("VIX at panic levels with yields spiking — stay in cash until stress subsides.");
    } else if (vixLevel > 25 && termStructureRatio > 1.0) {
      parts.push("Elevated VIX with inverting term structure — widen stops and reduce size.");
    } else if (dxyLevel < 100 && dxyLevel > 0) {
      parts.push("Weakening dollar supports commodity and international-facing sectors.");
    } else if (dxyLevel > 106) {
      parts.push("Strong dollar is a headwind for multinationals.");
    }
  }

  const narrative = parts.join(" ");

  // ── Bounce alert ──
  let bounceAlert: string | undefined;
  if (breadth && breadth.totalStocks > 50) {
    let bounceCount = 0;
    if (breadth.pctAbove50d < 25) bounceCount++;
    if (breadth.momentum20dState === "CAPITULATION") bounceCount++;
    if (vixLevel > 30) bounceCount++;
    if (breadth.quarterlyBreadthNet < -50) bounceCount++;

    if (bounceCount >= 2) {
      bounceAlert = "Bottom bounce conditions active — 3-5 day reflex bounce expected. Trade beaten-down names with tight stops, short duration only.";
    } else if (bounceCount === 1) {
      bounceAlert = "Single oversold signal detected — monitor for additional confirmation before bounce entries.";
    }
  }

  // ── Stance ──
  let stance: string;
  const hasBounce = bounceAlert?.includes("active");

  if (regimeSignal === "GREEN") {
    if (breadth?.momentum20dState === "FROTHY") {
      stance = "FULL SIZE — scale into pullbacks, don't chase";
    } else if (score >= 80) {
      stance = "FULL SIZE — press breakouts near highs";
    } else if (score >= 70) {
      stance = "FULL SIZE — buy pullbacks on strength";
    } else {
      stance = "HALF SIZE — selective, favor pullbacks to support";
    }
  } else if (regimeSignal === "AMBER") {
    stance = hasBounce
      ? "TACTICAL BOUNCE — half size, 3-5 day swings"
      : "HALF SIZE — A+ setups only, tight stops";
  } else {
    stance = hasBounce
      ? "DEFENSIVE + BOUNCE WATCH — bounce setups valid, cash otherwise"
      : "CASH / SHORT BIAS — wait for breadth improvement";
  }

  return { regime: { signal: regimeSignal, label: regimeLabel }, narrative, stance, bounceAlert };
}

export async function fetchDashboardData(): Promise<DashboardData> {
  // Check cache
  const now = Date.now();
  if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedData;
  }

  try {
    // Fetch all quotes in parallel
    const quotes = await getQuotes(ALL_SYMBOLS);
    
    // Fetch historical data for key symbols
    // Need 300+ calendar days to get 200 trading days for SMA200
    const [spyHist, qqqHist, vixHist, vix3mHist, vvixHist, tnxHist, dxyHist] = await Promise.all([
      getHistorical("SPY", 300),
      getHistorical("QQQ", 100),
      getHistorical("^VIX", 380),
      getHistorical("^VIX3M", 30),    // 30 days for term structure trend
      getHistorical("^VVIX", 380),    // 380 days for VVIX percentile
      getHistorical("^TNX", 30),
      getHistorical("DX-Y.NYB", 30),
    ]);

    // Extract current prices
    const spyPrice = quotes["SPY"]?.regularMarketPrice ?? 0;
    const qqqPrice = quotes["QQQ"]?.regularMarketPrice ?? 0;
    const vixLevel = quotes["^VIX"]?.regularMarketPrice ?? 20;
    const vix3mLevel = quotes["^VIX3M"]?.regularMarketPrice ?? vixLevel;
    const vix9dLevel = quotes["^VIX9D"]?.regularMarketPrice ?? vixLevel;
    const vvixLevel = quotes["^VVIX"]?.regularMarketPrice ?? 80;
    const tnxLevel = quotes["^TNX"]?.regularMarketPrice ?? 4.0;

    // Calculate technical indicators
    const spySMA20 = calculateSMA(spyHist.close, 20);
    const spySMA50 = calculateSMA(spyHist.close, 50);
    const spySMA200 = calculateSMA(spyHist.close, 200);
    const qqqSMA50 = calculateSMA(qqqHist.close, 50);

    const vixSlope = calculateSlope(vixHist.close.slice(-10), 5);
    const tnxSlope = calculateSlope(tnxHist.close, 5);
    const dxySlope = calculateSlope(dxyHist.close, 5);

    // VIX term structure metrics
    const termStructureRatio = vix3mLevel > 0 ? vixLevel / vix3mLevel : 1.0;
    const acutePanicRatio = vixLevel > 0 ? vix9dLevel / vixLevel : 1.0;
    const vvixPctile = vvixHist.close.length > 50 ? percentile(vvixLevel, vvixHist.close) : 50;

    // 5-day term structure slope (daily VIX/VIX3M ratios)
    const vixLast5 = vixHist.close.slice(-5);
    const vix3mLast5 = vix3mHist.close.slice(-5);
    const termStructure5d = vixLast5.length >= 5 && vix3mLast5.length >= 5
      ? vixLast5.map((v, i) => vix3mLast5[i] > 0 ? v / vix3mLast5[i] : 1.0)
      : [];
    const termStructureSlope = termStructure5d.length >= 5 ? calculateSlope(termStructure5d, 5) : 0;

    // Sector performances
    const sectorPerfs = Object.keys(SECTOR_ETFS).map(symbol => ({
      symbol,
      perf: quotes[symbol]?.regularMarketChangePercent ?? 0,
    }));

    // Fetch breadth, RS, and sheets data in parallel — non-blocking, fall back gracefully
    const [breadthSettled, rsSettled, sheetsSettled] = await Promise.allSettled([
      fetchBreadthMetrics(),
      fetchRelativeStrength(RS_SECTOR_SYMBOLS, "SPY", 25),
      fetchSheetsBreadthData(),
    ]);

    const breadthData: BreadthMetrics | null =
      breadthSettled.status === "fulfilled" ? breadthSettled.value : null;

    const rawRs = rsSettled.status === "fulfilled" ? rsSettled.value : null;
    const rsSectors: RSTickerData[] | null = rawRs
      ? rawRs.tickers.filter(t => RS_SECTOR_SYMBOLS.includes(t.symbol)).length >= 8
        ? rawRs.tickers.filter(t => RS_SECTOR_SYMBOLS.includes(t.symbol))
        : null
      : null;

    const sheetsData: SheetsBreadthData | null =
      sheetsSettled.status === "fulfilled" ? sheetsSettled.value : null;

    // Calculate category scores
    const volResult = scoreVolatility(
      vixLevel, vixSlope, vixHist.close,
      termStructureRatio, termStructureSlope, acutePanicRatio,
      vvixLevel, vvixPctile,
    );
    const trendResult = scoreTrend(spyPrice, spySMA20, spySMA50, spySMA200, qqqPrice, qqqSMA50);
    const breadthResult = scoreBreadth(breadthData, sectorPerfs.map(s => s.perf), sheetsData);
    const momentumResult = scoreMomentum(sectorPerfs, rsSectors);
    const dxyLevel = quotes["DX-Y.NYB"]?.regularMarketPrice ?? 0;
    const macroResult = scoreMacro(tnxLevel, tnxSlope, dxySlope, dxyLevel);

    const categories: CategoryScore[] = [
      { name: "Volatility", score: volResult.score, weight: 20, details: volResult.details },
      { name: "Momentum", score: momentumResult.score, weight: 20, details: momentumResult.details },
      { name: "Trend", score: trendResult.score, weight: 20, details: trendResult.details },
      { name: "Breadth", score: breadthResult.score, weight: 30, details: breadthResult.details },
      { name: "Macro", score: macroResult.score, weight: 10, details: macroResult.details },
    ];

    // Weighted score
    const marketQualityScore = Math.round(
      categories.reduce((sum, c) => sum + (c.score * c.weight / 100), 0)
    );

    // Decision thresholds (swing trading)
    const decision = marketQualityScore >= 80 ? "YES" 
      : marketQualityScore >= 60 ? "CAUTION" 
      : "NO";

    // Build tickers
    const tickers: MarketQuote[] = TICKER_SYMBOLS.map(symbol => {
      const q = quotes[symbol];
      const displaySymbol = symbol === "^VIX" ? "VIX" : symbol === "^VIX3M" ? "VIX3M" : symbol === "^VIX9D" ? "VIX9D" : symbol === "^VVIX" ? "VVIX" : symbol === "DX-Y.NYB" ? "DXY" : symbol === "^TNX" ? "TNX" : symbol;
      return {
        symbol: displaySymbol,
        price: q?.regularMarketPrice ?? 0,
        change: q?.regularMarketChange ?? 0,
        changePercent: q?.regularMarketChangePercent ?? 0,
        previousClose: q?.regularMarketPreviousClose ?? 0,
      };
    });

    // Add sector tickers
    const sectorTickers: MarketQuote[] = Object.keys(SECTOR_ETFS).map(symbol => {
      const q = quotes[symbol];
      return {
        symbol,
        price: q?.regularMarketPrice ?? 0,
        change: q?.regularMarketChange ?? 0,
        changePercent: q?.regularMarketChangePercent ?? 0,
        previousClose: q?.regularMarketPreviousClose ?? 0,
      };
    });

    const sectors = Object.entries(SECTOR_ETFS).map(([symbol, name]) => ({
      symbol,
      name,
      changePercent: quotes[symbol]?.regularMarketChangePercent ?? 0,
    }));

    const summary = generateSummary(decision, marketQualityScore, trendResult.regime, categories);
    const terminalAnalysis = generateTerminalAnalysis(
      decision, marketQualityScore, trendResult.regime, categories,
      breadthData, vixLevel, termStructureRatio, sectorPerfs,
      rsSectors, tnxLevel, dxyLevel,
    );

    // Capture as const so TypeScript can narrow properly in the object literal below
    const sd = sheetsData;
    const bd = breadthData;

    const data: DashboardData = {
      decision,
      marketQualityScore,
      summary,
      mode: "swing" as const,
      categories,
      tickers: [...tickers, ...sectorTickers],
      sectors: sectors.sort((a, b) => b.changePercent - a.changePercent),
      alerts: macroResult.alerts,
      lastUpdated: new Date().toISOString(),
      dataSource: "Yahoo Finance (delayed ~15min)",
      // 4% Study — prefer Google Sheets actual data; fall back to S&P500-derived
      burst: sd ? {
        view: "10d" as const,
        data: {
          "5d":  { ratio: sd.ratio5d,  breakouts: sd.breakouts5d,  breakdowns: sd.breakdowns5d },
          "10d": { ratio: sd.ratio10d, breakouts: sd.breakouts10d, breakdowns: sd.breakdowns10d },
        },
      } : bd ? {
        view: "10d" as const,
        data: {
          "5d":  { ratio: bd.burstRatio5d,  breakouts: bd.burstBreakouts5d, breakdowns: bd.burstBreakdowns5d },
          "10d": { ratio: bd.burstRatio10d, breakouts: bd.burstBreakouts,   breakdowns: bd.burstBreakdowns },
        },
      } : undefined,
      momentum20d: bd ? {
        up: bd.momentum20dUp,
        down: bd.momentum20dDown,
        percentUp:   bd.totalStocks > 0 ? Math.round((bd.momentum20dUp   / bd.totalStocks) * 1000) / 10 : 0,
        percentDown: bd.totalStocks > 0 ? Math.round((bd.momentum20dDown / bd.totalStocks) * 1000) / 10 : 0,
        state: bd.momentum20dState,
        totalStocks: bd.totalStocks,
      } : undefined,
      // Quarterly/Monthly Breadth — prefer Google Sheets actual data; fall back to S&P500-derived
      breadthToggle: sd ? {
        view: "qtr" as const,
        data: {
          mth: { net: sd.up25m - sd.down25m, up: sd.up25m, down: sd.down25m },
          qtr: { net: sd.up25q - sd.down25q, up: sd.up25q, down: sd.down25q },
        },
      } : bd ? {
        view: "qtr" as const,
        data: {
          mth: { net: bd.monthlyBreadthNet,   up: bd.monthlyUp25,   down: bd.monthlyDown25 },
          qtr: { net: bd.quarterlyBreadthNet, up: bd.quarterlyUp25, down: bd.quarterlyDown25 },
        },
      } : undefined,
      terminalAnalysis,
    };

    // Update cache
    cachedData = data;
    cacheTimestamp = now;

    return data;
  } catch (error) {
    console.error("Error fetching market data:", error);
    
    // Return fallback data if fetch fails
    if (cachedData) return cachedData;
    
    throw new Error("Failed to fetch market data and no cached data available");
  }
}
