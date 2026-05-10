import YahooFinanceModule from "yahoo-finance2";
import type { RSResponse, RSTickerData } from "../shared/schema";

const YahooFinance = (YahooFinanceModule as any).default || YahooFinanceModule;
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ─── ETF category classification ───

const ETF_META: Record<string, { name: string; category: "Index" | "Sector" | "Industry Group" }> = {
  SPY: { name: "S&P 500", category: "Index" },
  RSP: { name: "S&P 500 Equal Wt", category: "Index" },
  IWM: { name: "Russell 2000", category: "Index" },
  IWC: { name: "Micro-Cap", category: "Index" },
  IJH: { name: "S&P MidCap 400", category: "Index" },
  QQQE: { name: "Nasdaq-100 Equal Wt", category: "Index" },
  FFTY: { name: "IBD 50", category: "Index" },
  FXI: { name: "China Large-Cap", category: "Index" },
  GXC: { name: "S&P China", category: "Index" },
  GBTC: { name: "Grayscale Bitcoin", category: "Index" },
  BLOK: { name: "Blockchain", category: "Index" },
  INDA: { name: "MSCI India", category: "Index" },
  EEM:  { name: "Emerging Markets", category: "Index" },

  RSPG: { name: "S&P 500 EW Energy", category: "Sector" },
  RSPT: { name: "S&P 500 EW Technology", category: "Sector" },
  RSPH: { name: "S&P 500 EW Health Care", category: "Sector" },
  RSPF: { name: "S&P 500 EW Financials", category: "Sector" },
  RSPD: { name: "S&P 500 EW Consumer Disc", category: "Sector" },
  RSPS: { name: "S&P 500 EW Consumer Stpls", category: "Sector" },
  RSPC: { name: "S&P 500 EW Communication", category: "Sector" },
  RSPR: { name: "S&P 500 EW Real Estate", category: "Sector" },
  RSPU: { name: "S&P 500 EW Utilities", category: "Sector" },
  RSPM: { name: "S&P 500 EW Materials", category: "Sector" },
  RSPN: { name: "S&P 500 EW Industrials", category: "Sector" },

  XHB: { name: "Homebuilders", category: "Industry Group" },
  CIBR: { name: "Cybersecurity", category: "Industry Group" },
  PBJ: { name: "Food & Beverage", category: "Industry Group" },
  XRT: { name: "Retail", category: "Industry Group" },
  IBUY: { name: "Online Retail", category: "Industry Group" },
  DRIV: { name: "EV & Autonomous", category: "Industry Group" },
  WCLD: { name: "Cloud Computing", category: "Industry Group" },
  PEJ: { name: "Leisure & Entertain", category: "Industry Group" },
  XTL: { name: "Telecom", category: "Industry Group" },
  XSW: { name: "Software", category: "Industry Group" },
  KIE: { name: "Insurance", category: "Industry Group" },
  IPAY: { name: "FinTech", category: "Industry Group" },
  USO: { name: "Crude Oil", category: "Industry Group" },
  KCE: { name: "Capital Markets", category: "Industry Group" },
  ROBO: { name: "Robotics & AI", category: "Industry Group" },
  GNR: { name: "Natural Resources", category: "Industry Group" },
  BOAT: { name: "Marine & Shipping", category: "Industry Group" },
  XOP: { name: "Oil & Gas E&P", category: "Industry Group" },
  FCG: { name: "Natural Gas", category: "Industry Group" },
  BUZZ: { name: "Social Sentiment", category: "Industry Group" },
  XHS: { name: "Health Svcs", category: "Industry Group" },
  PAVE: { name: "Infrastructure", category: "Industry Group" },
  MOO: { name: "Agribusiness", category: "Industry Group" },
  KBE: { name: "Banking", category: "Industry Group" },
  XTN: { name: "Transportation", category: "Industry Group" },
  XBI: { name: "Biotech", category: "Industry Group" },
  XSD: { name: "Semiconductor", category: "Industry Group" },
  XHE: { name: "Health Equip", category: "Industry Group" },
  XPH: { name: "Pharmaceuticals", category: "Industry Group" },
  KRE: { name: "Regional Banking", category: "Industry Group" },
  XAR: { name: "Aerospace & Defense", category: "Industry Group" },
  XES: { name: "Oil Equip & Svcs", category: "Industry Group" },
  COPX: { name: "Copper Miners", category: "Industry Group" },
  PBW: { name: "Clean Energy", category: "Industry Group" },
  XME: { name: "Metals & Mining", category: "Industry Group" },
  SLX: { name: "Steel", category: "Industry Group" },
  JETS: { name: "Airlines", category: "Industry Group" },
  QTUM: { name: "Quantum Computing", category: "Industry Group" },
  REMX: { name: "Rare Earth Metals", category: "Industry Group" },
  URA:  { name: "Uranium", category: "Industry Group" },
  URNM: { name: "Uranium Miners", category: "Industry Group" },
  LIT:  { name: "Lithium & Battery", category: "Industry Group" },
  GDX:  { name: "Gold Miners", category: "Industry Group" },
  SIL:  { name: "Silver Miners", category: "Industry Group" },
  UFO:  { name: "Space Exploration", category: "Industry Group" },
  WGMI: { name: "Bitcoin Miners", category: "Industry Group" },
  ARKG: { name: "Genomics", category: "Industry Group" },
  SRVR: { name: "Data Centers", category: "Industry Group" },
  MSOS: { name: "Cannabis", category: "Industry Group" },
  GLD:  { name: "Spot Gold", category: "Industry Group" },
  SLV:  { name: "Spot Silver", category: "Industry Group" },
  TAN:  { name: "Solar Energy", category: "Industry Group" },
  PSIL: { name: "Psychedelics", category: "Industry Group" },
};

// ─── Cache ───

interface CacheEntry {
  data: RSResponse;
  timestamp: number;
}
const rsCache = new Map<string, CacheEntry>();
const RS_CACHE_TTL = 120_000; // 2 minutes

// ─── Historical price fetcher ───

async function fetchHistory(symbol: string, calendarDays: number): Promise<{ dates: string[]; closes: number[] }> {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - calendarDays);

    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: "1d",
    });

    const dates: string[] = [];
    const closes: number[] = [];

    if (result?.quotes) {
      for (const q of result.quotes) {
        if (q.close != null && q.date) {
          dates.push(new Date(q.date).toISOString().slice(0, 10));
          closes.push(q.close);
        }
      }
    }

    return { dates, closes };
  } catch (e) {
    console.warn(`RS: Failed to fetch history for ${symbol}:`, (e as Error).message);
    return { dates: [], closes: [] };
  }
}

// ─── RS calculation ───

function alignSeries(
  tickerDates: string[],
  tickerCloses: number[],
  benchDates: string[],
  benchCloses: number[],
): { tickerAligned: number[]; benchAligned: number[]; commonDates: string[] } {
  const benchMap = new Map<string, number>();
  benchDates.forEach((d, i) => benchMap.set(d, benchCloses[i]));

  const commonDates: string[] = [];
  const tickerAligned: number[] = [];
  const benchAligned: number[] = [];

  for (let i = 0; i < tickerDates.length; i++) {
    const d = tickerDates[i];
    const bClose = benchMap.get(d);
    if (bClose !== undefined) {
      commonDates.push(d);
      tickerAligned.push(tickerCloses[i]);
      benchAligned.push(bClose);
    }
  }

  return { tickerAligned, benchAligned, commonDates };
}

function computeRSData(
  tickerAligned: number[],
  benchAligned: number[],
  lookback: number,
): { returnPct: number; rsVsBenchmark: number; histogram: number[] } {
  // Take last N trading days
  const n = Math.min(lookback, tickerAligned.length);
  const tSlice = tickerAligned.slice(-n);
  const bSlice = benchAligned.slice(-n);

  if (tSlice.length < 2 || bSlice.length < 2) {
    return { returnPct: 0, rsVsBenchmark: 1, histogram: [] };
  }

  const tickerReturn = (tSlice[tSlice.length - 1] / tSlice[0]) - 1;
  const benchReturn = (bSlice[bSlice.length - 1] / bSlice[0]) - 1;

  const rsMultiple = benchReturn !== 0
    ? (1 + tickerReturn) / (1 + benchReturn)
    : (1 + tickerReturn);

  // Generate daily RS ratio series for histogram
  const histogram: number[] = [];
  for (let i = 0; i < tSlice.length; i++) {
    // Cumulative return from start up to day i
    const tCumRet = tSlice[i] / tSlice[0];
    const bCumRet = bSlice[i] / bSlice[0];
    histogram.push(bCumRet !== 0 ? tCumRet / bCumRet : tCumRet);
  }

  return {
    returnPct: tickerReturn * 100,
    rsVsBenchmark: rsMultiple,
    histogram,
  };
}

// ─── Main fetcher ───

export async function fetchRelativeStrength(
  symbols: string[],
  benchmark: string = "SPY",
  lookback: number = 25,
): Promise<RSResponse> {
  // Check cache
  const cacheKey = `${symbols.sort().join(",")}_${benchmark}_${lookback}`;
  const cached = rsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RS_CACHE_TTL) {
    return cached.data;
  }

  // Calendar days: ~1.5x trading days + buffer
  const calendarDays = Math.ceil(lookback * 2) + 15;

  // Fetch benchmark first
  const benchHistory = await fetchHistory(benchmark, calendarDays);
  if (benchHistory.closes.length < 5) {
    throw new Error(`Insufficient benchmark data for ${benchmark}`);
  }

  // Fetch all symbols in batches (5 concurrent)
  const tickers: RSTickerData[] = [];
  const failedSymbols: string[] = [];
  const batchSize = 5;

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const history = await fetchHistory(symbol, calendarDays);
          if (history.closes.length < 5) {
            failedSymbols.push(symbol);
            return null;
          }

          const { tickerAligned, benchAligned } = alignSeries(
            history.dates, history.closes,
            benchHistory.dates, benchHistory.closes,
          );

          if (tickerAligned.length < 5) {
            failedSymbols.push(symbol);
            return null;
          }

          const rsData = computeRSData(tickerAligned, benchAligned, lookback);

          const meta = ETF_META[symbol];
          const tickerData: RSTickerData = {
            symbol,
            name: meta?.name ?? symbol,
            category: meta?.category ?? "Stock",
            latestClose: tickerAligned[tickerAligned.length - 1],
            returnPct: rsData.returnPct,
            rsVsBenchmark: rsData.rsVsBenchmark,
            histogram: rsData.histogram,
          };

          return tickerData;
        } catch (e) {
          console.warn(`RS: Error processing ${symbol}:`, (e as Error).message);
          failedSymbols.push(symbol);
          return null;
        }
      })
    );

    for (const r of results) {
      if (r) tickers.push(r);
    }
  }

  const response: RSResponse = {
    benchmark,
    lookback,
    tickers,
    failedSymbols,
    lastUpdated: new Date().toISOString(),
  };

  // Cache
  rsCache.set(cacheKey, { data: response, timestamp: Date.now() });

  return response;
}
