# 5 Stars Setup — Market Dashboard

A real-time market quality dashboard for swing traders. Aggregates 30+ indicators across five categories into a single **Market Quality Score (0–100)** with a clear **YES / CAUTION / NO** trade decision.

## What It Does

Pulls data from Yahoo Finance — S&P 500 breadth (502 stocks), sector ETFs, VIX, Treasury yields, and dollar index — and scores current market conditions across:

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
- **Production:** GitHub Actions (scheduled data refresh) + GitHub Pages (static hosting)

## Getting Started

### Local Development

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:3000` with hot reload. The Express backend fetches live data from Yahoo Finance and serves the React frontend.

### Production (GitHub Pages)

Production runs as a fully static site — no server needed. A GitHub Action fetches market data daily before market open, pre-computes all scores, and deploys to GitHub Pages.

```
GitHub Action (9:15 AM ET, Mon–Fri)
  → Fetch Yahoo Finance data (quotes, breadth, RS)
  → Compute scores → write JSON
  → Build static site → deploy to GitHub Pages

User visits site
  → React app loads
  → Reads pre-computed /data/dashboard.json and /data/rs.json
  → No polling, no server
```

#### Manual refresh

```bash
npm run refresh        # Fetch data and write JSON to client/public/data/
npm run build:static   # Build client-only static site to dist/public/
```

#### Deploy setup

1. Push to GitHub
2. Go to repo **Settings → Pages → Source → GitHub Actions**
3. Manually trigger the "Refresh Market Data & Deploy" workflow, or wait for the next weekday 9:15 AM ET run

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Express + Vite HMR) |
| `npm run build` | Full production build (client + server bundle) |
| `npm start` | Run server production build |
| `npm run refresh` | Fetch market data and write static JSON files |
| `npm run build:static` | Build client-only for GitHub Pages |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Environment

| Variable | Dev | Prod | Effect |
|----------|-----|------|--------|
| `VITE_DATA_MODE` | `api` | `static` | `api`: fetch from Express. `static`: fetch from `/data/*.json`, no polling |

Set via `.env.development` and `.env.production` (read by Vite at build time).

## Features

- **Terminal-style UI** with dark and light themes
- **Auto-refresh** (dev) or daily snapshot (prod)
- **Sector heatmap** showing 11 GICS sectors with daily performance
- **25-day Relative Strength** histogram with rotation analysis
- **AI-generated narrative** summarizing current market regime
- **Bounce alerts** when oversold conditions meet reversal criteria
- **Hover tooltips** on every indicator for educational context

## Documentation

See [INDICATORS.md](./INDICATORS.md) for a full technical reference of every indicator, scoring formula, and how the final score is computed.

## License

MIT
