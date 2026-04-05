import { describe, it, expect } from "vitest";
import { sma } from "../breadthData";

describe("sma()", () => {
  it("returns null when data length < period", () => {
    expect(sma([1, 2, 3], 5)).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(sma([], 1)).toBeNull();
  });

  it("computes correctly when length equals period", () => {
    expect(sma([10, 20, 30, 40, 50], 5)).toBe(30);
  });

  it("uses only the last N elements when length > period", () => {
    // last 3 of [1, 2, 3, 4, 5] are [3, 4, 5] => average = 4
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4);
  });

  it("handles period=1 (returns last element)", () => {
    expect(sma([10, 20, 30], 1)).toBe(30);
  });

  it("handles single-element array with period=1", () => {
    expect(sma([42], 1)).toBe(42);
  });

  it("computes SMA(20) correctly for constant data", () => {
    const closes = Array.from({ length: 20 }, () => 100);
    expect(sma(closes, 20)).toBe(100);
  });

  it("handles floating point precision reasonably", () => {
    const result = sma([1.1, 2.2, 3.3], 3);
    expect(result).toBeCloseTo(2.2, 10);
  });

  it("computes SMA(200) from 300 bars", () => {
    // 300 bars from 1 to 300. Last 200 are 101..300, avg = 200.5
    const closes = Array.from({ length: 300 }, (_, i) => i + 1);
    expect(sma(closes, 200)).toBe(200.5);
  });
});
