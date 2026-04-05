/**
 * Tooltip descriptions for every indicator label in the dashboard.
 * Keys must match the `detail.label` strings sent by the server.
 */

interface TooltipEntry {
  title?: string;
  text: string;
}

export const tooltipContent: Record<string, TooltipEntry> = {
  // ── Volatility ──
  "VIX Level": {
    title: "Fear Gauge",
    text: "Expected S&P 500 volatility over 30 days from options pricing. Low (<15) = calm, tighter setups work. Elevated (20\u201325) = widen stops, reduce size. Extreme (>30) = cash or hedged only.",
  },
  "VIX 1Y Percentile": {
    title: "VIX Percentile Rank",
    text: "Where current VIX ranks vs the past year. Below 25th percentile = complacent, breakouts follow through. Above 75th = stressed, use smaller positions.",
  },
  "Term Structure": {
    title: "VIX Term Structure",
    text: "VIX / VIX3M ratio. Below 0.9 = contango (normal, breakouts work). Above 1.0 = backwardation (panic, institutions hedging \u2014 breakouts fail, wait for reversal).",
  },
  "VVIX": {
    title: "Volatility of Volatility",
    text: "The \u201Cfear of fear\u201D index. Spikes above 120 signal dealer hedging stress. Falling VVIX after a spike = calming, supports re-entry.",
  },
  "VIX Trend": {
    title: "VIX Direction",
    text: "5-day direction of VIX. Rising = deteriorating conditions, tighten stops. Falling = improving, lean into setups.",
  },

  // ── Trend ──
  "SPY vs 20d MA": {
    title: "Short-Term Trend",
    text: "SPY distance from its 20-day moving average. Above = bullish momentum. Below = short-term weakness, breakouts less reliable.",
  },
  "SPY vs 50d MA": {
    title: "Intermediate Trend",
    text: "The swing trader\u2019s key level. Above 50d MA = healthy intermediate trend, full position sizing. Below = reduce exposure.",
  },
  "SPY vs 200d MA": {
    title: "Long-Term Trend",
    text: "The bull/bear dividing line. Below 200d MA = structural bear market, capital preservation mode.",
  },
  "QQQ vs 50d MA": {
    title: "Tech Leadership",
    text: "Tech/growth leadership confirmation. If QQQ lags while SPY holds, growth breakouts are less reliable \u2014 signals sector rotation.",
  },
  "Regime": {
    title: "Market Regime",
    text: "Classification based on moving average signals. UPTREND = press risk, full size. CHOP = half size, A+ setups only. DOWNTREND = preserve capital.",
  },

  // ── Breadth ──
  "% > 50d MA": {
    title: "50-Day Breadth",
    text: "Percentage of S&P 500 above 50-day MA. The single most important breadth reading. >70% = healthy, breakouts work. <50% = thinning. <25% = extreme oversold, watch for reflex bounce.",
  },
  "% > 200d MA": {
    title: "Structural Breadth",
    text: "Percentage above 200-day MA. Structural market health. Below 50% = bear market breadth even if index prices look okay.",
  },
  "% > 20d MA": {
    title: "Short-Term Breadth",
    text: "Percentage above 20-day MA. Fast-moving short-term participation gauge. Useful for timing entries within the broader trend.",
  },
  "NYSE A/D": {
    title: "Advance / Decline",
    text: "Ratio of stocks rising vs falling. >2.0 = strong buying pressure. <0.5 = broad selling. Persistent divergence from the index = early warning sign.",
  },
  "NAS Highs/Lows": {
    title: "New Highs vs Lows",
    text: "New 52-week highs vs lows. Expanding highs confirm a breakout environment. Rising lows during a rally = hidden deterioration underneath.",
  },
  "4% Burst (10d)": {
    title: "Range Expansion",
    text: "Ratio of stocks with +4% daily moves vs \u22124% moves. Measures institutional range expansion. >1.5 = buyers dominating. <0.8 = sellers in control. Toggle 5D/10D for shorter vs longer lookback.",
  },
  "10% Study": {
    title: "Momentum Oscillator",
    text: "S&P 500 stocks that moved 10%+ in 5 days. Frothy (high readings) = buyers exhausted, expect pullback in 3\u20135 days. Capitulation (low readings) = selling exhausted, deep buyers step in. Threshold adjusted from 20% to 10% for large-caps which rarely make 20% moves.",
  },
  "Qtrly Breadth": {
    title: "Quarterly / Monthly Breadth",
    text: "Net count of stocks with 25%+ moves. QTR (65-day) is the primary direction signal \u2014 when stocks down 25% exceed those up 25%, it\u2019s a sustained bear market. MTH (22-day) shows shorter-term money flow shifts.",
  },

  // ── Breadth fallback (sector-based estimate) ──
  "Sectors Advancing": {
    title: "Sector Participation",
    text: "How many of the 11 S&P sectors are advancing today. Broad participation (8+) supports breakout follow-through. Narrow (<4) = selective, reduce exposure.",
  },
  "A/D Ratio": {
    title: "Advance / Decline",
    text: "Ratio of stocks rising vs falling. >2.0 = strong buying pressure. <0.5 = broad selling. Persistent divergence from the index = early warning sign.",
  },

  // ── Momentum ──
  "25d Leaders": {
    title: "Sector Leaders",
    text: "Top 2 sectors by 25-day relative strength vs SPY. Shows where institutional money is flowing. Cyclical leaders (Tech, Discretionary) = risk-on. Defensive leaders (Utilities, Staples) = risk-off.",
  },
  "25d Laggards": {
    title: "Sector Laggards",
    text: "Bottom 2 sectors by relative strength. Avoid breakout setups in lagging sectors \u2014 they lack institutional support and follow-through.",
  },
  "Beating SPY": {
    title: "Sector Participation",
    text: "How many of 11 sectors outperform SPY over 25 days. 7+/11 = broad participation, press risk. <4/11 = narrow market, only trade leading sectors.",
  },
  "Rotation": {
    title: "Sector Rotation",
    text: "Risk-On vs Risk-Off vs Mixed. Based on whether cyclical or defensive sectors lead. Risk-On = growth/momentum setups work. Risk-Off = defensive posture, avoid aggressive longs.",
  },

  // ── Momentum fallback (daily) ──
  "Sectors +": {
    title: "Daily Sectors Positive",
    text: "How many of the 11 S&P sectors are green today. Broad participation (8+) = healthy buying. Narrow (<4) = selective market, tread carefully.",
  },
  "Leader": {
    title: "Today\u2019s Leader",
    text: "The top-performing sector today. Watch if it\u2019s cyclical (risk-on signal) or defensive (risk-off signal) to gauge market character.",
  },
  "Laggard": {
    title: "Today\u2019s Laggard",
    text: "The worst-performing sector today. Persistent laggards over multiple days signal institutional rotation away from that sector.",
  },
  "Participation": {
    title: "Market Participation",
    text: "Broad / Moderate / Narrow classification. Broad = most sectors advancing, breakouts work. Narrow = only a few sectors driving the index, be selective.",
  },

  // ── Macro ──
  "10Y Yield": {
    title: "10-Year Treasury",
    text: "US 10-year Treasury yield. Rising yields pressure growth stocks and rate-sensitive sectors. Rapid moves (>20bps/week) create headwinds regardless of direction.",
  },
  "Yield Trend": {
    title: "Yield Direction",
    text: "5-day direction of the 10-year yield. Rising = tightening financial conditions. Falling = easing, supportive for equities.",
  },
  "DXY": {
    title: "US Dollar Index",
    text: "Strengthening dollar pressures multinationals and emerging markets. Weakening dollar supports commodity stocks and exporters.",
  },
  "Fed Stance": {
    title: "Fed Policy Estimate",
    text: "Estimated from yield level and trend. Hawkish = headwind for risk assets. Dovish = tailwind. Direction of change matters more than absolute level.",
  },
};
