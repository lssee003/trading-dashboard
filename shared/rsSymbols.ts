/** Canonical ETF universe for the Relative Strength page. */
export const RS_SYMBOLS = [
  "SPY","FXI","GXC","FFTY","XHB","RSPT","CIBR","PBJ","XRT","RSPS",
  "IBUY","RSPR","DRIV","WCLD","PEJ","XTL","XSW","KIE","QQQE","IPAY",
  "USO","RSPD","KCE","RSP","ROBO","GNR","BOAT","XOP","FCG","BUZZ",
  "XHS","PAVE","RSPH","MOO","RSPF","RSPN","KBE","GBTC","XTN","RSPG",
  "XBI","BLOK","RSPC","RSPU","XSD","IWM","RSPM","XHE","XPH","KRE",
  "XAR","XES","COPX","PBW","XME","SLX","JETS",
  "QTUM","REMX","URA","URNM","LIT","GDX","SIL","UFO","WGMI","ARKG","INDA","EEM","SRVR","MSOS",
  "GLD","SLV","TAN",
] as const;

export type RSSymbol = typeof RS_SYMBOLS[number];
