import type { Express } from "express";
import type { Server } from "http";
import { fetchDashboardData } from "./marketData";
import { fetchRelativeStrength } from "./rsData";
import { fetchBreadthMetrics } from "./breadthData";
import { fetchGoogleSheetData } from "./sheetsData";
import { RS_SYMBOLS } from "../shared/rsSymbols";

export async function registerRoutes(server: Server, app: Express) {
  // Main dashboard data endpoint
  app.get("/api/dashboard", async (req, res) => {
    try {
      const data = await fetchDashboardData();
      res.json(data);
    } catch (error) {
      console.error("Dashboard API error:", error);
      res.status(500).json({ 
        error: "Failed to fetch market data",
        message: (error as Error).message 
      });
    }
  });

  // Relative Strength endpoint
  app.get("/api/relative-strength", async (req, res) => {
    try {
      const benchmark = (req.query.benchmark as string) || "SPY";
      const lookback = Math.min(200, Math.max(5, parseInt(req.query.lookback as string) || 25));
      const extra = req.query.extra ? (req.query.extra as string).split(",").map(s => s.trim().toUpperCase()).filter(Boolean) : [];

      // Combine default + extra, deduplicate, remove benchmark from list
      const allSymbols = Array.from(new Set([...RS_SYMBOLS, ...extra])).filter(s => s !== benchmark);

      const data = await fetchRelativeStrength(allSymbols, benchmark, lookback);
      res.json(data);
    } catch (error) {
      console.error("RS API error:", error);
      res.status(500).json({
        error: "Failed to fetch relative strength data",
        message: (error as Error).message,
      });
    }
  });

  // Google Sheets endpoint
  app.get("/api/sheets", async (_req, res) => {
    try {
      const data = await fetchGoogleSheetData();
      res.json(data);
    } catch (error) {
      console.error("Sheets API error:", error);
      res.status(500).json({
        error: "Failed to fetch Google Sheets data",
        message: (error as Error).message,
      });
    }
  });

  // Kick off breadth warm-up in background on server start (non-blocking)
  setTimeout(() => {
    console.log("Breadth: Starting background warm-up...");
    fetchBreadthMetrics().catch(e => console.warn("Breadth warm-up failed:", e.message?.slice(0, 100)));
  }, 3000);

  // Market breadth endpoint — returns cached data or null if still loading
  app.get("/api/breadth", async (_req, res) => {
    try {
      const data = await fetchBreadthMetrics();
      res.json(data);
    } catch (error) {
      console.error("Breadth API error:", error);
      res.status(500).json({
        error: "Failed to fetch breadth data",
        message: (error as Error).message,
      });
    }
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}
