import { useState } from "react";
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
  { id: "monitor", href: "/",                  label: "MARKET MONITOR",    icon: <Activity  className="w-3.5 h-3.5" /> },
  { id: "rs",      href: "/relative-strength", label: "RELATIVE STRENGTH", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: "breadth", href: "/market-breadth",    label: "MARKET BREADTH",    icon: <Table     className="w-3.5 h-3.5" /> },
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

  return (
    <header
      className="flex-shrink-0 border-b"
      style={{ borderColor: "var(--terminal-border)", background: "var(--terminal-surface)" }}
    >
      {/* ── Main bar ── */}
      <div className="flex items-center justify-between px-4 py-2 text-xs gap-2">

        {/* Left */}
        <div className="flex items-center gap-2 flex-1 min-w-0">

          {/* Logo */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="Trading Dashboard Logo" className="flex-shrink-0">
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

          {/* Desktop: inline tabs */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-4 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: "none" }}>
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === activePage;
              return isActive ? (
                <div
                  key={item.id}
                  className="flex items-center gap-1.5 px-3 py-1 rounded flex-shrink-0"
                  style={{ color: "#fff", background: "var(--terminal-blue)" }}
                >
                  {item.icon}
                  <span className="font-bold tracking-wide">{item.label}</span>
                </div>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-1.5 px-3 py-1 rounded transition-colors flex-shrink-0"
                  style={{ color: "var(--terminal-dim)", background: "transparent", border: "1px solid var(--terminal-border)" }}
                >
                  {item.icon}
                  <span className="font-bold tracking-wide">{item.label}</span>
                </Link>
              );
            })}
            {statusContent}
            {updatedLabel && <span className="opacity-40">{updatedLabel}</span>}
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
