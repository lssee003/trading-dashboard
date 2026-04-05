import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UPTREND_300,
  DOWNTREND_300,
  FLAT_300,
  SHORT_15,
  MINIMAL_20,
  makeBurstPrices,
  makeQuarterlySurge,
  makeQuarterlyCrash,
  make5daySurge,
  make5dayCrash,
  makeMonthlySurge,
  makeMonthlyCrash,
  linearPrices,
} from "./fixtures/mockPrices";

// ── Mock setup ──────────────────────────────────────────────

const TEST_SYMBOLS = ["SYM1", "SYM2", "SYM3", "SYM4", "SYM5", "SYM6", "SYM7", "SYM8", "SYM9", "SYM10"];

// Mock sp500_all.json to use our 10 test symbols
vi.mock("../sp500_all.json", () => ({
  default: ["SYM1", "SYM2", "SYM3", "SYM4", "SYM5", "SYM6", "SYM7", "SYM8", "SYM9", "SYM10"],
}));

// Mock yahoo-finance2
const mockChart = vi.fn();
vi.mock("yahoo-finance2", () => ({
  default: {
    default: class {
      chart = mockChart;
    },
  },
}));

// Helper: configure mockChart to return specific prices per symbol
function setMockPrices(pricesBySymbol: Record<string, number[]>) {
  mockChart.mockImplementation(async (symbol: string) => {
    const prices = pricesBySymbol[symbol] ?? [];
    return {
      quotes: prices.map((close) => ({ close, date: new Date() })),
    };
  });
}

// Helper: set all 10 symbols to the same price array
function setAllPrices(prices: number[]) {
  const map: Record<string, number[]> = {};
  for (const sym of TEST_SYMBOLS) map[sym] = prices;
  setMockPrices(map);
}

// ── Tests ────────────────────────────────────────────────────

describe("fetchBreadthMetrics()", () => {
  beforeEach(async () => {
    // Reset modules to clear cached breadth + fetchInProgress state
    vi.resetModules();
    mockChart.mockReset();
  });

  async function callFetchBreadth() {
    // Dynamic import after resetModules to get fresh module state
    const { fetchBreadthMetrics } = await import("../breadthData");
    return fetchBreadthMetrics();
  }

  // ─── MA crossover tests ───

  describe("moving average crossovers", () => {
    it("all uptrend → 100% above all MAs", async () => {
      setAllPrices(UPTREND_300);
      const m = await callFetchBreadth();
      expect(m.totalStocks).toBe(10);
      expect(m.pctAbove20d).toBe(100);
      expect(m.pctAbove50d).toBe(100);
      expect(m.pctAbove200d).toBe(100);
    });

    it("all downtrend → 0% above all MAs", async () => {
      setAllPrices(DOWNTREND_300);
      const m = await callFetchBreadth();
      expect(m.pctAbove20d).toBe(0);
      expect(m.pctAbove50d).toBe(0);
      expect(m.pctAbove200d).toBe(0);
    });

    it("flat prices → 0% above (price equals MA, not strictly above)", async () => {
      setAllPrices(FLAT_300);
      const m = await callFetchBreadth();
      expect(m.pctAbove50d).toBe(0);
    });

    it("6 uptrend + 4 downtrend → 60% above 50d MA", async () => {
      const prices: Record<string, number[]> = {};
      for (let i = 0; i < 6; i++) prices[TEST_SYMBOLS[i]] = UPTREND_300;
      for (let i = 6; i < 10; i++) prices[TEST_SYMBOLS[i]] = DOWNTREND_300;
      setMockPrices(prices);
      const m = await callFetchBreadth();
      expect(m.totalStocks).toBe(10);
      expect(m.pctAbove50d).toBe(60);
    });

    it("stocks with < 20 bars excluded from totalStocks", async () => {
      const prices: Record<string, number[]> = {};
      for (let i = 0; i < 5; i++) prices[TEST_SYMBOLS[i]] = UPTREND_300;
      for (let i = 5; i < 10; i++) prices[TEST_SYMBOLS[i]] = SHORT_15;
      setMockPrices(prices);
      const m = await callFetchBreadth();
      expect(m.totalStocks).toBe(5);
      expect(m.pctAbove50d).toBe(100); // all 5 valid stocks are uptrend
    });

    it("stock with exactly 20 bars: SMA(20) computable, SMA(50)/200 skipped", async () => {
      // MINIMAL_20 is uptrend 100→120. SMA(20) = avg of all 20 values.
      // Last price = 120, SMA(20) = ~110 → above20d should count
      const prices: Record<string, number[]> = {};
      prices[TEST_SYMBOLS[0]] = MINIMAL_20;
      for (let i = 1; i < 10; i++) prices[TEST_SYMBOLS[i]] = SHORT_15;
      setMockPrices(prices);
      const m = await callFetchBreadth();
      expect(m.totalStocks).toBe(1);
      expect(m.pctAbove20d).toBe(100); // 120 > SMA(20)
      // SMA(50) is null → doesn't count toward above50, pctAbove50d = 0/1 = 0
      expect(m.pctAbove50d).toBe(0);
      expect(m.pctAbove200d).toBe(0);
    });
  });

  // ─── Advance / Decline tests ───

  describe("advance/decline", () => {
    it("uptrend → all advancing (positive daily change)", async () => {
      setAllPrices(UPTREND_300);
      const m = await callFetchBreadth();
      expect(m.advancing).toBe(10);
      expect(m.declining).toBe(0);
      expect(m.unchanged).toBe(0);
    });

    it("downtrend → all declining", async () => {
      setAllPrices(DOWNTREND_300);
      const m = await callFetchBreadth();
      expect(m.advancing).toBe(0);
      expect(m.declining).toBe(10);
    });

    it("flat → all unchanged", async () => {
      setAllPrices(FLAT_300);
      const m = await callFetchBreadth();
      expect(m.unchanged).toBe(10);
      expect(m.advancing).toBe(0);
      expect(m.declining).toBe(0);
    });

    it("advDecRatio = advancing/declining, rounded to 2 decimals", async () => {
      const prices: Record<string, number[]> = {};
      for (let i = 0; i < 7; i++) prices[TEST_SYMBOLS[i]] = UPTREND_300;
      for (let i = 7; i < 10; i++) prices[TEST_SYMBOLS[i]] = DOWNTREND_300;
      setMockPrices(prices);
      const m = await callFetchBreadth();
      expect(m.advDecRatio).toBeCloseTo(7 / 3, 1); // 2.33
    });

    it("advDecRatio caps at 10 when declining = 0", async () => {
      setAllPrices(UPTREND_300);
      const m = await callFetchBreadth();
      expect(m.advDecRatio).toBe(10);
    });

    it("advDecRatio = 1 when both advancing and declining = 0", async () => {
      setAllPrices(FLAT_300);
      const m = await callFetchBreadth();
      expect(m.advDecRatio).toBe(1);
    });

    it("change < 0.05% counts as unchanged", async () => {
      // Two bars: 100, 100.04 → +0.04% < 0.05% threshold → unchanged
      const prices = Array.from({ length: 298 }, () => 100);
      prices.push(100, 100.04);
      setAllPrices(prices);
      const m = await callFetchBreadth();
      expect(m.unchanged).toBe(10);
    });

    it("change >= 0.06% counts as advancing", async () => {
      const prices = Array.from({ length: 298 }, () => 100);
      prices.push(100, 100.06);
      setAllPrices(prices);
      const m = await callFetchBreadth();
      expect(m.advancing).toBe(10);
    });
  });

  // ─── 52-week Highs/Lows tests ───

  describe("52-week highs/lows (from closing prices)", () => {
    it("stock at yearly high → counted as nearHigh", async () => {
      setAllPrices(UPTREND_300);
      const m = await callFetchBreadth();
      // Current = 200 = max of last 252 closes → within 5% → nearHigh
      expect(m.newHighs).toBe(10);
    });

    it("stock at yearly low → counted as nearLow", async () => {
      setAllPrices(DOWNTREND_300);
      const m = await callFetchBreadth();
      // Current = 100 = min of last 252 closes → within 5% → nearLow
      expect(m.newLows).toBe(10);
    });

    it("exactly 5% below high → still counted as nearHigh", async () => {
      // 252 bars: max = 100 at start, current = 95 → 95 >= 100*0.95 → near high
      const prices = [100, ...Array.from({ length: 251 }, () => 95)];
      setAllPrices(prices);
      const m = await callFetchBreadth();
      expect(m.newHighs).toBe(10);
    });

    it("6% below high → NOT nearHigh", async () => {
      // Max = 100, current = 94 → 94 < 100*0.95=95 → not near high
      const prices = [100, ...Array.from({ length: 251 }, () => 94)];
      setAllPrices(prices);
      const m = await callFetchBreadth();
      expect(m.newHighs).toBe(0);
    });

    it("exactly 5% above low → still counted as nearLow", async () => {
      // Min = 100 at start, current = 105 → 105 <= 100*1.05 → near low
      const prices = [100, ...Array.from({ length: 251 }, () => 105)];
      setAllPrices(prices);
      const m = await callFetchBreadth();
      expect(m.newLows).toBe(10);
    });

    it("6% above low → NOT nearLow", async () => {
      // Min = 100, current = 106 → 106 > 100*1.05=105 → not near low
      const prices = [100, ...Array.from({ length: 251 }, () => 106)];
      setAllPrices(prices);
      const m = await callFetchBreadth();
      expect(m.newLows).toBe(0);
    });
  });

  // ─── 4% Burst ratio tests ───

  describe("4% burst ratio", () => {
    it("flat prices → no burst days, ratio = 1 (fallback)", async () => {
      setAllPrices(FLAT_300);
      const m = await callFetchBreadth();
      expect(m.burstBreakouts).toBe(0);
      expect(m.burstBreakdowns).toBe(0);
      expect(m.burstRatio10d).toBe(1);
      expect(m.burstBreakouts5d).toBe(0);
      expect(m.burstBreakdowns5d).toBe(0);
      expect(m.burstRatio5d).toBe(1);
    });

    it("known burst pattern → correct breakout/breakdown counts for 10d and 5d", async () => {
      // makeBurstPrices: moves = [+5%, -5%, +5%, -5%, +5%, +5%, +5%, -5%, +5%, -5%]
      // 10d: 6 breakouts, 4 breakdowns → ratio = 1.5
      // 5d (last 5 moves: +5%, +5%, -5%, +5%, -5%): 3 breakouts, 2 breakdowns → ratio = 1.5
      setAllPrices(makeBurstPrices());
      const m = await callFetchBreadth();
      expect(m.burstBreakouts).toBe(60); // 6 per stock × 10 stocks
      expect(m.burstBreakdowns).toBe(40); // 4 per stock × 10 stocks
      expect(m.burstRatio10d).toBe(1.5);
      expect(m.burstBreakouts5d).toBe(30); // 3 per stock × 10 stocks
      expect(m.burstBreakdowns5d).toBe(20); // 2 per stock × 10 stocks
      expect(m.burstRatio5d).toBe(1.5);
    });

    it("all breakouts, no breakdowns → ratio = 10 (capped)", async () => {
      // 290 flat + 10 days of +5% each
      const prices = Array.from({ length: 290 }, () => 100);
      let p = 100;
      for (let i = 0; i < 10; i++) {
        p = +(p * 1.05).toFixed(4);
        prices.push(p);
      }
      setAllPrices(prices);
      const m = await callFetchBreadth();
      expect(m.burstBreakouts).toBe(100); // 10 per stock × 10 stocks
      expect(m.burstBreakdowns).toBe(0);
      expect(m.burstRatio10d).toBe(10);
    });

    it("exactly +4% move counts as breakout", async () => {
      // 290 flat + day that moves exactly +4%
      const prices = Array.from({ length: 299 }, () => 100);
      prices.push(104); // 4/100 = 0.04 = exactly 4%
      setAllPrices(prices);
      const m = await callFetchBreadth();
      expect(m.burstBreakouts).toBe(10); // 1 per stock × 10
    });

    it("+3.99% does NOT count as breakout", async () => {
      const prices = Array.from({ length: 299 }, () => 100);
      prices.push(103.99); // 3.99/100 = 0.0399 < 0.04
      setAllPrices(prices);
      const m = await callFetchBreadth();
      expect(m.burstBreakouts).toBe(0);
    });
  });

  // ─── Quarterly breadth tests ───

  describe("quarterly breadth", () => {
    it("stock up 30% in 65 days → quarterlyUp25 counted", async () => {
      setAllPrices(makeQuarterlySurge());
      const m = await callFetchBreadth();
      expect(m.quarterlyUp25).toBe(10);
      expect(m.quarterlyDown25).toBe(0);
      expect(m.quarterlyBreadthNet).toBe(10);
    });

    it("stock down 30% in 65 days → quarterlyDown25 counted", async () => {
      setAllPrices(makeQuarterlyCrash());
      const m = await callFetchBreadth();
      expect(m.quarterlyUp25).toBe(0);
      expect(m.quarterlyDown25).toBe(10);
      expect(m.quarterlyBreadthNet).toBe(-10);
    });

    it("exactly +25% → counted as quarterlyUp25", async () => {
      // 235 flat at 100 + 65 bars ending at 125 → (125-100)/100 = 0.25
      const flat = Array.from({ length: 235 }, () => 100);
      const climb = linearPrices(100, 125, 65);
      setAllPrices([...flat, ...climb]);
      const m = await callFetchBreadth();
      expect(m.quarterlyUp25).toBe(10);
    });

    it("+24.9% → NOT counted", async () => {
      const flat = Array.from({ length: 235 }, () => 100);
      const climb = linearPrices(100, 124.9, 65);
      setAllPrices([...flat, ...climb]);
      const m = await callFetchBreadth();
      expect(m.quarterlyUp25).toBe(0);
    });

    it("not enough history (< 66 bars) → quarterly not computed", async () => {
      // 50 bars — enough for totalStocks but not for quarterly
      const short50 = linearPrices(100, 120, 50);
      setAllPrices(short50);
      const m = await callFetchBreadth();
      expect(m.totalStocks).toBe(10);
      expect(m.quarterlyUp25).toBe(0);
      expect(m.quarterlyDown25).toBe(0);
    });
  });

  // ─── 10% Study tests ───

  describe("10% study (5-day momentum)", () => {
    it("stock up 25% in 5 days → momentum20dUp counted", async () => {
      setAllPrices(make5daySurge());
      const m = await callFetchBreadth();
      expect(m.momentum20dUp).toBe(10);
      expect(m.momentum20dDown).toBe(0);
    });

    it("stock down 25% in 5 days → momentum20dDown counted", async () => {
      setAllPrices(make5dayCrash());
      const m = await callFetchBreadth();
      expect(m.momentum20dUp).toBe(0);
      expect(m.momentum20dDown).toBe(10);
    });

    it("exactly +10% → counted", async () => {
      const flat = Array.from({ length: 295 }, () => 100);
      const climb = linearPrices(100, 110, 5);
      setAllPrices([...flat, ...climb]);
      const m = await callFetchBreadth();
      expect(m.momentum20dUp).toBe(10);
    });

    it("+9.9% → NOT counted", async () => {
      const flat = Array.from({ length: 295 }, () => 100);
      const climb = linearPrices(100, 109.9, 5);
      setAllPrices([...flat, ...climb]);
      const m = await callFetchBreadth();
      expect(m.momentum20dUp).toBe(0);
    });

    it("flat prices → LOW_ACTIVITY state", async () => {
      setAllPrices(FLAT_300);
      const m = await callFetchBreadth();
      expect(m.momentum20dState).toBe("LOW_ACTIVITY");
    });

    it("FROTHY when >= 8% of stocks up 10%+", async () => {
      // All 10 stocks up 25% in 5d → 100% > 8% threshold → FROTHY
      setAllPrices(make5daySurge());
      const m = await callFetchBreadth();
      expect(m.momentum20dState).toBe("FROTHY");
    });

    it("CAPITULATION when >= 5% of stocks down 10%+", async () => {
      setAllPrices(make5dayCrash());
      const m = await callFetchBreadth();
      expect(m.momentum20dState).toBe("CAPITULATION");
    });

    it("not enough history (< 6 bars) → not computed", async () => {
      const short = linearPrices(100, 110, 5); // only 5 bars
      setAllPrices(short);
      const m = await callFetchBreadth();
      // Too short for 10% study threshold → excluded from totalStocks
      expect(m.momentum20dUp).toBe(0);
      expect(m.momentum20dDown).toBe(0);
    });
  });

  // ─── Monthly breadth tests ───

  describe("monthly breadth (22-day)", () => {
    it("stock up 30% in 22 days → monthlyUp25 counted", async () => {
      setAllPrices(makeMonthlySurge());
      const m = await callFetchBreadth();
      expect(m.monthlyUp25).toBe(10);
      expect(m.monthlyDown25).toBe(0);
      expect(m.monthlyBreadthNet).toBe(10);
    });

    it("stock down 30% in 22 days → monthlyDown25 counted", async () => {
      setAllPrices(makeMonthlyCrash());
      const m = await callFetchBreadth();
      expect(m.monthlyUp25).toBe(0);
      expect(m.monthlyDown25).toBe(10);
      expect(m.monthlyBreadthNet).toBe(-10);
    });

    it("exactly +25% in 22 days → counted", async () => {
      const flat = Array.from({ length: 278 }, () => 100);
      const climb = linearPrices(100, 125, 22);
      setAllPrices([...flat, ...climb]);
      const m = await callFetchBreadth();
      expect(m.monthlyUp25).toBe(10);
    });

    it("+24.9% in 22 days → NOT counted", async () => {
      const flat = Array.from({ length: 278 }, () => 100);
      const climb = linearPrices(100, 124.9, 22);
      setAllPrices([...flat, ...climb]);
      const m = await callFetchBreadth();
      expect(m.monthlyUp25).toBe(0);
    });

    it("not enough history (< 23 bars) → monthly not computed", async () => {
      const short22 = linearPrices(100, 120, 22);
      setAllPrices(short22);
      const m = await callFetchBreadth();
      expect(m.totalStocks).toBe(10);
      expect(m.monthlyUp25).toBe(0);
      expect(m.monthlyDown25).toBe(0);
    });
  });

  // ─── isOversold flag ───

  describe("isOversold", () => {
    it("pctAbove50d < 25 → isOversold = true", async () => {
      setAllPrices(DOWNTREND_300);
      const m = await callFetchBreadth();
      expect(m.pctAbove50d).toBe(0);
      expect(m.isOversold).toBe(true);
    });

    it("pctAbove50d >= 25 → isOversold = false", async () => {
      setAllPrices(UPTREND_300);
      const m = await callFetchBreadth();
      expect(m.isOversold).toBe(false);
    });
  });

  // ─── Edge cases ───

  describe("edge cases", () => {
    it("all fetches fail → totalStocks = 0, all percentages = 0", async () => {
      mockChart.mockRejectedValue(new Error("Network error"));
      const m = await callFetchBreadth();
      expect(m.totalStocks).toBe(0);
      expect(m.pctAbove50d).toBe(0);
      expect(m.pctAbove200d).toBe(0);
      expect(m.advancing).toBe(0);
      expect(m.declining).toBe(0);
    });

    it("some fetches fail, others succeed → partial results", async () => {
      let callCount = 0;
      mockChart.mockImplementation(async () => {
        callCount++;
        if (callCount <= 5) {
          return { quotes: UPTREND_300.map((c) => ({ close: c, date: new Date() })) };
        }
        throw new Error("fail");
      });
      const m = await callFetchBreadth();
      expect(m.totalStocks).toBe(5);
    });

    it("advancing + declining + unchanged = totalStocks", async () => {
      const prices: Record<string, number[]> = {};
      for (let i = 0; i < 4; i++) prices[TEST_SYMBOLS[i]] = UPTREND_300;
      for (let i = 4; i < 7; i++) prices[TEST_SYMBOLS[i]] = DOWNTREND_300;
      for (let i = 7; i < 10; i++) prices[TEST_SYMBOLS[i]] = FLAT_300;
      setMockPrices(prices);
      const m = await callFetchBreadth();
      expect(m.advancing + m.declining + m.unchanged).toBe(m.totalStocks);
    });

    it("lastUpdated is a valid ISO timestamp", async () => {
      setAllPrices(UPTREND_300);
      const m = await callFetchBreadth();
      expect(new Date(m.lastUpdated).toISOString()).toBe(m.lastUpdated);
    });
  });
});
