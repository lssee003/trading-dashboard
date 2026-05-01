# Technical Reference: Market Quality Indicators

This document explains every indicator used by the Trading Dashboard, how each is calculated, and how they combine into the final **Market Quality Score** and **Trade Decision**.

---

## Architecture Overview

```
Yahoo Finance API (yahoo-finance2)              Google Sheets (public CSV + XLSX)
        │                                                │
        ├── Real-time quotes: SPY, QQQ, VIX,            ├── 4% burst ratio (5d, 10d)
        │   DXY, TNX, 11 sector ETFs                    ├── Quarterly breadth (up/down 25%)
        ├── Historical prices: SPY (300d),               ├── Monthly breadth (display only)
        │   QQQ (100d), VIX (380d), TNX/DXY (30d)      └── Full breadth table (Market Breadth tab)
        ├── 10-day Relative Strength: 11 ETFs vs SPY
        └── S&P 500 breadth: 502 stocks × 400d closes
                │                                                │
                └───────────────────┬─────────────────────────────┘
                                    │
                        ┌───────────┴────────────────────────────────────┐
                        │                  5 Scoring Categories          │
                        ├────────────┬────────────┬──────────┬──────────┬┤
                        │ Volatility │ Momentum   │  Trend   │ Breadth  ││ Macro
                        │   (20%)    │   (20%)    │  (20%)   │  (30%)   ││ (10%)
                        └────────────┴────────────┴──────────┴──────────┴┘
                                    │
                        Market Quality Score (0–100)
                                    │
                        Trade Decision: YES / CAUTION / NO
```

---

## Data Sources

### Yahoo Finance (via yahoo-finance2)

| Symbol | What it represents | Used for |
|--------|--------------------|----------|
| `SPY` | S&P 500 ETF | Trend scoring (price vs 20/50/200d MA) |
| `QQQ` | Nasdaq 100 ETF | Trend scoring (price vs 50d MA) |
| `^VIX` | CBOE Volatility Index (spot) | Volatility scoring |
| `^VIX3M` | CBOE 3-Month Volatility Index | Term structure scoring |
| `^VIX9D` | CBOE 9-Day Volatility Index | Acute panic detection |
| `^VVIX` | CBOE VIX-of-VIX | Vol-of-vol scoring |
| `^TNX` | 10-Year Treasury Yield | Macro scoring |
| `DX-Y.NYB` | US Dollar Index (DXY) | Macro scoring |
| `XLK, XLF, XLE...` | 11 SPDR sector ETFs | Momentum scoring (daily fallback) |
| 11 equal-weight sector ETFs | RS sector proxies | Momentum scoring (10d RS, preferred) |
| 502 S&P 500 stocks | Individual constituents | Breadth computation |

All price data uses **raw close** (not adjusted close) to avoid dividend-adjustment distortions in MA calculations.

### Google Sheets (primary breadth source)

A publicly readable Google Sheet exports data via CSV (values) and XLSX (for color extraction). Fetched in parallel; values parsed from CSV, cell colors from the XLSX ZIP.

| Column | Description | Used for |
|--------|-------------|----------|
| Stocks up 4%+ today | Single-day breakout count | Display alongside ratio |
| Stocks down 4%+ today | Single-day breakdown count | Display alongside ratio |
| 5-day ratio | Sheet's precomputed 5-day burst ratio | 4% Burst 5D display + scoring |
| 10-day ratio | Sheet's precomputed 10-day burst ratio | 4% Burst 10D scoring |
| Up 25% quarterly | Stocks up ≥25% over 65 days | Quarterly breadth scoring |
| Down 25% quarterly | Stocks down ≥25% over 65 days | Quarterly breadth scoring |
| Up/Down 25% monthly | Stocks up/down ≥25% over 22 days | Display only (not scored) |

Sheets data takes **priority** over S&P 500-derived breadth for burst and quarterly metrics. Falls back to Yahoo Finance-derived values if the sheet fetch fails.

---

## 1. Volatility (20% weight)

Measures fear, uncertainty, and forward volatility using the VIX term structure and VVIX. Designed to time fear peaks and complacency for swing trading entries/exits.

### Sub-components (5 scored indicators)

#### 1a. VIX Level (-25 to +20 pts)
The current value of the CBOE Volatility Index.

| VIX Range | Classification | Score Impact |
|-----------|---------------|--------------|
| < 15 | Low | +20 |
| 15–20 | Normal | +12 |
| 20–25 | Elevated | +3 |
| 25–30 | High | -10 |
| > 30 | Extreme | -25 |

#### 1b. VIX Trend / 5-day slope (-8 to +8 pts)
Linear regression slope over 5 trading days. Falling VIX = bullish.

| Slope | Score Impact |
|-------|--------------|
| < -0.5 | +8 |
| -0.5 to 0 | +4 |
| 0 to 0.5 | -2 |
| > 0.5 | -8 |

#### 1c. Term Structure: VIX/VIX3M (-12 to +12 pts)
Ratio of spot VIX to 3-month VIX.

- **Contango** (ratio < 1.0): Normal market — short-term fear lower than long-term baseline
- **Backwardation** (ratio > 1.0): Panic — short-term fear exceeds long-term, signals fear peak

| VIX/VIX3M Ratio | Classification | Score Impact | Swing Signal |
|-----------------|---------------|--------------|--------------|
| < 0.85 | Steep Contango | +8 | Calm (complacency risk) |
| 0.85–0.95 | Contango | +12 | Sweet spot |
| 0.95–1.0 | Mild Contango | +2 | Transitioning |
| 1.0–1.05 | Flat/Inverting | -6 | Fear building |
| > 1.05 | Backwardation | -12 | Panic (contrarian buy setup) |

#### 1d. VVIX — Volatility of Volatility (-8 to +8 pts)
The "fear of fear" index. High VVIX = options on VIX are expensive = hedging frenzy.

| VVIX Level | Classification | Score Impact |
|------------|---------------|--------------|
| < 80 | Calm | +8 |
| 80–100 | Normal | +2 |
| 100–120 | Elevated | -5 |
| > 120 | Extreme | -8 |

#### 1e. VIX9D Acute Panic (-5 to +5 pts)
Ratio of 9-day VIX to spot VIX. Detects short-term (1-3 day) panic spikes.

| VIX9D/VIX | Score Impact |
|-----------|--------------|
| > 1.1 | -5 (acute spike) |
| 1.0–1.1 | -2 |
| 0.9–1.0 | +2 |
| < 0.9 | +5 (short-term calm) |

### Display-only (not scored)

#### VIX 1-Year Percentile
Where the current VIX sits relative to its values over the past year (380 trading days).

| Percentile | Signal |
|------------|--------|
| < 40th | Bullish (low relative fear) |
| 40th–70th | Neutral |
| > 70th | Bearish (high relative fear) |

**Base score: 50. Final score clamped to [0, 100].**

---

## 2. Momentum (20% weight)

Measures sector rotation strength and breadth of participation using 10-day relative strength (RS) analysis across 11 S&P sector ETFs. Falls back to daily sector performance when RS data is unavailable.

### Preferred Mode: 10-Day Relative Strength

Uses equal-weight sector ETFs to compute 10-day RS vs SPY benchmark (2 calendar weeks). This shorter window captures who is leading the current move rather than being anchored to older market regimes.

#### RS Participation: How many sectors beat SPY (-20 to +25 pts)

| Sectors Outperforming | Score Impact |
|----------------------|--------------|
| >= 7 | +25 |
| 5–6 | +12 |
| 3–4 | 0 |
| 1–2 | -12 |
| 0 | -20 |

#### Top RS Strength (-5 to +10 pts)
Average RS ratio of top 2 sectors.

| Top 2 Avg RS | Score Impact |
|-------------|--------------|
| > 1.08 | +10 |
| 1.03–1.08 | +5 |
| < 1.03 | -5 |

#### Bottom RS Weakness (-10 to +5 pts)
Average RS ratio of bottom 2 sectors.

| Bottom 2 Avg RS | Score Impact |
|-----------------|--------------|
| > 0.97 | +5 |
| 0.92–0.97 | 0 |
| < 0.92 | -10 |

#### Rotation Type (-10 to +10 pts)
Based on average rank of cyclical vs defensive sectors:

| Condition | Type | Score Impact |
|-----------|------|--------------|
| Cyclicals rank higher by > 1.5 | Risk-On | +10 |
| Defensives rank higher by > 1.5 | Risk-Off | -10 |
| Otherwise | Mixed | 0 |

**Cyclical sectors:** XLK, XLY, XLF, XLI, XLB, XLC, XLE
**Defensive sectors:** XLP, XLU, XLV, XLRE

### Fallback Mode: Daily Sector Performance

When RS data is unavailable, scoring uses daily % change of 11 sector ETFs.

#### Top/Bottom 3 Performance
| Condition | Score Impact |
|-----------|--------------|
| Top 3 avg > +1% | +15 |
| Top 3 avg > 0% | +5 |
| Top 3 avg < 0% | -15 |
| Bottom 3 avg > -0.5% | +10 |
| Bottom 3 avg < -1.5% | -10 |

#### Participation
| Sectors Positive | Classification |
|-----------------|----------------|
| >= 8 | Broad |
| 5–7 | Moderate |
| 2–4 | Narrow |
| 0–1 | Very thin |

**Base score: 50. Final score clamped to [0, 100].**

---

## 3. Trend (20% weight)

Measures market structure by comparing index prices to their moving averages.

### Indicators

#### SPY vs Moving Averages
Each MA crossover is scored independently.

| Condition | Score Impact |
|-----------|--------------|
| SPY > 20d SMA | +12 |
| SPY < 20d SMA | -12 |
| SPY > 50d SMA | +12 |
| SPY < 50d SMA | -12 |
| SPY > 200d SMA | +12 |
| SPY < 200d SMA | -18 (heavier penalty) |

#### QQQ vs 50d SMA

| Condition | Score Impact |
|-----------|--------------|
| QQQ > 50d SMA | +10 |
| QQQ < 50d SMA | -10 |

#### SMA Calculation
Simple Moving Average computed from the last N closing prices:

```
SMA(period) = sum(last N closes) / N
```

Historical data requested: SPY gets 300 calendar days (~200 trading days) to support SMA(200).

#### Regime Classification
Derived from the number of bullish/bearish MA signals (4 total checks):

| Bullish Signals | Regime |
|----------------|--------|
| >= 3 | UPTREND |
| <= 1 (bearish >= 3) | DOWNTREND |
| Otherwise | CHOP |

**Display values** show the percentage distance from each MA:
```
distance = ((price / SMA) - 1) × 100%
```

**Base score: 50. Final score clamped to [0, 100].**

---

## 4. Breadth (30% weight)

Measures the internal health of the market by analyzing all 502 S&P 500 constituents individually. The most heavily weighted category because broad participation is the #1 predictor of breakout follow-through. All metrics are computed from **raw closing prices** fetched via `yahoo-finance2`.

### Data Pipeline
1. Fetch ~400 calendar days of daily closes for all 502 stocks
2. Fetched in parallel batches of 50 (concurrency-controlled)
3. Stocks with < 20 bars of data are excluded
4. Results cached for 4 hours with a concurrency guard

### Indicators

#### % Above 20d / 50d / 200d MA
For each stock, compute the SMA and check if the current price is above it.

```
pctAboveXXd = round((count where close > SMA(XX)) / totalStocks × 100)
```

**Scoring (based on 50d MA — primary breadth gauge):**

| % Above 50d | Score Impact |
|-------------|--------------|
| > 70% | +25 |
| 50–70% | +10 |
| 30–50% | -5 |
| < 30% | -20 |

**Scoring (based on 200d MA — structural health):**

| % Above 200d | Score Impact |
|--------------|--------------|
| > 60% | +10 |
| 40–60% | 0 |
| < 40% | -10 |

#### Advance/Decline Ratio
Computed from the last two closing prices for each stock.

```
changePct = ((close[t] - close[t-1]) / close[t-1]) × 100

if changePct > +0.05% → advancing
if changePct < -0.05% → declining
otherwise → unchanged

A/D Ratio = advancing / declining
```

The 0.05% threshold filters noise from rounding/float precision.

| A/D Ratio | Score Impact |
|-----------|--------------|
| > 2.0 | +5 |
| 0.5–2.0 | 0 |
| < 0.5 | -10 |

#### 52-Week Highs / Lows
Computed from the last 252 closing prices (not Yahoo's intraday-based quote fields):

```
yearHigh = max(last 252 closes)
yearLow  = min(last 252 closes)

Near high: currentPrice >= yearHigh × 0.95 (within 5%)
Near low:  currentPrice <= yearLow  × 1.05 (within 5%)
```

| Condition | Score Impact |
|-----------|--------------|
| newLows > newHighs × 3 | -10 |
| newHighs > newLows × 3 | +5 |

#### 4% Burst Ratio (5-day / 10-day)
Measures conviction by counting stocks with ≥4% single-day moves. Sourced directly from Google Sheets precomputed ratio columns — the sheet maintains its own rolling burst calculation. The breakout/breakdown counts shown in the UI are today's single-day values.

**Data source priority:** Google Sheets (preferred) → S&P 500-derived rolling sum (fallback)

When falling back to Yahoo Finance data:
```
For each stock, for each of the last 10 days:
  dayChange = (close[d] - close[d-1]) / close[d-1]
  if dayChange >= +0.04 → totalBreakouts++
  if dayChange <= -0.04 → totalBreakdowns++

burstRatio = totalBreakouts / totalBreakdowns
```

**Scoring (based on 10-day ratio — thresholds match Market Breadth conditional formatting):**

| Burst Ratio | Score Impact | CF Color | Interpretation |
|-------------|--------------|----------|----------------|
| > 2.0 | +15 | Bright green | Breakouts dominating |
| 0.5–2.0 | 0 | — | Neutral |
| ≤ 0.5 | -15 | Red | Breakdowns dominating |

**UI:** 5D/10D pill toggle switches between windows. Both ratios sent from server; toggle is client-side only. Ratio shown to 2 decimal places (e.g. 2.69x).

#### 10% Study (scored — extreme momentum oscillator)
Tracks stocks that have moved >=10% over the last 5 trading days. Adapted from the original 20% study for S&P 500 large-caps, which rarely make 20% moves in a week. The lower threshold produces meaningful readings across normal and extreme market conditions.

```
price5dAgo = closes[length - 6]
fiveDayReturn = (currentPrice - price5dAgo) / price5dAgo

if fiveDayReturn >= +0.10 → momentum20dUp++
if fiveDayReturn <= -0.10 → momentum20dDown++

percentUp = (momentum20dUp / totalStocks) × 100
percentDown = (momentum20dDown / totalStocks) × 100
```

**Classification & Scoring:**

| Condition | State | Score Impact | Interpretation |
|-----------|-------|--------------|----------------|
| percentUp >= 8% | Frothy | -10 | Exhaustion, reduce long exposure |
| percentDown >= 5% | Capitulation | +15 | Strong bounce signal |
| percentUp <= 1% AND percentDown <= 1% | Low Activity | 0 | No momentum edge |
| Otherwise | Normal | 0 | Neutral |

**UI:** Frothy = red, Capitulation = green (strong highlight), Low Activity = grey, Normal = amber. Display format: `3.2%↑/0.8%↓ Normal →`

#### Quarterly / Monthly Breadth (quarterly scored — primary direction indicator)
Counts stocks with ≥25% gains or losses over a lookback window. Toggleable between quarterly (65 trading days) and monthly (22 trading days) via a MTH/QTR pill button. The quarterly reading is the most critical metric for determining long-term market direction — when stocks down 25% exceed those up 25%, it signals a sustained bear market.

**Data source priority:** Google Sheets (preferred) → S&P 500-derived calculation (fallback)

When falling back to Yahoo Finance data:
```
Quarterly (65 days):
  price65dAgo = closes[length - 66]
  quarterlyReturn = (currentPrice - price65dAgo) / price65dAgo
  if quarterlyReturn >= +0.25 → quarterlyUp25++
  if quarterlyReturn <= -0.25 → quarterlyDown25++

Monthly (22 days):
  price22dAgo = closes[length - 23]
  monthlyReturn = (currentPrice - price22dAgo) / price22dAgo
  if monthlyReturn >= +0.25 → monthlyUp25++
  if monthlyReturn <= -0.25 → monthlyDown25++
```

**Scoring (quarterly only — thresholds match Market Breadth conditional formatting):**

| Condition | Score Impact | CF Color | Interpretation |
|-----------|--------------|----------|----------------|
| up25q > down25q | +10 | Bright green | More stocks up 25% than down |
| up25q = down25q | 0 | — | Neutral |
| up25q < down25q | -15 | Red | More stocks down 25% than up |

**Monthly breadth is display-only — not scored.**

**UI:** MTH/QTR pill toggle switches between windows. Both datasets sent from server; toggle is client-side only. Display format: `+12 ↑52/↓40 ↑`

#### Oversold Alert
Triggers when % above 50d MA drops below 25%. Displayed as a flashing amber dot on the UI.

```
isOversold = pctAbove50d < 25
```

### Fallback: Sector-Based Estimate
When breadth data is unavailable or totalStocks <= 50, the score falls back to sector ETF performance:

```
pctAbove = (sectors with positive daily change / 11) × 100
```

Then scored using the same thresholds as % above 50d MA.

**Base score: 50. Final score clamped to [0, 100].**

---

## 5. Macro (10% weight)

Measures the macro backdrop using interest rates, dollar strength, and Fed policy signals.

### Indicators

#### 10-Year Treasury Yield (^TNX)

| Yield Level | Score Impact |
|-------------|--------------|
| < 3.5% | +10 |
| 3.5–4.5% | +5 |
| 4.5–5.0% | -5 |
| > 5.0% | -15 |

#### Yield Trend (5-day slope)
Linear regression slope of TNX over the last 5 days.

| Slope | Score Impact |
|-------|--------------|
| > +0.05 | -5 (rising yields = headwind) |
| < -0.05 | +5 (falling yields = tailwind) |

#### US Dollar Index (DXY) Trend
Linear regression slope of DXY over the last 5 days.

| Slope | Score Impact |
|-------|--------------|
| > +0.2 | -5 (strong dollar = equity headwind) |
| < -0.2 | +5 (weak dollar = equity tailwind) |

#### Fed Stance (estimated)
Derived from yield level and direction:

| Condition | Stance |
|-----------|--------|
| TNX > 4.5% AND slope > 0 | HAWKISH |
| TNX < 3.5% AND slope < 0 | DOVISH |
| Otherwise | NEUTRAL |

#### FOMC Alerts
Hardcoded 2026 FOMC announcement dates trigger alerts:

| Days Until FOMC | Alert |
|----------------|-------|
| 0 (today) | "FOMC decision TODAY — expect volatility" |
| 1–3 days | "FOMC meeting in N days — position cautiously" |
| 4–7 days | "FOMC meeting next week" |

**Base score: 50. Final score clamped to [0, 100].**

---

## Composite Market Quality Score

Each category produces a score from 0–100 and carries a fixed weight:

```
Market Quality Score = round(
    Volatility × 0.20
  + Momentum   × 0.20
  + Trend      × 0.20
  + Breadth    × 0.30
  + Macro      × 0.10
)
```

### Trade Decision

| Score Range | Decision | Guidance |
|-------------|----------|----------|
| >= 80 | **YES** | Full position sizing with disciplined risk management |
| 60–79 | **CAUTION** | Reduce position sizes, A+ setups only |
| < 60 | **NO** | Preserve capital, wait for conditions to improve |

---

## Terminal Analysis

An AI-generated narrative synthesizing all 5 category signals into a plain-English market assessment. Includes:

- **Regime Signal:** GREEN (uptrend), AMBER (chop), RED (correction/downtrend)
- **Narrative:** 2-3 sentences describing current conditions and key drivers
- **Stance:** Actionable guidance (e.g., "FULL SIZE — press breakouts" or "CASH / SHORT BIAS")
- **Bounce Alert:** Optional alert when multiple oversold signals stack (% > 50d < 25%, capitulation, VIX > 30)

---

## Technical Calculations Reference

### Simple Moving Average (SMA)
```
SMA(N) = sum(close[-N:]) / N
```
Returns `null` if fewer than N data points are available.

### Linear Regression Slope
```
slope = (n·Σ(xi·yi) − Σxi·Σyi) / (n·Σxi² − (Σxi)²)
```
Used for VIX trend (5-day), TNX trend (5-day), and DXY trend (5-day).

---

## Caching Strategy

| Data | Cache TTL | Notes |
|------|-----------|-------|
| Dashboard data | 30 seconds | Quotes + scoring |
| Breadth metrics | 4 hours | 502 stocks, expensive to compute |
| Google Sheets data | 4 hours | Burst ratio + quarterly breadth |

Breadth uses a concurrency guard (`fetchInProgress` flag) to prevent duplicate parallel fetches. If a fetch is already running, stale cache is returned. All three sources (Yahoo Finance quotes, breadth metrics, Google Sheets) are fetched in parallel via `Promise.allSettled` on each dashboard request — a failure in any one source degrades gracefully without blocking the others.

---

## Signal Legend

Each detail row in the UI carries three attributes:

| Attribute | Values | Meaning |
|-----------|--------|---------|
| `signal` | bullish / neutral / bearish | Directional assessment |
| `direction` | up / down / flat | Current movement |
| `oversoldAlert` | true / false | Flashing amber dot (breadth only) |

All indicator labels support hover tooltips with brief explanations of what each indicator means for swing trading.
