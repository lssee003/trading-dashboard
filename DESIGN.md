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

The system runs two professional themes that share a single identity. Light mode follows TradingView Professional: cool slate-tinted (#F1F5F9) backgrounds with white card surfaces, controlled blue accents, signal colors at full saturation. Dark mode follows Bloomberg Terminal: deep navy-black (#0A0F1A), richer blue-tinted surfaces (#111B2B), electric signal colors, and clearly defined borders. Both themes use JetBrains Mono at every size and weight. Monospace is not a stylistic choice; it is the credential. A proportional font on this dashboard would feel like a retail product.

Design restraint is structural doctrine, not a taste preference. No gradients. No decorative color. No softened corners as a default. The signal colors — green, red, amber — belong exclusively to market signals. Anything decorative competes with meaning and is therefore prohibited. This system rejects both the generic SaaS card-grid aesthetic (Shadcn defaults, cream whites, equally-weighted metric tiles) and the cluttered editorial layout of news-finance sites (MarketWatch, Yahoo Finance). Neither has a decision architecture. This one does.

**Key Characteristics:**
- Monospace throughout — JetBrains Mono at every role, never a second family
- Dual professional themes: TradingView light / Bloomberg dark, independently WCAG AA compliant
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
