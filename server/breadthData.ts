import YahooFinanceModule from "yahoo-finance2";
import allSp500Symbols from "./sp500_all.json";

const YahooFinance = (YahooFinanceModule as any).default || YahooFinanceModule;
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ─── Types ───────────────────────────────────────────────────

export interface BreadthMetrics {
  pctAbove20d: number;
  pctAbove50d: number;
  pctAbove200d: number;
  advDecRatio: number;
  advancing: number;
  declining: number;
  unchanged: number;
  newHighs: number;
  newLows: number;
  totalStocks: number;
  // 4% burst metrics
  burstRatio10d: number;      // 4% breakouts / 4% breakdowns over last 10 days
  burstBreakouts: number;     // total 4%+ up days in 10d window
  burstBreakdowns: number;    // total 4%+ down days in 10d window
  burstRatio5d: number;       // 4% breakouts / 4% breakdowns over last 5 days
  burstBreakouts5d: number;   // total 4%+ up days in 5d window
  burstBreakdowns5d: number;  // total 4%+ down days in 5d window
  quarterlyBreadthNet: number; // up25pct - down25pct count
  quarterlyUp25: number;
  quarterlyDown25: number;
  // 10% Study (5-day momentum oscillator, adjusted for S&P 500 large-caps)
  momentum20dUp: number;      // stocks up >=10% in last 5 trading days
  momentum20dDown: number;    // stocks down <=−10% in last 5 trading days
  momentum20dState: "FROTHY" | "CAPITULATION" | "LOW_ACTIVITY" | "NORMAL";
  // Monthly breadth (25% in 22 trading days)
  monthlyUp25: number;
  monthlyDown25: number;
  monthlyBreadthNet: number;
  isOversold: boolean;        // pctAbove50d < 25
  lastUpdated: string;
}

// ─── Cache ───────────────────────────────────────────────────

let cachedBreadth: BreadthMetrics | null = null;
let breadthCacheTimestamp = 0;
const BREADTH_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// ─── SMA helper ──────────────────────────────────────────────

export function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ─── Yahoo Finance data fetcher ──────────────────────────────

// Fetch raw (non-adjusted) closing prices for all stocks.
// We derive ALL metrics from this single data source for consistency:
//   - current price = last close
//   - daily change = last two closes
//   - 52-week high/low = max/min of last 252 closing prices
//   - MAs, burst ratio, quarterly breadth = all from closing prices

async function fetchHistoryBatch(
  symbols: string[],
  startDate: Date
): Promise<Record<string, number[]>> {
  const results: Record<string, number[]> = {};
  const endDate = new Date();
  const promises = symbols.map(async (symbol) => {
    try {
      const chart = await yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: "1d",
      });
      const closes: number[] = [];
      if (chart?.quotes) {
        for (const q of chart.quotes) {
          // Use raw close (not adjclose) — matches external-tool behavior
          // and avoids dividend-adjustment distortion for MA/breadth calculations
          const close = q.close;
          if (close && close > 0) closes.push(close);
        }
      }
      if (closes.length > 0) results[symbol] = closes;
    } catch {
      // skip failed symbols silently
    }
  });
  await Promise.all(promises);
  return results;
}

// ─── Main breadth fetcher ─────────────────────────────────────

let fetchInProgress = false;

export async function fetchBreadthMetrics(): Promise<BreadthMetrics> {
  if (cachedBreadth && Date.now() - breadthCacheTimestamp < BREADTH_CACHE_TTL) {
    return cachedBreadth;
  }
  // Prevent multiple concurrent fetches
  if (fetchInProgress) {
    // Return stale cache if available, else throw so caller can handle gracefully
    if (cachedBreadth) return cachedBreadth;
    throw new Error("Breadth fetch in progress");
  }
  fetchInProgress = true;

  const symbols = allSp500Symbols as string[];
  const BATCH_SIZE = 50;
  const startDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // ~400 days for 65d quarterly + 200d MA

  console.log(`Breadth: Fetching ${symbols.length} stocks in parallel batches of ${BATCH_SIZE}...`);
  const t0 = Date.now();

  try {
    // ── Parallel price history fetch ──
    const histBatches: string[][] = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      histBatches.push(symbols.slice(i, i + BATCH_SIZE));
    }

    const histResultArrays = await Promise.all(histBatches.map((batch) => fetchHistoryBatch(batch, startDate)));
    const allHistories: Record<string, number[]> = {};
    for (const batchResult of histResultArrays) {
      Object.assign(allHistories, batchResult);
    }

    console.log(`Breadth: Histories done (${Object.keys(allHistories).length} stocks) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    // ── Compute all metrics from history data ──

    let above20 = 0, above50 = 0, above200 = 0;
    let advancing = 0, declining = 0, unchanged = 0;
    let nearHigh = 0, nearLow = 0;
    let totalCounted = 0;

    // 4% burst: per stock, for each of the last 5/10 days, did it move ±4%+?
    let breakouts5d = 0, breakdowns5d = 0;   // last 5 days only
    let breakouts10d = 0, breakdowns10d = 0; // full 10 days

    // Quarterly breadth: up 25%+ vs down 25%+ in 65 trading days
    let quarterlyUp25 = 0;
    let quarterlyDown25 = 0;

    // 20% Study: stocks with >=20% move in last 5 trading days
    let momentum20dUp = 0;
    let momentum20dDown = 0;

    // Monthly breadth: up 25%+ vs down 25%+ in 22 trading days
    let monthlyUp25 = 0;
    let monthlyDown25 = 0;

    for (const sym of symbols) {
      const history = allHistories[sym];
      if (!history || history.length < 20) continue;
      totalCounted++;

      const currentPrice = history[history.length - 1];

      // MA crossovers
      const s20 = sma(history, 20);
      const s50 = sma(history, 50);
      const s200 = sma(history, 200);
      if (s20 && currentPrice > s20) above20++;
      if (s50 && currentPrice > s50) above50++;
      if (s200 && currentPrice > s200) above200++;

      // Advance / Decline — computed from last two closes
      if (history.length >= 2) {
        const prevClose = history[history.length - 2];
        if (prevClose > 0) {
          const changePct = ((currentPrice - prevClose) / prevClose) * 100;
          if (changePct > 0.05) advancing++;
          else if (changePct < -0.05) declining++;
          else unchanged++;
        }
      }

      // 52-week high/low from last 252 closing prices (not Yahoo's intraday-based fields)
      const lookback252 = history.slice(-252);
      let yearHigh = -Infinity;
      let yearLow = Infinity;
      for (const c of lookback252) {
        if (c > yearHigh) yearHigh = c;
        if (c < yearLow) yearLow = c;
      }

      // New highs / lows (within 5% of 52-week closing extremes)
      if (yearHigh > 0 && currentPrice >= yearHigh * 0.95) nearHigh++;
      if (yearLow < Infinity && currentPrice <= yearLow * 1.05) nearLow++;

      // 4% burst ratio: scan last 10 days of price history (5d subset for short window)
      if (history.length >= 11) {
        const last11 = history.slice(-11);
        for (let d = 1; d <= 10; d++) {
          if (last11[d - 1] > 0) {
            const dayChange = (last11[d] - last11[d - 1]) / last11[d - 1];
            if (dayChange >= 0.04) {
              breakouts10d++;
              if (d > 5) breakouts5d++;  // days 6-10 in last11 = most recent 5 trading days
            } else if (dayChange <= -0.04) {
              breakdowns10d++;
              if (d > 5) breakdowns5d++;
            }
          }
        }
      }

      // Quarterly breadth: up/down 25%+ in last 65 trading days
      if (history.length >= 66) {
        const price65dAgo = history[history.length - 66];
        if (price65dAgo > 0) {
          const quarterlyReturn = (currentPrice - price65dAgo) / price65dAgo;
          if (quarterlyReturn >= 0.25) quarterlyUp25++;
          else if (quarterlyReturn <= -0.25) quarterlyDown25++;
        }
      }

      // 10% Study: 5-day return (need at least 6 closes)
      if (history.length >= 6) {
        const price5dAgo = history[history.length - 6];
        if (price5dAgo > 0) {
          const fiveDayReturn = (currentPrice - price5dAgo) / price5dAgo;
          if (fiveDayReturn >= 0.10) momentum20dUp++;
          else if (fiveDayReturn <= -0.10) momentum20dDown++;
        }
      }

      // Monthly breadth: up/down 25%+ in last 22 trading days
      if (history.length >= 23) {
        const price22dAgo = history[history.length - 23];
        if (price22dAgo > 0) {
          const monthlyReturn = (currentPrice - price22dAgo) / price22dAgo;
          if (monthlyReturn >= 0.25) monthlyUp25++;
          else if (monthlyReturn <= -0.25) monthlyDown25++;
        }
      }
    }

    const pctAbove50d = totalCounted > 0 ? Math.round((above50 / totalCounted) * 100) : 0;

    // 10% Study classification (thresholds raised vs 20% study since more stocks hit 10%)
    const percentUp20 = totalCounted > 0 ? (momentum20dUp / totalCounted) * 100 : 0;
    const percentDown20 = totalCounted > 0 ? (momentum20dDown / totalCounted) * 100 : 0;
    const momentum20dState: BreadthMetrics["momentum20dState"] =
      percentUp20 >= 8 ? "FROTHY"
      : percentDown20 >= 5 ? "CAPITULATION"
      : (percentUp20 <= 1 && percentDown20 <= 1) ? "LOW_ACTIVITY"
      : "NORMAL";

    const burstRatio10d = breakdowns10d > 0
      ? Math.round((breakouts10d / breakdowns10d) * 10) / 10
      : breakouts10d > 0 ? 10 : 1;
    const burstRatio5d = breakdowns5d > 0
      ? Math.round((breakouts5d / breakdowns5d) * 10) / 10
      : breakouts5d > 0 ? 10 : 1;

    const result: BreadthMetrics = {
      pctAbove20d: totalCounted > 0 ? Math.round((above20 / totalCounted) * 100) : 0,
      pctAbove50d,
      pctAbove200d: totalCounted > 0 ? Math.round((above200 / totalCounted) * 100) : 0,
      advDecRatio: declining > 0 ? Math.round((advancing / declining) * 100) / 100 : advancing > 0 ? 10 : 1,
      advancing,
      declining,
      unchanged,
      newHighs: nearHigh,
      newLows: nearLow,
      totalStocks: totalCounted,
      burstRatio10d,
      burstBreakouts: breakouts10d,
      burstBreakdowns: breakdowns10d,
      burstRatio5d,
      burstBreakouts5d: breakouts5d,
      burstBreakdowns5d: breakdowns5d,
      quarterlyBreadthNet: quarterlyUp25 - quarterlyDown25,
      quarterlyUp25,
      quarterlyDown25,
      momentum20dUp,
      momentum20dDown,
      momentum20dState,
      monthlyUp25,
      monthlyDown25,
      monthlyBreadthNet: monthlyUp25 - monthlyDown25,
      isOversold: pctAbove50d < 25,
      lastUpdated: new Date().toISOString(),
    };

    cachedBreadth = result;
    breadthCacheTimestamp = Date.now();
    fetchInProgress = false;

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `Breadth: Done in ${elapsed}s — ${result.pctAbove50d}% > 50d MA, ` +
      `${result.pctAbove200d}% > 200d MA, ` +
      `highs/lows ${result.newHighs}/${result.newLows}, ` +
      `4% burst ${result.burstRatio10d}:1, ` +
      `10%study ${result.momentum20dState} (↑${momentum20dUp}/↓${momentum20dDown}), ` +
      `quarterly ${result.quarterlyBreadthNet > 0 ? "+" : ""}${result.quarterlyBreadthNet} (↑${quarterlyUp25}/↓${quarterlyDown25}), ` +
      `monthly ${result.monthlyBreadthNet > 0 ? "+" : ""}${result.monthlyBreadthNet} (↑${monthlyUp25}/↓${monthlyDown25}), ` +
      `from ${totalCounted}/${symbols.length} stocks`
    );

    return result;
  } catch (err) {
    fetchInProgress = false;
    if (cachedBreadth) return cachedBreadth;
    throw err;
  }
}
