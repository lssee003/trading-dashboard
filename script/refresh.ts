/**
 * refresh.ts — Pre-compute dashboard + RS data and write to static JSON.
 *
 * Usage:  npx tsx script/refresh.ts
 * Called by GitHub Actions before the static build.
 */

import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fetchDashboardData } from "../server/marketData";
import { fetchRelativeStrength } from "../server/rsData";
import { fetchGoogleSheetData } from "../server/sheetsData";

const OUT_DIR = path.resolve("client/public/data");

const RS_SYMBOLS = [
  "SPY","FXI","GXC","FFTY","XHB","RSPT","CIBR","PBJ","XRT","RSPS",
  "IBUY","RSPR","DRIV","WCLD","PEJ","XTL","XSW","KIE","QQQE","IPAY",
  "USO","RSPD","KCE","RSP","ROBO","GNR","BOAT","XOP","FCG","BUZZ",
  "XHS","PAVE","RSPH","MOO","RSPF","RSPN","KBE","GBTC","XTN","RSPG",
  "XBI","BLOK","RSPC","RSPU","XSD","IWM","RSPM","XHE","XPH","KRE",
  "XAR","XES","COPX","PBW","XME","SLX","JETS",
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const t0 = Date.now();

  console.log("=== Refresh: fetching dashboard data ===");
  const dashboard = await fetchDashboardData();
  writeFileSync(path.join(OUT_DIR, "dashboard.json"), JSON.stringify(dashboard));
  console.log(`Dashboard done (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  console.log("=== Refresh: fetching relative strength ===");
  const t1 = Date.now();
  const rs = await fetchRelativeStrength(RS_SYMBOLS, "SPY", 25);
  writeFileSync(path.join(OUT_DIR, "rs.json"), JSON.stringify(rs));
  console.log(`RS done (${((Date.now() - t1) / 1000).toFixed(1)}s)`);

  console.log("=== Refresh: fetching Google Sheets data ===");
  const t2 = Date.now();
  try {
    const sheets = await fetchGoogleSheetData();
    writeFileSync(path.join(OUT_DIR, "sheets.json"), JSON.stringify(sheets));
    console.log(`Google Sheets done (${((Date.now() - t2) / 1000).toFixed(1)}s)`);
  } catch (error) {
    console.error("Google Sheets fetch failed (continuing):", error);
    // Write empty data so the page doesn't crash
    writeFileSync(path.join(OUT_DIR, "sheets.json"), JSON.stringify({
      headers: [],
      rows: [],
      lastUpdated: new Date().toISOString(),
      sheetTitle: "Error loading sheet",
    }));
  }

  console.log(`=== Refresh complete in ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
}

main().catch((err) => {
  console.error("Refresh failed:", err);
  process.exit(1);
});
