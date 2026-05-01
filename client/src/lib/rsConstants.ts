export { RS_SYMBOLS as SEED_SYMBOLS } from "@shared/rsSymbols";

export const LOOKBACK_OPTIONS = [
  { label: "10D", value: 10 },
  { label: "25D", value: 25 },
  { label: "50D", value: 50 },
  { label: "90D", value: 90 },
] as const;

export const BENCHMARK_OPTIONS = [
  { label: "SPY", value: "SPY" },
  { label: "RSP", value: "RSP" },
  { label: "IWM", value: "IWM" },
  { label: "QQQ", value: "QQQ" },
] as const;

export const CATEGORY_FILTERS = ["All", "Sector", "Industry Group", "Index", "Stock"] as const;
export type CategoryFilter = typeof CATEGORY_FILTERS[number];
