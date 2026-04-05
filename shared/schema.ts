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
