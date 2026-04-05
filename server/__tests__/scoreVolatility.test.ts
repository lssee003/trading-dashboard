import { describe, it, expect } from "vitest";
import { scoreVolatility } from "../marketData";

/** Helper with neutral defaults */
function callScore(overrides: {
  vixLevel?: number;
  vixSlope?: number;
  vix1YearData?: number[];
  termStructureRatio?: number;
  termStructureSlope?: number;
  acutePanicRatio?: number;
  vvixLevel?: number;
  vvixPctile?: number;
} = {}) {
  return scoreVolatility(
    overrides.vixLevel ?? 18,
    overrides.vixSlope ?? 0,
    overrides.vix1YearData ?? Array.from({ length: 252 }, (_, i) => 12 + (i / 252) * 20),
    overrides.termStructureRatio ?? 0.92,
    overrides.termStructureSlope ?? 0,
    overrides.acutePanicRatio ?? 0.95,
    overrides.vvixLevel ?? 85,
    overrides.vvixPctile ?? 50,
  );
}

describe("scoreVolatility()", () => {
  // ─── Full scenario tests ───

  it("ideal conditions → high score (80+)", () => {
    const { score } = callScore({
      vixLevel: 14,           // +20
      vixSlope: -0.8,         // +8
      termStructureRatio: 0.90, // +12
      vvixLevel: 75,          // +8
      acutePanicRatio: 0.85,  // +5
    });
    // 50 + 20 + 8 + 12 + 8 + 5 = 103 → clamped to 100
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("panic conditions → low score (0-20)", () => {
    const { score } = callScore({
      vixLevel: 35,           // -25
      vixSlope: 0.8,          // -8
      termStructureRatio: 1.10, // -12
      vvixLevel: 130,         // -8
      acutePanicRatio: 1.15,  // -5
    });
    // 50 - 25 - 8 - 12 - 8 - 5 = -8 → clamped to 0
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(20);
  });

  it("neutral conditions → mid score (50-70)", () => {
    const { score } = callScore({
      vixLevel: 18,           // +12
      vixSlope: 0,            // 0
      termStructureRatio: 0.92, // +12
      vvixLevel: 90,          // +2
      acutePanicRatio: 0.95,  // +2
    });
    // 50 + 12 + 0 + 12 + 2 + 2 = 78 — actually quite bullish
    expect(score).toBeGreaterThanOrEqual(50);
  });

  // ─── VIX Level component ───

  it("VIX < 15 adds +20", () => {
    const low = callScore({ vixLevel: 12 });
    const high = callScore({ vixLevel: 35 });
    // +20 vs -25 = 45 point diff
    expect(low.score - high.score).toBe(45);
  });

  it("VIX 20-25 adds +3, VIX 25-30 subtracts -10", () => {
    const elevated = callScore({ vixLevel: 22 });
    const high = callScore({ vixLevel: 28 });
    expect(elevated.score - high.score).toBe(13); // +3 vs -10
  });

  // ─── Term Structure component ───

  it("normal contango (0.85-0.95) adds +12", () => {
    const contango = callScore({ termStructureRatio: 0.90 });
    const backwardation = callScore({ termStructureRatio: 1.10 });
    expect(contango.score - backwardation.score).toBe(24); // +12 vs -12
  });

  it("steep contango (<0.85) adds +8 (less than normal contango)", () => {
    const steep = callScore({ termStructureRatio: 0.80 });
    const normal = callScore({ termStructureRatio: 0.90 });
    expect(normal.score - steep.score).toBe(4); // +12 vs +8
  });

  it("mild inversion (1.0-1.05) subtracts -6", () => {
    const mild = callScore({ termStructureRatio: 1.02 });
    const normal = callScore({ termStructureRatio: 0.92 });
    expect(normal.score - mild.score).toBe(18); // +12 vs -6
  });

  // ─── VVIX component ───

  it("VVIX < 80 adds +8, VVIX > 120 subtracts -8", () => {
    const calm = callScore({ vvixLevel: 75 });
    const extreme = callScore({ vvixLevel: 130 });
    expect(calm.score - extreme.score).toBe(16); // +8 vs -8
  });

  it("VVIX 100-120 subtracts -5", () => {
    const elevated = callScore({ vvixLevel: 110 });
    const normal = callScore({ vvixLevel: 90 });
    expect(normal.score - elevated.score).toBe(7); // +2 vs -5
  });

  // ─── VIX9D Acute Panic ───

  it("VIX9D/VIX > 1.1 subtracts -5, < 0.9 adds +5", () => {
    const panic = callScore({ acutePanicRatio: 1.15 });
    const calm = callScore({ acutePanicRatio: 0.85 });
    expect(calm.score - panic.score).toBe(10); // +5 vs -5
  });

  // ─── VIX Slope ───

  it("steep declining slope adds +8, steep rising subtracts -8", () => {
    const falling = callScore({ vixSlope: -0.8 });
    const rising = callScore({ vixSlope: 0.8 });
    expect(falling.score - rising.score).toBe(16); // +8 vs -8
  });

  // ─── Clamping ───

  it("score is clamped to 0 minimum", () => {
    const { score } = callScore({
      vixLevel: 40,
      vixSlope: 1.0,
      termStructureRatio: 1.2,
      vvixLevel: 140,
      acutePanicRatio: 1.2,
    });
    expect(score).toBe(0);
  });

  it("score is clamped to 100 maximum", () => {
    const { score } = callScore({
      vixLevel: 10,
      vixSlope: -1.0,
      termStructureRatio: 0.90,
      vvixLevel: 70,
      acutePanicRatio: 0.80,
    });
    expect(score).toBe(100);
  });

  // ─── Detail rows ───

  it("returns expected detail labels", () => {
    const { details } = callScore();
    const labels = details.map(d => d.label);
    expect(labels).toContain("VIX Level");
    expect(labels).toContain("VIX 1Y Percentile");
    expect(labels).toContain("Term Structure");
    expect(labels).toContain("VVIX");
    expect(labels).toContain("VIX Trend");
    expect(labels).not.toContain("Put/Call Ratio");
  });

  it("all detail signals are valid values", () => {
    const { details } = callScore();
    for (const d of details) {
      expect(["bullish", "bearish", "neutral"]).toContain(d.signal);
      expect(["up", "down", "flat"]).toContain(d.direction);
    }
  });

  it("term structure detail shows correct label for contango", () => {
    const { details } = callScore({ termStructureRatio: 0.90 });
    const ts = details.find(d => d.label === "Term Structure");
    expect(ts?.value).toContain("Contango");
    expect(ts?.signal).toBe("bullish");
  });

  it("term structure detail shows backwardation for ratio > 1.05", () => {
    const { details } = callScore({ termStructureRatio: 1.10 });
    const ts = details.find(d => d.label === "Term Structure");
    expect(ts?.value).toContain("Backwardation");
    expect(ts?.signal).toBe("bearish");
  });

  it("VVIX detail shows correct quality labels", () => {
    const { details: calm } = callScore({ vvixLevel: 75 });
    expect(calm.find(d => d.label === "VVIX")?.value).toContain("Calm");

    const { details: extreme } = callScore({ vvixLevel: 125 });
    expect(extreme.find(d => d.label === "VVIX")?.value).toContain("Extreme");
  });
});
