/**
 * rsStocksData.ts — IBD-style per-stock RS ratings
 *
 * Source: daily CSVs computed by github.com/lssee003/relative-strength
 * (self-hosted mirror of Fred6725/relative-strength; GitHub Actions
 * recomputes rankings every weekday after US close and commits them
 * to output/). We fetch the raw CSVs, trim to the columns the UI needs,
 * and cache in memory — the data only changes once per trading day.
 */

import type { RSStock, RSIndustry, RSStocksResponse } from "../shared/schema";
import { parseCSV } from "./sheetsData";

const REPO_RAW = "https://raw.githubusercontent.com/lssee003/relative-strength/main/output";
const STOCKS_CSV_URL = `${REPO_RAW}/rs_stocks.csv`;
const INDUSTRIES_CSV_URL = `${REPO_RAW}/rs_industries.csv`;

const CACHE_TTL = 3 * 60 * 60 * 1000; // 3h — source updates once per weekday

let cache: { data: RSStocksResponse; timestamp: number } | null = null;

function num(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Build a header-name → column-index map so column reordering upstream can't break us. */
function headerIndex(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { idx[h.trim()] = i; });
  return idx;
}

async function fetchCSV(url: string): Promise<string[][]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return parseCSV(await res.text());
}

function parseStocks(rows: string[][]): RSStock[] {
  const [header, ...body] = rows;
  const col = headerIndex(header);
  const stocks: RSStock[] = [];
  for (const r of body) {
    const ticker = r[col["Ticker"]]?.trim();
    const rank = num(r[col["Rank"]]);
    const rsValue = num(r[col["Relative Strength"]]);
    const rsPercentile = num(r[col["Percentile"]]);
    if (!ticker || rank === null || rsValue === null || rsPercentile === null) continue;
    stocks.push({
      rank,
      ticker,
      sector: r[col["Sector"]]?.trim() || "Unknown",
      industry: r[col["Industry"]]?.trim() || "Unknown",
      rsValue,
      rsPercentile,
      rs1M: num(r[col["1M_RS_Percentile"]]),
      rs3M: num(r[col["3M_RS_Percentile"]]),
      rs6M: num(r[col["6M_RS_Percentile"]]),
      price: num(r[col["Price"]]),
      marketCap: num(r[col["MarketCap"]]),
      pctFrom52WkHigh: num(r[col["PctFrom52WkHigh"]]),
      avgVol30: num(r[col["AvgVol30"]]),
    });
  }
  return stocks;
}

function parseIndustries(rows: string[][]): RSIndustry[] {
  const [header, ...body] = rows;
  const col = headerIndex(header);
  const industries: RSIndustry[] = [];
  for (const r of body) {
    const industry = r[col["Industry"]]?.trim();
    const rank = num(r[col["Rank"]]);
    const rsPercentile = num(r[col["Percentile"]]);
    if (!industry || rank === null || rsPercentile === null) continue;
    industries.push({
      rank,
      industry,
      sector: r[col["Sector"]]?.trim() || "Unknown",
      rsPercentile,
      tickers: (r[col["Tickers"]] || "").split(",").map(t => t.trim()).filter(Boolean),
    });
  }
  return industries;
}

export async function fetchRSStocks(): Promise<RSStocksResponse> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  try {
    const [stockRows, industryRows] = await Promise.all([
      fetchCSV(STOCKS_CSV_URL),
      fetchCSV(INDUSTRIES_CSV_URL),
    ]);

    const data: RSStocksResponse = {
      stocks: parseStocks(stockRows),
      industries: parseIndustries(industryRows),
      lastUpdated: new Date().toISOString(),
    };
    if (data.stocks.length === 0) throw new Error("rs_stocks.csv parsed to 0 rows");

    cache = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    // Serve stale data over an error page — the ratings barely move day to day
    if (cache) {
      console.warn("RS stocks fetch failed, serving stale cache:", (error as Error).message);
      return cache.data;
    }
    throw error;
  }
}
