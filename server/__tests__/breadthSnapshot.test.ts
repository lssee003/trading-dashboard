import { describe, it, expect, vi, beforeEach } from "vitest";
import { BreadthMetricsSchema } from "../../shared/schema";

// Use a small subset of real stocks for the live test
const SNAPSHOT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];

vi.mock("../sp500_all.json", () => ({
  default: ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"],
}));

describe("breadthSnapshot (live API)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns valid BreadthMetrics from live Yahoo Finance", async () => {
    const { fetchBreadthMetrics } = await import("../breadthData");
    const metrics = await fetchBreadthMetrics();

    // Shape validation via Zod schema
    const parsed = BreadthMetricsSchema.safeParse(metrics);
    expect(parsed.success).toBe(true);

    // Total stocks
    expect(metrics.totalStocks).toBeGreaterThan(0);
    expect(metrics.totalStocks).toBeLessThanOrEqual(SNAPSHOT_SYMBOLS.length);

    // Percentages are 0-100
    expect(metrics.pctAbove20d).toBeGreaterThanOrEqual(0);
    expect(metrics.pctAbove20d).toBeLessThanOrEqual(100);
    expect(metrics.pctAbove50d).toBeGreaterThanOrEqual(0);
    expect(metrics.pctAbove50d).toBeLessThanOrEqual(100);
    expect(metrics.pctAbove200d).toBeGreaterThanOrEqual(0);
    expect(metrics.pctAbove200d).toBeLessThanOrEqual(100);

    // A/D ratio is non-negative
    expect(metrics.advDecRatio).toBeGreaterThanOrEqual(0);

    // Counts are non-negative
    expect(metrics.advancing).toBeGreaterThanOrEqual(0);
    expect(metrics.declining).toBeGreaterThanOrEqual(0);
    expect(metrics.unchanged).toBeGreaterThanOrEqual(0);
    expect(metrics.newHighs).toBeGreaterThanOrEqual(0);
    expect(metrics.newLows).toBeGreaterThanOrEqual(0);
    expect(metrics.burstBreakouts).toBeGreaterThanOrEqual(0);
    expect(metrics.burstBreakdowns).toBeGreaterThanOrEqual(0);
    expect(metrics.quarterlyUp25).toBeGreaterThanOrEqual(0);
    expect(metrics.quarterlyDown25).toBeGreaterThanOrEqual(0);

    // Invariant: advancing + declining + unchanged = totalStocks
    expect(metrics.advancing + metrics.declining + metrics.unchanged)
      .toBe(metrics.totalStocks);

    // Invariant: highs + lows cannot exceed total stocks
    expect(metrics.newHighs + metrics.newLows).toBeLessThanOrEqual(metrics.totalStocks);

    // Counts bounded by totalStocks
    expect(metrics.quarterlyUp25).toBeLessThanOrEqual(metrics.totalStocks);
    expect(metrics.quarterlyDown25).toBeLessThanOrEqual(metrics.totalStocks);

    // isOversold is consistent with pctAbove50d
    expect(metrics.isOversold).toBe(metrics.pctAbove50d < 25);

    // lastUpdated is a valid ISO timestamp
    expect(new Date(metrics.lastUpdated).toISOString()).toBe(metrics.lastUpdated);
  }, 60_000);
});
