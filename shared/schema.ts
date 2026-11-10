import { z } from "zod";

// Market data types — no database needed, all data is live/cached

export const MarketQuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  previousClose: z.number(),
});

export type MarketQuote = z.infer<typeof MarketQuoteSchema>;

export const CategoryScoreSchema = z.object({
  name: z.string(),
  score: z.number(),
  weight: z.number(),
  details: z.array(z.object({
    label: z.string(),
    value: z.string(),
    signal: z.enum(["bullish", "bearish", "neutral"]),
    direction: z.enum(["up", "down", "flat"]),
    oversoldAlert: z.boolean().optional(),
    burstToggle: z.boolean().optional(),
    momentum20dToggle: z.boolean().optional(),
    breadthToggleFlag: z.boolean().optional(),
  })),
});

export type CategoryScore = z.infer<typeof CategoryScoreSchema>;

// ─── Terminal Analysis Types ───

export const TerminalAnalysisSchema = z.object({
  regime: z.object({
    signal: z.enum(["GREEN", "AMBER", "RED"]),
    label: z.string(),
  }),
  narrative: z.string(),
  stance: z.string(),
  bounceAlert: z.string().optional(),
});

export type TerminalAnalysis = z.infer<typeof TerminalAnalysisSchema>;

export const DashboardDataSchema = z.object({
  decision: z.enum(["YES", "CAUTION", "NO"]),
  marketQualityScore: z.number(),
  summary: z.string(),
  mode: z.enum(["swing", "day"]),
  categories: z.array(CategoryScoreSchema),
  tickers: z.array(MarketQuoteSchema),
  sectors: z.array(z.object({
    symbol: z.string(),
    name: z.string(),
    changePercent: z.number(),
  })),
  alerts: z.array(z.string()),
  lastUpdated: z.string(),
  dataSource: z.string(),
  burst: z.object({
    view: z.enum(["5d", "10d"]),
    data: z.object({
      "5d": z.object({ ratio: z.number(), breakouts: z.number(), breakdowns: z.number() }),
      "10d": z.object({ ratio: z.number(), breakouts: z.number(), breakdowns: z.number() }),
    }),
  }).optional(),
  momentum20d: z.object({
    up: z.number(),
    down: z.number(),
    percentUp: z.number(),
    percentDown: z.number(),
    state: z.enum(["FROTHY", "CAPITULATION", "LOW_ACTIVITY", "NORMAL"]),
    totalStocks: z.number(),
  }).optional(),
  breadthToggle: z.object({
    view: z.enum(["mth", "qtr"]),
    data: z.object({
      mth: z.object({ net: z.number(), up: z.number(), down: z.number() }),
      qtr: z.object({ net: z.number(), up: z.number(), down: z.number() }),
    }),
  }).optional(),
  terminalAnalysis: TerminalAnalysisSchema.optional(),
});

export type DashboardData = z.infer<typeof DashboardDataSchema>;

// ─── Relative Strength Types ───

export const RSTickerDataSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  category: z.enum(["Index", "Sector", "Industry Group", "Stock"]),
  latestClose: z.number(),
  returnPct: z.number(),
  rsVsBenchmark: z.number(),
  histogram: z.array(z.number()), // daily RS ratios over lookback window
  failed: z.boolean().optional(),
});

export type RSTickerData = z.infer<typeof RSTickerDataSchema>;

export const RSResponseSchema = z.object({
  benchmark: z.string(),
  lookback: z.number(),
  tickers: z.array(RSTickerDataSchema),
  failedSymbols: z.array(z.string()),
  lastUpdated: z.string(),
});

export type RSResponse = z.infer<typeof RSResponseSchema>;

// ─── Breadth Types ───

export const BreadthMetricsSchema = z.object({
  pctAbove20d: z.number(),
  pctAbove50d: z.number(),
  pctAbove200d: z.number(),
  advDecRatio: z.number(),
  advancing: z.number(),
  declining: z.number(),
  unchanged: z.number(),
  newHighs: z.number(),
  newLows: z.number(),
  totalStocks: z.number(),
  burstRatio10d: z.number(),
  burstBreakouts: z.number(),
  burstBreakdowns: z.number(),
  burstRatio5d: z.number(),
  burstBreakouts5d: z.number(),
  burstBreakdowns5d: z.number(),
  quarterlyBreadthNet: z.number(),
  quarterlyUp25: z.number(),
  quarterlyDown25: z.number(),
  // 20% Study (5-day momentum oscillator)
  momentum20dUp: z.number(),
  momentum20dDown: z.number(),
  momentum20dState: z.enum(["FROTHY", "CAPITULATION", "LOW_ACTIVITY", "NORMAL"]),
  // Monthly breadth (25% in 22 trading days)
  monthlyUp25: z.number(),
  monthlyDown25: z.number(),
  monthlyBreadthNet: z.number(),
  isOversold: z.boolean(),
  lastUpdated: z.string(),
});

export type BreadthMetrics = z.infer<typeof BreadthMetricsSchema>;
// ─── Google Sheets Types ───

export const SheetsCellSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  colorType: z.enum(["green", "red", "yellow", "blue"]).optional(),
  intensity: z.number().optional(), // 0-1 opacity strength
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
});

export type SheetsCell = z.infer<typeof SheetsCellSchema>;

export const SheetsDataSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(SheetsCellSchema)),
  lastUpdated: z.string(),
  sheetTitle: z.string(),
  groupHeaders: z.array(z.string()).optional(),
});

export type SheetsData = z.infer<typeof SheetsDataSchema>;

// ─── IBD-Style Stock RS Types (from lssee003/relative-strength daily CSVs) ───

export const RSStockSchema = z.object({
  rank: z.number(),
  ticker: z.string(),
  sector: z.string(),
  industry: z.string(),
  rsValue: z.number(),                 // raw RS score (SPY = 100)
  rsPercentile: z.number(),            // 0-99
  rs1M: z.number().nullable(),         // percentile 1 month ago
  rs3M: z.number().nullable(),
  rs6M: z.number().nullable(),
  price: z.number().nullable(),
  marketCap: z.number().nullable(),
  pctFrom52WkHigh: z.number().nullable(),
  avgVol30: z.number().nullable(),
});

export type RSStock = z.infer<typeof RSStockSchema>;

export const RSIndustrySchema = z.object({
  rank: z.number(),
  industry: z.string(),
  sector: z.string(),
  rsPercentile: z.number(),
  tickers: z.array(z.string()),        // members, strongest first
});

export type RSIndustry = z.infer<typeof RSIndustrySchema>;

export const RSStocksResponseSchema = z.object({
  stocks: z.array(RSStockSchema),
  industries: z.array(RSIndustrySchema),
  lastUpdated: z.string(),
});

export type RSStocksResponse = z.infer<typeof RSStocksResponseSchema>;

// ─── Pre-market EP scan (written by the scheduled scan via `ep_tools.py publish`) ───

const EpOutcome = z.enum(["PASS", "PARTIAL", "FAIL"]);

export const EpCriterionSchema = z.object({
  id: z.string(), // C1..C9
  status: z.enum(["pass", "partial", "fail", "unverified", "tbd"]),
  score: z.number().nullable(), // null = to be confirmed after the open (C9)
  rationale: z.string(),
});

export const EpCandidateSchema = z.object({
  ticker: z.string(),
  rank: z.number(),
  strength: z.enum(["Strong", "Moderate-Strong", "Moderate", "Weak", "Excluded"]),
  outcome: EpOutcome,
  catalyst: z.string(),
  criteria: z.array(EpCriterionSchema).nullable(), // null when a hard trap ended scoring
  score: z.number().nullable(),
  traps: z.array(z.object({ id: z.number(), severity: z.enum(["hard", "cautionary"]), note: z.string() })),
  pm: z.object({ price: z.number(), gap_pct: z.number(), volume: z.number(), avg_vol_90d: z.number().nullable().optional() }),
  note: z.string(),
  lifecycle: z.string().nullable().optional(),
});

export const EpScreenerRowSchema = z.object({
  ticker: z.string(),
  exchange: z.string().optional(),
  company: z.string().optional(),
  gap_pct: z.number(),
  pm_volume: z.number(),
  pm_price: z.number(),
  market_cap: z.number(),
  last_er: z.string().nullable().optional(),
  e_flag: z.boolean(),
  catalyst: z.object({
    status: z.enum(["verified", "unverified", "none"]),
    summary: z.string(),
    source: z.string().optional(),
    attempts: z.array(z.string()).optional(),
  }),
  disposition: z.enum(["ranked", "excluded"]),
  reason: z.string(),
});

export const EpScanSchema = z.object({
  schema_version: z.number(),
  scan_date: z.string(), // YYYY-MM-DD, US-Eastern
  run: z.object({ started_utc: z.string(), et_time: z.string(), session: z.string(), mode: z.enum(["full", "awareness"]), note: z.string().nullable().optional() }),
  verdict: z.object({ status: EpOutcome, strong_count: z.number(), regime: z.string() }),
  market: z.object({
    vix: z.number().nullable(),
    spx: z.number().nullable(),
    spx_ytd_pct: z.number().nullable(),
    spx_vs_sma50_pct: z.number().nullable(),
    spx_vs_sma200_pct: z.number().nullable(),
    trap8: z.boolean(),
    notes: z.string().nullable().optional(),
  }),
  screener: z.array(EpScreenerRowSchema),
  cross_check: z.string().nullable().optional(),
  candidates: z.array(EpCandidateSchema),
  narrative: z.object({ regime: z.string(), analysis: z.string(), lifecycle: z.string().nullable().optional() }),
  sources: z.array(z.object({ command: z.string(), source: z.string(), fetched_utc: z.string().nullable().optional(), note: z.string().nullable().optional() })),
  watchlist: z.array(z.string()),
  failures: z.array(z.string()).optional(),
  max_score: z.number(),
  warnings: z.array(z.string()),
  published_utc: z.string(),
});

export type EpCriterion = z.infer<typeof EpCriterionSchema>;
export type EpCandidate = z.infer<typeof EpCandidateSchema>;
export type EpScreenerRow = z.infer<typeof EpScreenerRowSchema>;
export type EpScan = z.infer<typeof EpScanSchema>;

/** One line per published day, newest first — drives the EP tab's date picker */
export const EpIndexSchema = z.object({
  schema_version: z.number(),
  updated_utc: z.string(),
  scans: z.array(z.object({
    date: z.string(),
    verdict: EpOutcome,
    strong_count: z.number(),
    watchlist: z.array(z.string()),
    screened: z.number(),
    scored: z.number(),
    warnings: z.number(),
  })),
});

export type EpIndex = z.infer<typeof EpIndexSchema>;
