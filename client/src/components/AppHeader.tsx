import { useState, useRef, useLayoutEffect } from "react";
import { Link } from "wouter";
import { BarChart3, Table, ChevronDown, Activity } from "lucide-react";

type ActivePage = "monitor" | "rs" | "breadth";

interface NavItem {
  id: ActivePage;
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: "monitor", href: "/",                  label: "MARKET MONITOR",    icon: <Activity  className="w-3.5 h-3.5 icon-power-on icon-power-on-d1" /> },
  { id: "rs",      href: "/relative-strength", label: "RELATIVE STRENGTH", icon: <BarChart3 className="w-3.5 h-3.5 icon-power-on icon-power-on-d2" /> },
  { id: "breadth", href: "/market-breadth",    label: "MARKET BREADTH",    icon: <Table     className="w-3.5 h-3.5 icon-power-on icon-power-on-d3" /> },
];

interface AppHeaderProps {
  activePage: ActivePage;
  statusContent: React.ReactNode;
  updatedLabel?: React.ReactNode;
  actions: React.ReactNode;
}

export function AppHeader({ activePage, statusContent, updatedLabel, actions }: AppHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);
  const active = NAV_ITEMS.find((n) => n.id === activePage)!;
  const tabsRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-tab-id="${activePage}"]`) as HTMLElement;
    if (!activeEl) return;
    setSliderStyle({
      transform: `translateX(${activeEl.offsetLeft}px)`,
      width: activeEl.offsetWidth,
      height: activeEl.offsetHeight,
      opacity: 1,
    });
  }, [activePage]);

  return (
    <header
      className="flex-shrink-0 border-b scan-line-sweep"
      style={{ borderColor: "var(--terminal-border)", background: "var(--terminal-surface)" }}
    >
      {/* ── Main bar ── */}
      <div className="flex items-center justify-between px-4 py-2 text-xs gap-2">

        {/* Left */}
        <div className="flex items-center gap-2 flex-1 min-w-0">

          {/* Logo */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="Trading Dashboard Logo" className="flex-shrink-0 icon-power-on" style={{ "--icon-glow": "var(--terminal-green)" } as React.CSSProperties}>
            <rect x="2" y="2" width="20" height="20" rx="3" stroke="var(--terminal-cyan)" strokeWidth="1.5"/>
            <path d="M6 16 L10 10 L14 13 L18 6" stroke="var(--terminal-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="18" cy="6" r="1.5" fill="var(--terminal-green)"/>
          </svg>

          {/* Mobile: current-page button */}
          <button
            className="sm:hidden flex items-center gap-1.5 px-3 py-1 rounded font-bold tracking-wide text-xs"
            style={{ background: "var(--terminal-blue)", color: "#fff" }}
            onClick={() => setNavOpen((v) => !v)}
          >
            {active.icon}
            {active.label}
            <ChevronDown
              className="w-3 h-3"
              style={{
                transition: "transform 0.2s ease",
                transform: navOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {/* Desktop: inline tabs with sliding indicator */}
          <div ref={tabsRef} className="hidden sm:flex items-center gap-2 sm:gap-4 overflow-x-auto flex-1 min-w-0 relative" style={{ scrollbarWidth: "none" }}>
            {/* Sliding indicator */}
            <div
              className="absolute top-0 left-0 rounded pointer-events-none"
              style={{
                background: "var(--terminal-blue)",
                boxShadow: "0 0 12px color-mix(in srgb, var(--terminal-blue) 40%, transparent), 0 0 4px color-mix(in srgb, var(--terminal-blue) 20%, transparent)",
                ...sliderStyle,
                transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), width 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
              }}
            />
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === activePage;
              const className = "flex items-center gap-1.5 px-3 py-1 rounded flex-shrink-0 relative z-10 transition-colors duration-200";
              const style = { color: isActive ? "#fff" : "var(--terminal-dim)" };
              const content = (
                <>
                  {item.icon}
                  <span className="font-bold tracking-wide">{item.label}</span>
                </>
              );

              return isActive ? (
                <div key={item.id} data-tab-id={item.id} className={className} style={style}>
                  {content}
                </div>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  data-tab-id={item.id}
                  className={className}
                  style={{ ...style, border: "1px solid var(--terminal-border)" }}
                >
                  {content}
                </Link>
              );
            })}
            {statusContent}
            {updatedLabel && <span style={{ color: 'var(--text-muted)' }}>{updatedLabel}</span>}
          </div>

          {/* Mobile: status inline */}
          <div className="flex sm:hidden items-center gap-1.5">
            {statusContent}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {actions}
        </div>
      </div>

      {/* ── Mobile nav panel — animates open/closed via max-height ── */}
      <div
        className="sm:hidden overflow-hidden border-t"
        style={{
          borderColor: "var(--terminal-border)",
          maxHeight: navOpen ? "200px" : "0px",
          opacity: navOpen ? 1 : 0,
          transition: "max-height 0.25s ease, opacity 0.2s ease",
          borderTopWidth: navOpen ? "1px" : "0px",
          position: "relative",
          zIndex: 50,
        }}
      >
        {NAV_ITEMS.map((item, i) => {
          const isActive = item.id === activePage;
          return isActive ? (
            <div
              key={item.id}
              className="flex items-center gap-2 px-4 py-3 font-bold tracking-wide text-xs"
              style={{
                background: "var(--terminal-blue)",
                color: "#fff",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.1)" : undefined,
              }}
            >
              {item.icon}
              {item.label}
            </div>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-2 px-4 py-3 font-bold tracking-wide text-xs"
              style={{
                color: "var(--terminal-dim)",
                borderTop: i > 0 ? "1px solid var(--terminal-border)" : undefined,
                display: "flex",
              }}
              onClick={() => setNavOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Backdrop — closes nav when tapping page content */}
      {navOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40"
          onClick={() => setNavOpen(false)}
        />
      )}
    </header>
  );
}
