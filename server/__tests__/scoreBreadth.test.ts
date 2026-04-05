import { describe, it, expect } from "vitest";
import { scoreBreadth } from "../marketData";
import type { BreadthMetrics } from "../../shared/schema";

/** Helper to create a BreadthMetrics object with defaults, overriding specific fields */
function makeBreadth(overrides: Partial<BreadthMetrics> = {}): BreadthMetrics {
  return {
    pctAbove20d: 50,
    pctAbove50d: 50,
    pctAbove200d: 50,
    advDecRatio: 1.0,
    advancing: 250,
    declining: 250,
    unchanged: 0,
    newHighs: 20,
    newLows: 20,
    totalStocks: 500,
    burstRatio10d: 1.0,
    burstBreakouts: 100,
    burstBreakdowns: 100,
    burstRatio5d: 1.0,
    burstBreakouts5d: 50,
    burstBreakdowns5d: 50,
    quarterlyBreadthNet: 0,
    quarterlyUp25: 50,
    quarterlyDown25: 50,
    momentum20dUp: 0,
    momentum20dDown: 0,
    momentum20dState: "NORMAL" as const,
    monthlyUp25: 10,
    monthlyDown25: 10,
    monthlyBreadthNet: 0,
    isOversold: false,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

const neutralSectors = [0.5, -0.3, 0.2, -0.1, 0.4, -0.2, 0.3, -0.4, 0.1, -0.5, 0.6];

describe("scoreBreadth()", () => {
  // ─── Score ranges for different market conditions ───

  it("strong bull market → high score (80+)", () => {
    const breadth = makeBreadth({
      pctAbove50d: 80,
      pctAbove200d: 70,
      advDecRatio: 3.0,
      newHighs: 100,
      newLows: 10,
      burstRatio10d: 2.5,
      quarterlyBreadthNet: 60,
    });
    const { score } = scoreBreadth(breadth, neutralSectors);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("moderate bull → mid score (55-75)", () => {
    const breadth = makeBreadth({
      pctAbove50d: 55,
      pctAbove200d: 50,
      advDecRatio: 1.5,
      burstRatio10d: 1.5,
    });
    const { score } = scoreBreadth(breadth, neutralSectors);
    expect(score).toBeGreaterThanOrEqual(55);
    expect(score).toBeLessThanOrEqual(75);
  });

  it("weak/bearish market → low score (0-30)", () => {
    const breadth = makeBreadth({
      pctAbove50d: 20,
      pctAbove200d: 30,
      advDecRatio: 0.3,
      newHighs: 2,
      newLows: 100,
      burstRatio10d: 0.3,
      isOversold: true,
    });
    const { score } = scoreBreadth(breadth, neutralSectors);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(30);
  });

  // ─── Scoring logic for individual metrics ───

  it("pctAbove50d > 70 adds +25 points", () => {
    const high = makeBreadth({ pctAbove50d: 75 });
    const low = makeBreadth({ pctAbove50d: 25 }); // < 30 → -20 points
    const { score: highScore } = scoreBreadth(high, neutralSectors);
    const { score: lowScore } = scoreBreadth(low, neutralSectors);
    // Difference should be 45 points (25 - (-20))
    expect(highScore - lowScore).toBe(45);
  });

  it("pctAbove200d > 60 adds +10, < 40 subtracts -10", () => {
    const high = makeBreadth({ pctAbove200d: 65 });
    const low = makeBreadth({ pctAbove200d: 35 });
    const { score: highScore } = scoreBreadth(high, neutralSectors);
    const { score: lowScore } = scoreBreadth(low, neutralSectors);
    expect(highScore - lowScore).toBe(20); // +10 vs -10
  });

  it("advDecRatio > 2 adds +5, < 0.5 subtracts -10", () => {
    const high = makeBreadth({ advDecRatio: 2.5 });
    const low = makeBreadth({ advDecRatio: 0.3 });
    const { score: highScore } = scoreBreadth(high, neutralSectors);
    const { score: lowScore } = scoreBreadth(low, neutralSectors);
    expect(highScore - lowScore).toBe(15); // +5 vs -10
  });

  it("newLows > newHighs*3 subtracts -10", () => {
    const bearish = makeBreadth({ newHighs: 10, newLows: 50 });
    const neutral = makeBreadth({ newHighs: 20, newLows: 20 });
    const { score: bearScore } = scoreBreadth(bearish, neutralSectors);
    const { score: neutScore } = scoreBreadth(neutral, neutralSectors);
    expect(neutScore - bearScore).toBe(10);
  });

  it("newHighs > newLows*3 adds +5", () => {
    const bullish = makeBreadth({ newHighs: 60, newLows: 10 });
    const neutral = makeBreadth({ newHighs: 20, newLows: 20 });
    const { score: bullScore } = scoreBreadth(bullish, neutralSectors);
    const { score: neutScore } = scoreBreadth(neutral, neutralSectors);
    expect(bullScore - neutScore).toBe(5);
  });

  it("burst >= 2.0 adds +15, < 0.5 subtracts -15", () => {
    const high = makeBreadth({ burstRatio10d: 2.5 });
    const low = makeBreadth({ burstRatio10d: 0.3 });
    const { score: highScore } = scoreBreadth(high, neutralSectors);
    const { score: lowScore } = scoreBreadth(low, neutralSectors);
    expect(highScore - lowScore).toBe(30); // +15 vs -15
  });

  // ─── 10% Study scoring ───

  it("FROTHY state subtracts -10 points", () => {
    const frothy = makeBreadth({ momentum20dState: "FROTHY" });
    const normal = makeBreadth({ momentum20dState: "NORMAL" });
    const { score: frothyScore } = scoreBreadth(frothy, neutralSectors);
    const { score: normalScore } = scoreBreadth(normal, neutralSectors);
    expect(normalScore - frothyScore).toBe(10);
  });

  it("CAPITULATION state adds +15 points", () => {
    const cap = makeBreadth({ momentum20dState: "CAPITULATION" });
    const normal = makeBreadth({ momentum20dState: "NORMAL" });
    const { score: capScore } = scoreBreadth(cap, neutralSectors);
    const { score: normalScore } = scoreBreadth(normal, neutralSectors);
    expect(capScore - normalScore).toBe(15);
  });

  it("LOW_ACTIVITY and NORMAL add 0 points", () => {
    const low = makeBreadth({ momentum20dState: "LOW_ACTIVITY" });
    const normal = makeBreadth({ momentum20dState: "NORMAL" });
    const { score: lowScore } = scoreBreadth(low, neutralSectors);
    const { score: normalScore } = scoreBreadth(normal, neutralSectors);
    expect(lowScore).toBe(normalScore);
  });

  it("10% Study detail row has momentum20dToggle flag", () => {
    const breadth = makeBreadth();
    const { details } = scoreBreadth(breadth, neutralSectors);
    const studyDetail = details.find((d) => d.label === "10% Study");
    expect(studyDetail).toBeDefined();
    expect(studyDetail!.momentum20dToggle).toBe(true);
  });

  it("Qtrly Breadth detail row has breadthToggleFlag", () => {
    const breadth = makeBreadth();
    const { details } = scoreBreadth(breadth, neutralSectors);
    const breadthDetail = details.find((d) => d.label === "Qtrly Breadth");
    expect(breadthDetail).toBeDefined();
    expect(breadthDetail!.breadthToggleFlag).toBe(true);
  });

  // ─── Quarterly breadth scoring ───

  it("quarterlyBreadthNet > 50 adds +10, <= -30 subtracts -15", () => {
    const high = makeBreadth({ quarterlyBreadthNet: 60 });
    const low = makeBreadth({ quarterlyBreadthNet: -50 });
    const { score: highScore } = scoreBreadth(high, neutralSectors);
    const { score: lowScore } = scoreBreadth(low, neutralSectors);
    expect(highScore - lowScore).toBe(25); // +10 vs -15
  });

  it("quarterlyBreadthNet > 0 adds +5", () => {
    const positive = makeBreadth({ quarterlyBreadthNet: 20 });
    const negative = makeBreadth({ quarterlyBreadthNet: -10 });
    const { score: posScore } = scoreBreadth(positive, neutralSectors);
    const { score: negScore } = scoreBreadth(negative, neutralSectors);
    expect(posScore - negScore).toBe(10); // +5 vs -5
  });

  // ─── Clamping ───

  it("score is clamped to 0 minimum", () => {
    const extreme = makeBreadth({
      pctAbove50d: 10,
      pctAbove200d: 10,
      advDecRatio: 0.1,
      newHighs: 0,
      newLows: 200,
      burstRatio10d: 0.1,
    });
    const { score } = scoreBreadth(extreme, neutralSectors);
    expect(score).toBe(0);
  });

  it("score is clamped to 100 maximum", () => {
    const extreme = makeBreadth({
      pctAbove50d: 95,
      pctAbove200d: 90,
      advDecRatio: 5.0,
      newHighs: 200,
      newLows: 0,
      burstRatio10d: 5.0,
    });
    const { score } = scoreBreadth(extreme, neutralSectors);
    expect(score).toBe(100);
  });

  // ─── Fallback to sector-based estimate ───

  it("null breadth falls back to sector estimate (most sectors up → higher score)", () => {
    const bullSectors = [1.5, 2.0, 0.8, 1.2, 0.5, 0.3, 1.0, 0.9, -0.2, -0.1, 0.4];
    const { score } = scoreBreadth(null, bullSectors);
    // 9/11 sectors positive → pctAbove = 81% → +25 → score = 75
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it("null breadth with all sectors down → low score", () => {
    const bearSectors = [-1.5, -2.0, -0.8, -1.2, -0.5, -0.3, -1.0, -0.9, -0.2, -0.1, -0.4];
    const { score } = scoreBreadth(null, bearSectors);
    expect(score).toBeLessThanOrEqual(30);
  });

  it("totalStocks <= 50 triggers sector fallback", () => {
    const lowCount = makeBreadth({ totalStocks: 30, pctAbove50d: 80 });
    const { score, details } = scoreBreadth(lowCount, neutralSectors);
    // Should use sector fallback, not the breadth data
    expect(details.some((d) => d.label === "Sectors Advancing")).toBe(true);
  });

  // ─── Details validation ───

  it("returns expected detail labels for real breadth data", () => {
    const breadth = makeBreadth();
    const { details } = scoreBreadth(breadth, neutralSectors);
    const labels = details.map((d) => d.label);
    expect(labels).toContain("% > 50d MA");
    expect(labels).toContain("% > 200d MA");
    expect(labels).toContain("% > 20d MA");
    expect(labels).toContain("NYSE A/D");
    expect(labels).toContain("NAS Highs/Lows");
    expect(labels).toContain("4% Burst (10d)");
    expect(labels).toContain("10% Study");
    expect(labels).toContain("Qtrly Breadth");
  });

  it("all detail signals are valid values", () => {
    const breadth = makeBreadth();
    const { details } = scoreBreadth(breadth, neutralSectors);
    for (const d of details) {
      expect(["bullish", "bearish", "neutral"]).toContain(d.signal);
      expect(["up", "down", "flat"]).toContain(d.direction);
    }
  });

  it("fallback details contain sector labels", () => {
    const { details } = scoreBreadth(null, neutralSectors);
    const labels = details.map((d) => d.label);
    expect(labels).toContain("Sectors Advancing");
    expect(labels).toContain("A/D Ratio");
  });
});
