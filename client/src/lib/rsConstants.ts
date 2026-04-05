/** Jeff Sun's equal-weight ETF universe — seed watchlist */
export const SEED_SYMBOLS = [
  "SPY","FXI","GXC","FFTY","XHB","RSPT","CIBR","PBJ","XRT","RSPS",
  "IBUY","RSPR","DRIV","WCLD","PEJ","XTL","XSW","KIE","QQQE","IPAY",
  "USO","RSPD","KCE","RSP","ROBO","GNR","BOAT","XOP","FCG","BUZZ",
  "XHS","PAVE","RSPH","MOO","RSPF","RSPN","KBE","GBTC","XTN","RSPG",
  "XBI","BLOK","RSPC","RSPU","XSD","IWM","RSPM","XHE","XPH","KRE",
  "XAR","XES","COPX","PBW","XME","SLX","JETS",
] as const;

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

export const CATEGORY_FILTERS = ["All", "Index", "Sector", "Industry Group", "Stock"] as const;
export type CategoryFilter = typeof CATEGORY_FILTERS[number];
