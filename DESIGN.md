---
name: 5 Stars Setup — Market Dashboard
description: A precision market quality terminal for swing traders. One score, one decision.
colors:
  accent: "#1481B8"
  signal-bullish: "#16A34A"
  signal-bearish: "#DC2626"
  signal-neutral: "#D97706"
  signal-cyan: "#0284C7"
  bg-light: "#F1F5F9"
  surface-light: "#FFFFFF"
  surface-alt-light: "#E2E8F0"
  border-light: "#CBD5E1"
  bg-dark: "#0A0F1A"
  surface-dark: "#111B2B"
  surface-alt-dark: "#182336"
  border-dark: "#253D5C"
  text-ink: "#0F172A"
  text-secondary: "#475569"
  text-muted: "#64748B"
  text-faint: "#94A3B8"
  text-primary-dark: "#E2E8F0"
  text-secondary-dark: "#94A3B8"
  text-muted-dark: "#7A8FA5"
  text-faint-dark: "#4D6278"
  gain-chip: "#DCFCE7"
  loss-chip: "#FEE2E2"
  amber-chip: "#FEF3C7"
typography:
  display:
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
  title:
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.06em"
  body:
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.01em"
  label:
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "3px"
  md: "6px"
  lg: "9px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  nav-tab-active:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
  nav-tab-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
  signal-chip-bullish:
    backgroundColor: "{colors.gain-chip}"
    textColor: "{colors.signal-bullish}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  signal-chip-bearish:
    backgroundColor: "{colors.loss-chip}"
    textColor: "{colors.signal-bearish}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  signal-chip-neutral:
    backgroundColor: "{colors.amber-chip}"
    textColor: "{colors.signal-neutral}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  surface-card:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "6px"
---

# Design System: 5 Stars Setup — Market Dashboard

## 1. Overview

**Creative North Star: "The Cockpit Instrument Panel"**

Every gauge has a fixed home. Every reading is where it was yesterday and will be tomorrow. The layout never surprises you — only the data does. This dashboard exists so that a swing trader at 8 AM can read the market's verdict — YES, CAUTION, or NO — before their first coffee is cold. Structure is not a constraint here; it is the product.

The system runs three professional themes that share a single identity. Light mode follows TradingView Professional: cool slate-tinted (#F1F5F9) backgrounds with white card surfaces, controlled blue accents, signal colors at full saturation. Dark mode follows Bloomberg Terminal: deep navy-black (#0A0F1A), richer blue-tinted surfaces (#111B2B), electric signal colors, and clearly defined borders. Glass mode is iOS Liquid Glass over the dark identity: a fixed deep-indigo wallpaper with soft blue-violet light fields, and panels rendered as translucent frosted glass (backdrop blur + saturation boost, hairline white borders, a specular top edge). All themes use JetBrains Mono at every size and weight. Monospace is not a stylistic choice; it is the credential. A proportional font on this dashboard would feel like a retail product.

Design restraint is structural doctrine, not a taste preference. No gradients. No decorative color. No softened corners as a default. The signal colors — green, red, amber — belong exclusively to market signals. Anything decorative competes with meaning and is therefore prohibited. This system rejects both the generic SaaS card-grid aesthetic (Shadcn defaults, cream whites, equally-weighted metric tiles) and the cluttered editorial layout of news-finance sites (MarketWatch, Yahoo Finance). Neither has a decision architecture. This one does.

**Key Characteristics:**
- Monospace throughout — JetBrains Mono at every role, never a second family
- Three professional themes: TradingView light / Bloomberg dark / Liquid Glass, independently WCAG AA compliant
- Three semantic signal colors that map exactly to YES / CAUTION / NO — never used decoratively
- Dense, stable layout — same structure every pre-market session
- Near-zero rounding (3–9px) — no consumer softness
- Elevation through tonal layering and thin borders, not decorative shadow

## 2. Colors: The Signal Palette

The palette is functional, not aesthetic. Each color has one job and is not borrowed for any other purpose.

### Primary

- **Terminal Cyan — the one trusted signal** (`#1481B8`, dark variant `#1AA2E5`): The Bloomberg blue accent. Reserved exclusively for active states (selected tab, primary buttons, focus rings), live-feed indicators, and interactive affordances. Appears on less than 15% of any screen surface. Its restraint is the point — when it appears, something is interactive or selected.

### Signal Colors (Semantic — Never Decorative)

- **Signal Bullish** (`#16A34A` light / `#00E676` dark): YES. Market favorable. Full position sizing. Used on bullish chips, green score bars, the YES decision panel.
- **Signal Bearish** (`#DC2626` light / `#FF1744` dark): NO. Avoid risk. Used on bearish chips, red score bars, the NO decision panel.
- **Signal Neutral** (`#D97706` light / `#FFAB00` dark): CAUTION. Half size, A+ setups only. Used on amber chips, caution score bars, the CAUTION decision panel, oversold alerts.
- **Signal Cyan** (`#0284C7` light / `#00E5FF` dark): Live data indicators, market mode chips, cursor-style elements. Distinct from the primary accent to differentiate data from interaction.

### Neutral — Light Theme (TradingView Professional)

- **Cool Slate** (`#F1F5F9`): Page background. Noticeably tinted blue-gray; white cards pop against it. Not warm, not cream.
- **Terminal White** (`#FFFFFF`): Card and surface background. Pure white for maximum data legibility.
- **Frost** (`#E2E8F0`): Secondary surfaces, alternating rows, hover states.
- **Steel** (`#CBD5E1`): Borders and dividers. Clearly visible, not ghost-thin.
- **Ink** (`#0F172A`): Primary text. Deep navy-black, not neutral gray. ~15:1 contrast.
- **Secondary** (`#475569`): Secondary text, section headings, labels. ~6.5:1 contrast.
- **Muted** (`#64748B`): Tertiary info, timestamps, less important labels. ~4.7:1 contrast (WCAG AA floor).
- **Faint** (`#94A3B8`): Decorative or large bold text only. ~3.3:1 (fails AA for body text).

### Neutral — Dark Theme (Bloomberg Terminal)

- **Terminal Black** (`#0A0F1A`): Page background. Deep navy-black, not charcoal gray.
- **Charcoal** (`#111B2B`): Card and panel surfaces. Richer blue tint than neutral gray.
- **Deep Navy** (`#182336`): Secondary surfaces, hover backgrounds.
- **Navy Border** (`#253D5C`): Borders. Clearly visible blue-tinted lines that define panel edges.
- **Terminal Light** (`#E2E8F0`): Primary text on dark surfaces. ~13:1 contrast.
- **Secondary** (`#94A3B8`): Secondary text. ~6.9:1 contrast.
- **Muted** (`#7A8FA5`): Tertiary info, dim labels. ~5:1 contrast (WCAG AA).
- **Faint** (`#4D6278`): Decorative or large bold text only.

### Neutral — Glass Theme (iOS Liquid Glass)

Glass applies the `.glass` class on top of `.dark`, inheriting the Bloomberg palette (signal colors, text hierarchy) and overriding only the material. It is a manual choice via the theme toggle (cycle: light → dark → glass); auto time-of-day switching only picks light or dark.

- **Wallpaper**: a fully procedural WebGL2 scene (`client/src/background`, mounted by `GlassBackdrop` into the fixed `.liquid-field` layer) — a five-layer rendering engine, no video assets. Layer 1: infinite grid-hashed **starfield** in three depth layers with per-depth pointer parallax and slow drift, sparse and dim (the void stays near black). Layer 2: **volumetric light field** — two whisper-faint fbm-modulated glows anchored where the old CSS wallpaper kept its blue/violet radials (`#3882F6` upper-left, `#7C58FA` upper-right) — plus the **sky lamp**: the visible core of the scene's overhead area light, wandering on the same noise the sculpture's reflections use. Layer 3: fullscreen **glass distortion field** gently refracting the far field with a whisper of chromatic spread. Layer 4: a raymarched **liquid-glass sculpture** right of center — a long low ellipsoid plus three smooth-min lobes on wide flat orbits under a slow domain warp with ridge creases and a ±0.8% noise "breath" (never spherical, reads as a horizontal pour), surfaced as polished black crystal: a *dielectric* (IOR 1.58, F0 ≈ 0.055, 95% black / 5% reflection), so facing surfaces are void-black and reflectivity survives only at grazing angles and under the studio-bright warm↔cool area light drifting overhead on noise (intensity ~80: its reflection blows to white through the 5% Fresnel — that is where the contrast comes from; a crisp core lobe plus a wide halo draws the bright rim line along top silhouettes). Two dim cyan/violet side bands and the live scene texture give the reflections hue. Thin-film iridescence (250–900nm, noise-varied) is palette-steered by a cross-channel mix — green energy pushed into cyan-blue, red folded toward gold, so fringes stay in the deep-blue/indigo/violet/cyan/gold family, never rainbow — confined to grazing angles, washed out where the env blows bright (fringes live in dim reflections only), with a faint self-lit spectral rim tracing contours off the light; accent speculars are Fresnel-weighted so the interior stays black. ~3% transmission ghosts the starfield through edges. Layer 5: **post** — quarter-res bloom (threshold 1.1, blown highlights only), ACES tonemap, near-zero indigo shadow lift (blacks stay ~#000–#050505), vignette, hash dither, and a tent-filtered upscale. Scene+composite passes render at an adaptive internal scale (0.66 → 0.35 ladder on a frame-time EMA, DPR capped 1.5, `powerPreference: low-power`); PostFX upscales, so the raymarch cost stays fixed under frosted panels. Everything is parameterized in `background/config.ts` (colors authored as sRGB, converted once to linear). Reduced motion renders a single composed still; a hidden tab stops the loop; if WebGL2 is missing or the context dies, neutral silver-blue CSS blobs (`.liquid-blob`) take over. The 5% fractal-noise CSS grain stays on top for material tooth. `?theme=glass|dark|light` deep-links a theme (used by headless design QA).
- **Glass panel** (`.glass-panel`, also `.category-panel`): `rgba(12,19,38,0.40)` base under a faint white gradient, `backdrop-filter: blur(22px) saturate(1.7)`, `rgba(255,255,255,0.14)` hairline border, inset specular top edge.
- **Glass chrome** (`.glass-chrome`, ticker strip + app header): denser tint (`rgba(7,11,24,0.62)`) and heavier blur (28px) since live content scrolls beneath.
- **Still glass** (`.glass-still`): glass fill without backdrop-filter, for panels containing `position: fixed` descendants (blur would become their containing block). Used by the RRG chart.
- **Tinted glass** (`.glass-tint`): in light/dark the panel keeps its signal-tinted background; in glass it becomes a NEUTRAL white glass slab (identical for all verdicts: white gradient over `rgba(10,17,34,0.30)`, white border, white inset rim) and the verdict hue is carried by **light, not paint** — the Figma Group 7 construction. `.hero-lights` holds three `plus-lighter` blobs `blur(30px)` drifting on 22–34s transform-only loops (static under reduced motion): the signal hue, an indigo-deepened companion, and a small white specular. Legibility comes from `.hero-verdict`'s dark text halo. The market-quality gauge (`.hero-gauge`) is the full reference stack: dark backing disc (`::before`, `rgba(9,14,28,0.78)` + soft outer ring) → two small hue blobs (`.hero-gauge-lights`, `blur(16px)`) → neutral white glass disc (`::after`, `rgba(255,255,255,0.11)` + Ellipse-18 rim) whose `blur(3px)` frosts the lights beneath. The score numeral goes white in glass (`.hero-score-num`); the arc and verdict label carry the signal hue; `.hero-score-den` brightens "/ 100" over the disc.
- **Opaque islands**: untagged surfaces resolve to opaque `#0E1626` / `#172138`. Only truly frozen UI stays dense: sticky table cells and headers run near-opaque navy (`rgba(10,16,32,0.88–0.92)`) so scrolling data never bleeds through them.
- **Breadth table** (`.breadth-shell`): dense glass shell (`blur(22px)`, white hairline) with a scoped `--terminal-surface: rgba(15,22,42,0.97)` for its sticky header/date column. The heatmap uses a dedicated `THEME_COLORS.glass` / `GROUP_COLORS.glass` palette — translucent rgba tints with brightened text so the wallpaper reads through every cell; sticky group headers layer their tint over the same `0.97` base, plus a specular top inset. Hard-won constraint: **Chromium computes but never paints `backdrop-filter` on table-cell boxes** (verified — rows never frost, even via a `::before` layer), so frozen cells cannot blur what scrolls beneath them; near-opacity is the only way to keep ghosting sub-legible. Even at 0.92 alpha, bright date text reads through; 0.97 is the floor.
- **Event date chip** (`.evt-date-pill`): cyan-lit mini lens (`color-mix` cyan 24% over dark, inset ring, `blur(6px)`), light text — also the fix for invisible dates (the inline text color was `var(--terminal-bg)`, which is transparent in glass).
- **Tooltips** (`.glass-tooltip`, metric explainers + RRG dots): frosted dark lens — white gradient over `rgba(8,13,26,0.72)`, `blur(20px) saturate(1.6)`, white border, specular inset — dense enough to read over any signal color.
- **Alert banner**: shares the hero's neutral slab token and `.hero-lights` construction with amber blobs (`--blob-color: var(--terminal-amber)`).
- **Muted text** runs one step brighter (`#8BA0B6`) to hold ≥4.5:1 over the luminous light fields.
- **Fallback**: `@supports not (backdrop-filter)` swaps glass fills for near-opaque surfaces.

### Chip Backgrounds

- **Gain chip bg** (`#DCFCE7` light / `rgba(0,230,118,0.12)` dark): Tinted background for bullish chips. Never solid signal fill.
- **Loss chip bg** (`#FEE2E2` light / `rgba(255,23,68,0.12)` dark): Tinted background for bearish chips.
- **Neutral chip bg** (`#FEF3C7` light / `rgba(255,171,0,0.12)` dark): Tinted background for caution chips.

### Named Rules

**The One Signal Rule.** Green, red, and amber are market signals. They are never used as brand color, button color, or decorative accent. When green appears on this dashboard, it means bullish. Always. No exceptions.

**The Restraint Rule.** The accent (`{colors.accent}`) covers ≤15% of any screen. Navigation tabs, focus rings, live-indicator dots. Its scarcity makes it an affordance marker, not a color scheme.

**The Cool Neutrals Rule.** Light mode backgrounds are cool-tinted, never warm. Cool Slate (#F1F5F9) has a deliberate blue lean. If a background reads as cream, sand, or warm-white, it is wrong.

**The No-Opacity Rule.** Text dimming uses explicit semantic color variables (`--text-secondary`, `--text-muted`, `--text-faint`), never Tailwind `opacity-XX` classes. Opacity creates unpredictable contrast across themes and fails WCAG verification. Every text level must meet 4.5:1 AA minimum, except `--text-faint` which is reserved for decorative or large bold text only.

## 3. Typography

**Every role: JetBrains Mono** (fallback: Fira Code → Consolas → monospace)

A single-family system. No display/body pairing, no serif contrast, no humanist sans for "friendlier" sections. JetBrains Mono at every weight and size. This is not a limitation — it is the system's core identity. Hierarchy comes from size, weight, and letter-spacing contrast, not from font switching.

**Character:** Precise, clinical. Every character earns its width. Numbers are `tabular-nums lining-nums` by default — columns align without configuration. The type reads like a data feed because it is one.

### Hierarchy

- **Display** (700, ~40px+, lh 1.0, ls -0.01em): Score circle numbers, hero metrics. The largest number on screen is the most important fact. One per view.
- **Headline** (700, 16px, lh 1.2, ls 0.05em): Decision label (YES / CAUTION / NO). All-caps, tracked. One per page.
- **Title** (700, 12px, lh 1.4, ls 0.06em): Section headers, category names. All-caps. Short — 4 words maximum.
- **Body** (400–500, 11.5px, lh 1.5, ls 0.01em): Indicator rows, data values, timestamps. The workhorse.
- **Label** (700, 9px, lh 1.2, ls 0.08em): Micro labels, badge text, sub-category ticks. All-caps, maximum 4 words.

### Named Rules

**The One Family Rule.** No second font family is ever introduced. If a new surface feels like it "needs" a serif or sans-serif, adjust weight and size within JetBrains Mono instead.

**The Tabular Numbers Rule.** All numeric displays use `font-variant-numeric: tabular-nums lining-nums`. Proportional digit spacing in a market data interface is a defect.

**The Tracked Caps Rule.** All-caps text receives at minimum 0.06em letter-spacing. Untracked caps in monospace are cramped and read poorly at small sizes.

## 4. Elevation

Flat by default. Surfaces are separated through tonal layering (lighter surface on a darker background), thin border lines, and color contrast — not by shadow. Shadows appear only in two functional roles: lifted overlays and dark-depth separation.

The dark theme is effectively shadowless. Surface identity comes from the darker-navy backgrounds and the blue-tinted border lines. The contrast is structural.

The light theme uses ambient shadows as gentle surface separation.

### Shadow Vocabulary

- **Resting surface** (`0 1px 3px rgba(0,0,0,0.06)`): Cards on the light-theme page background. The minimum shadow needed to establish foreground.
- **Interactive overlay** (`0 2px 8px rgba(0,0,0,0.08)`): Dropdown menus, popovers, tooltip containers.
- **Deep overlay** (`0 4px 16px rgba(0,0,0,0.08)`): Modals and pinned panels. Slightly deeper, same low opacity.
- **Tooltip depth** (`0 8px 24px rgba(0,0,0,0.9)`): Tooltips use an intentionally heavy shadow to ensure visibility over any surface in both themes.

### Named Rules

**The Tonal Separation Rule.** Reach for surface color first, border second, shadow last. A new panel does not need all three — start with tone, add border if ambiguous, add shadow only for elements that must float above the layout.

**The Dark Theme No-Shadow Rule.** Do not add box-shadow to cards or panels in dark mode. Surfaces are defined by the background color contrast against Terminal Black.

## 5. Components

### Navigation Tabs

Compact tabs with icon + all-caps label. Active state: solid accent fill, white text. Inactive state: transparent background, dim text, thin border. Live in the sticky header bar.

- **Active:** `background: #1481B8`, `color: #fff`, `padding: 4px 12px`, `border-radius: 3px`, `font: 700 11px JetBrains Mono`, `letter-spacing: 0.06em`, `text-transform: uppercase`
- **Inactive:** `background: transparent`, `color: #94A3B8`, `border: 1px solid #E2E8F0`, same type treatment
- **Mobile:** Collapses to a single dropdown button in the active-tab style with a chevron indicator. Dropdown animates via max-height (not display toggle) for smooth open/close.
- **Glass theme:** The active fill (`.nav-active-pill`) swaps the solid accent for a liquid-glass lens — translucent white gradient, 1px `rgba(255,255,255,0.32)` border, own `backdrop-filter: blur(10px) saturate(1.6)`, specular inset top edge. Applies to the desktop slider, mobile dropdown button, and mobile active row.
- **Selection motion:** On tab change the pill shrinks toward its center (width to ~72%, scaleY 0.76), glides to the destination, then expands into place (WAAPI keyframes, 460ms, ease-in launch / ease-out settle). The previous pill rect persists at module scope so the glide survives the per-page header remount. Instant reposition under `prefers-reduced-motion`.

**Glass-theme extensions of the lens material** (light/dark keep their committed blue/signal fills):

- `.seg-active` — active segmented-control options and primary buttons (Relative Strength view/bench/window/filter toggles, Add, Retry) render as the same lens as the nav pill, overriding the inline blue via `!important`.
- `.pill-toggle-slider` — the sliding indicator inside the inline pill toggles (4% Burst 5D/10D, Breadth MTH/QTR) is the nav-pill lens at 18px scale: brighter white mix (tiny areas read dimmer), `blur(6px) saturate(1.5)`, and an inset 1px ring instead of a border so the slider's JS-measured width/height stay exact. The existing 0.3s spring slide provides the glide.
- `.glass-bar` — signal bars (Scoring Breakdown, Daily Sector Performance, category score bars, breadth mini-meters) follow the iOS 26 liquid-glass bar construction (from the community Figma spec): the bar itself is a ~2%-alpha glass pill with `backdrop-filter: blur(3px)` doing the frosting, the rim is white inset box-shadow highlights (`1px 1px 1px @0.40`, `-1px -1px 1px @0.25`, `0 0 4px @0.60`), and ALL color comes from two blurred light fields fixed to the CHART, not the bar — mirroring the Figma's overlapping blue/purple 100px-blur `plus-lighter` ellipses: a brighter field (60% hue core) at the track's max end and a softer indigo-deepened one (hue mixed 72/28 with `#1e1b4b`, 42% core) at the base, together covering the full track so every bar is luminous along its whole length and taller bars reach into the brighter region. Both fields are background-sized to the full track via `--bar-span` (the bar's value, 0–100); each bar clips its slice of the shared field. `border-radius: 9999px` in glass (breadth meter segments excepted; their container is the capsule). Each bar's direct parent renders as a visible track tube (`div:has(> .glass-bar)`): slate lift `rgba(148,163,184,0.13)` over `rgba(8,13,26,0.60)`, full pill radius, hairline inset ring — the Figma's `#3A3838` track translated to the navy palette. The component sets `--bar-color`, `--bar-span`, and for right-anchored bars `--bar-tip-x: 0%` + `--bar-base: right`. `.glass .sector-value` adds a dark text halo so signal-colored values stay readable over the glass body.
- `.rs-bar-pos` / `.rs-bar-neg` — the RS histogram SVG bars use shared paint servers (`#rs-glass-pos` / `#rs-glass-neg`, defined once in App.tsx) with the same ramp: pale at the baseline, saturated signal color at the tip; bar rects are pill-rounded (`rx = min(w/2, 1.5)`).
- `.ai-stack-row` — AI-stack layer rows take the standard glass fill + blur but keep their own border-color so the cyan open-state signal and L-gutter survive. Expanded company cells (`.ai-stack-co-cell`) go transparent in glass; their opaque surface fill is a light/dark-only device.
- RRG idle button — the cyan breathing glow is a light/dark-only material; in glass it renders as the standard white lens (static, white arc sweep on hover).
- RRG panel is full `glass-panel` (its tooltip is portaled to `document.body`, since backdrop-filter would become the containing block for `position: fixed`); `.rrg-solid` backs the sticky sidebar header and mobile overlay near-opaque for scroll legibility.

### Signal Chips

Semantic status badges used in indicator rows, breadth tables, and sector readings. Background is a low-opacity tint of the signal color; text is the full signal color. Never solid signal fills.

- **Bullish:** `background: #DCFCE7`, `color: #16A34A`, `padding: 2px 6px`, `border-radius: 3px`, `font: label`
- **Bearish:** `background: #FEE2E2`, `color: #DC2626`, same shape
- **Neutral:** `background: #FEF3C7`, `color: #D97706`, same shape
- Dark equivalents use `rgba(signal-color, 0.12)` backgrounds

### Cards / Panels

Flat containers grouping related indicators. No decorative shadow in dark mode. Subtle ambient shadow in light mode.

- **Corner style:** Gently squared — 6px ({rounded.md})
- **Background:** `{colors.surface-light}` / `{colors.surface-dark}`
- **Border:** `1px solid {colors.border-light}` / `1px solid {colors.border-dark}`
- **Shadow (light only):** `0 1px 3px rgba(0,0,0,0.06)`
- **Padding:** 16px

### Decision Panel (Signature Component)

The most important element. A bordered panel with a tinted background keyed to the market verdict. The signal color appears in the border, background tint, and verdict text — never as a solid fill.

- **YES:** `border: 1px solid rgba(22,163,74,0.20)`, `background: rgba(22,163,74,0.06)`, verdict text in `#16A34A`
- **CAUTION:** `border: 1px solid rgba(217,119,6,0.20)`, `background: rgba(217,119,6,0.06)`, verdict text in `#D97706`
- **NO:** `border: 1px solid rgba(220,38,38,0.20)`, `background: rgba(220,38,38,0.06)`, verdict text in `#DC2626`
- Score rendered in a circular SVG gauge. Track: `rgba(0,0,0,0.08)` light / `rgba(255,255,255,0.06)` dark. Animated stroke-dashoffset on mount (1200ms cubic-ease-out).

### Tooltips

Portal-rendered via `createPortal` to escape overflow-hidden containers. Intentionally terminal-dark in both themes — the tooltip always reads as an overlay.

- **Width:** 240px fixed
- **Background:** `var(--terminal-surface)` (light) / `#0f1117` forced dark
- **Border:** `1px solid #E2E8F0` default, `1px solid rgba(245,158,11,0.4)` for amber alerts
- **Shadow:** `0 8px 24px rgba(0,0,0,0.9)` — heavy, ensures float over any surface
- **Type:** 10.5px body, 9px all-caps bold label for tooltip title
- **Corner:** 6px ({rounded.md})

### Ticker Bar

A continuously scrolling strip of market tickers pinned to the top of the app across all routes. Background is a subtle overlay tint, never opaque.

- **Background:** `rgba(0,0,0,0.04)` light / `rgba(0,0,0,0.30)` dark
- **Font:** Label — 9–10px, bold, tracked
- **Animation:** `ticker-scroll` 60s linear infinite; respects `prefers-reduced-motion: reduce` (pauses)

### Inputs / Buttons

Minimal presence. Icon buttons use opacity modulation (60% resting → 100% hover) rather than background change. Primary buttons use the accent fill only for critical actions (Retry, primary CTA).

- **Primary button:** `background: #1481B8`, `color: #fff`, `padding: 8px 16px`, `border-radius: 6px`, `font: 700 11.5px JetBrains Mono`
- **Icon button (ghost):** `background: transparent`, `opacity: 0.6`, `hover: opacity 1.0`, `border-radius: 3px`, `padding: 6px`, no border

## 6. Do's and Don'ts

### Do:
- **Do** reserve green, red, and amber exclusively for market signals — bullish, bearish, neutral. A green icon that doesn't mean "bullish" is a broken contract.
- **Do** use JetBrains Mono for every text element. One family throughout.
- **Do** apply `font-variant-numeric: tabular-nums lining-nums` to all numeric displays.
- **Do** use low-opacity tinted backgrounds (not solid fills) for signal chips and decision panel tints.
- **Do** keep the accent blue to ≤15% surface coverage — interactive states and live indicators only.
- **Do** establish surface hierarchy through background color contrast and border lines before reaching for shadow.
- **Do** portal-render tooltips and dropdowns via `fixed` positioning or `createPortal` to escape overflow-hidden containers.
- **Do** keep the YES/CAUTION/NO panel the most visually dominant element on the Monitor page. Nothing competes with it.
- **Do** make both light and dark themes independently WCAG AA compliant (4.5:1 body text).

### Don't:
- **Don't** introduce a second font family. Not a serif for headings, not a sans-serif for "accessibility." Mono only.
- **Don't** use gradient fills — on text, backgrounds, or chart bars. One signal color, solid tint where tints are used.
- **Don't** build equal-weight card grids with icon + heading + text tiles. This is the Generic SaaS pattern this system explicitly rejects.
- **Don't** use warm-tinted neutrals (cream, sand, ivory, bone). The light theme background is cool: Ice White #F8FAFC. Warm backgrounds read as retail.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on any card or row. Use full borders or background tints.
- **Don't** apply the accent blue to decorative elements, chart fills, or icon fills. It signals "interactive" and nothing else.
- **Don't** borrow editorial or news-finance layout patterns (headline-heavy columns, mixed media blocks, cluttered reading density). This is a decision tool, not a content destination.
- **Don't** exceed 9px border-radius on any component. Soft corners signal consumer product, not professional terminal.
- **Don't** add shadow to dark-theme cards or panels. Surfaces in dark mode are defined by color contrast, not shadow depth.
- **Don't** break the stable layout structure. The user reads the same layout every pre-market session. Layout surprises compete with data surprises. Only the data should surprise.
