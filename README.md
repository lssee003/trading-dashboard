# 5 Stars Setup — Market Dashboard

A real-time market quality dashboard for swing traders. Aggregates 30+ indicators across five categories into a single **Market Quality Score (0–100)** with a clear **YES / CAUTION / NO** trade decision.

## What It Does

Pulls live data from Yahoo Finance — S&P 500 breadth (502 stocks), sector ETFs, VIX, Treasury yields, and dollar index — and scores current market conditions across:

| Category | Weight | Key Indicators |
|----------|--------|----------------|
| **Volatility** | 20% | VIX level, VIX vs 20d MA, VIX term structure, intraday range |
| **Momentum** | 20% | 25-day relative strength, sector rotation, RS participation |
| **Trend** | 20% | SPY vs moving averages (8/21/50/200d), QQQ trend, slope |
| **Breadth** | 30% | % above 50d/200d MA, A/D ratio, 52-week highs/lows, 4% burst ratio, 10% study, quarterly breadth |
| **Macro** | 10% | 10Y yield trend, DXY trend, yield/equity divergence |

Each indicator has a hover tooltip explaining what it measures and why it matters.

## Stack

- **Frontend:** React + TypeScript, Tailwind CSS, Recharts, Radix UI
- **Backend:** Express + TypeScript, yahoo-finance2
- **Build:** Vite, tsx
- **Tests:** Vitest

## Getting Started

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:5000` with hot reload.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Features

- **Terminal-style UI** with dark and light themes
- **Auto-refresh** with configurable polling interval
- **Sector heatmap** showing 11 GICS sectors with daily performance
- **25-day Relative Strength** histogram with rotation analysis
- **AI-generated narrative** summarizing current market regime
- **Bounce alerts** when oversold conditions meet reversal criteria
- **Hover tooltips** on every indicator for educational context

## Documentation

See [INDICATORS.md](./INDICATORS.md) for a full technical reference of every indicator, scoring formula, and how the final score is computed.

## License

MIT
