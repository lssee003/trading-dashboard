---
target: the homepage
total_score: 27
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T09-54-40Z
slug: client-src-pages-dashboard-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Excellent: live/snapshot indicator, fetching states, seconds-ago counter, animated score gauge |
| 2 | Match System / Real World | 4 | Trader-native terminology throughout |
| 3 | User Control and Freedom | 2 | No keyboard shortcuts, no collapse/expand, no layout customization |
| 4 | Consistency and Standards | 3 | Strong internal consistency; minor accent color inconsistency |
| 5 | Error Prevention | 3 | Good error state with retry |
| 6 | Recognition Rather Than Recall | 3 | Tooltips help; some abbreviations require domain recall |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts, no data export, no customization |
| 8 | Aesthetic and Minimalist Design | 3 | Dense but purposeful; box wall flattens hierarchy |
| 9 | Error Recovery | 3 | Clear error state with retry |
| 10 | Help and Documentation | 1 | Tooltips on some indicators, no help link or docs |
| **Total** | | **27/40** | **Acceptable** |

## Anti-Patterns Verdict

LLM: Not AI-generated looking. Terminal identity is authentic. Signal color discipline held. Cool background avoids warm-neutral trap. Five category panels border on repeated card grid but carry different data.

Detector: 1 finding — layout-transition warning in AppHeader.tsx:114 (max-height animation).

## Priority Issues

### [P2] Box Wall: Five Category Panels Create Visual Monotony
Equal-weight 5-col grid flattens hierarchy. Options: signal tinting on weakest category, remove boxing for table-like read, variable emphasis by weight.

### [P2] Light Mode: Too Washed Out
Extensive opacity-30/40/50 on text. #94A3B8 on #F8FAFC is ~3.3:1 (fails AA). Dark mode doesn't have this problem. Fix: explicit color vars instead of opacity, bump --terminal-dim floor.

### [P2] Dark Mode Border Contrast Borderline
#1E3A5F on #111827 barely perceptible. Either bump to #264466 or drop borders in dark mode.

### [P3] Sector Heatmap Bar Alignment
Bars all grow from left. Diverging chart (positive right, negative left from center) would be more scannable.

## Persona Red Flags

Alex (Power User): No keyboard shortcuts, can't collapse panels, no macro customization.
Sam (Accessibility): opacity-30/40/50 fails contrast, oversold dot is 1.5px target, tooltip has no keyboard access.

## Minor Observations
- Ticker animation missing prefers-reduced-motion
- AppHeader mobile nav uses max-height transition (layout thrash)
- Footer at opacity-30 nearly invisible in light mode
- DashboardSkeleton shimmer is correct loading pattern
