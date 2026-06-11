import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw, Sun, Moon, ChevronDown, Layers, Search, X, ArrowLeft,
} from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { useTheme } from "@/hooks/useTheme";
import { useViewTransitionNavigate } from "@/lib/viewTransition";
import { AI_STACK_DATA } from "@/data/aiStack";

// Pull "(also L2)" / "(also L11/L12)" cross-references out of role copy and surface
// them as a separate chip so the overlapping-node insight reads as data, not parenthetical aside.
const ALSO_RE = /\s*\(also\s+([^)]+)\)\s*$/i;
function parseRole(role: string): { text: string; alsoLayers: string[] } {
  const m = role.match(ALSO_RE);
  if (!m) return { text: role, alsoLayers: [] };
  const layers = Array.from(
    new Set(
      m[1]
        .split(/[,/\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^L\d+$/.test(s))
    )
  );
  return { text: role.replace(ALSO_RE, "").trim(), alsoLayers: layers };
}

export default function AIStack() {
  const { theme, toggleTheme } = useTheme();
  const navigateWithTransition = useViewTransitionNavigate();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const isSearching = query.trim().length > 0;

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(AI_STACK_DATA.map((_, i) => i)));
  const collapseAll = () => setExpanded(new Set());

  // Keyboard layer — power-user shortcuts for a dense reference page.
  // /        focus search
  // Escape   if input focused → clear & blur; otherwise → collapse all
  // e        expand all (only when no input focused)
  // c        collapse all (only when no input focused)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (e.key === "/" && !inInput) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === "Escape") {
        if (inInput) {
          if (query) setQuery("");
          searchRef.current?.blur();
        } else {
          collapseAll();
        }
        return;
      }
      if (!inInput && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        expandAll();
      } else if (!inInput && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        collapseAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query]);

  // Filter: a layer matches if its label/sublabel matches OR any of its companies match.
  // We auto-expand any layer that has matching companies so hits are visible.
  const { filteredData, autoExpand, totalCompanies, matchingCompanies } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const totalCompanies = AI_STACK_DATA.reduce((sum, l) => sum + l.companies.length, 0);

    if (!q) {
      return { filteredData: AI_STACK_DATA, autoExpand: null as Set<number> | null, totalCompanies, matchingCompanies: totalCompanies };
    }

    let matching = 0;
    const auto = new Set<number>();
    const filtered = AI_STACK_DATA
      .map((layer, i) => {
        const layerMatches =
          layer.label.toLowerCase().includes(q) ||
          layer.sublabel.toLowerCase().includes(q) ||
          layer.layer.toLowerCase().includes(q);
        const cos = layer.companies.filter(
          (c) =>
            c.ticker.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.role.toLowerCase().includes(q)
        );
        matching += cos.length;
        if (cos.length > 0 || layerMatches) {
          if (cos.length > 0) auto.add(i);
          return { ...layer, companies: cos.length > 0 ? cos : layer.companies, _origIdx: i };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { filteredData: filtered, autoExpand: auto, totalCompanies, matchingCompanies: matching };
  }, [query]);

  const isExpanded = (origIdx: number) =>
    autoExpand ? autoExpand.has(origIdx) : expanded.has(origIdx);

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--terminal-bg)" }}>
      {/* ─── Header — keep RS active so user knows they're in the RS section ─── */}
      <AppHeader
        activePage="rs"
        statusContent={
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3" style={{ color: "var(--terminal-cyan)" }} />
            <span style={{ color: "var(--terminal-cyan)" }}>REFERENCE</span>
          </div>
        }
        actions={
          <>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100"
              title="Reload"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </>
        }
      />

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto p-3 md:p-4">
        <div className="max-w-[1100px] mx-auto space-y-3">

          {/* ─── Page intro ─── */}
          <div
            className="rounded-lg border p-4"
            style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[280px]">
                {/* Eyebrow chip — View Transition target paired with the RS-page button */}
                <div
                  className="vt-ai-stack inline-flex items-center gap-1.5 px-2 py-1 rounded mb-2"
                  style={{
                    border: "1px solid var(--terminal-cyan)",
                    background: "var(--overlay-subtle)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
                    <rect x="2" y="2.5"  width="10" height="1.3" rx="0.3" fill="var(--terminal-cyan)" />
                    <rect x="2" y="6.5"  width="10" height="1.3" rx="0.3" fill="var(--terminal-cyan)" />
                    <rect x="2" y="10.5" width="10" height="1.3" rx="0.3" fill="var(--terminal-cyan)" />
                  </svg>
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{ color: "var(--terminal-cyan)", letterSpacing: "0.06em" }}
                  >
                    AI Stack
                  </span>
                </div>

                <h1
                  className="font-bold uppercase"
                  style={{
                    color: "var(--text-primary)",
                    fontSize: "clamp(22px, 2.4vw, 28px)",
                    lineHeight: 1.05,
                    letterSpacing: "0.04em",
                    fontVariantNumeric: "tabular-nums lining-nums",
                  }}
                >
                  AI Infrastructure Stack
                </h1>
                <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)", lineHeight: 1.6, maxWidth: "62ch" }}>
                  Key public players in each layer, with the closest ETF proxy. Stalk them on Relative Strength.
                </p>
              </div>

              <a
                href="#/relative-strength"
                onClick={(e) => { e.preventDefault(); navigateWithTransition("/relative-strength"); }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-colors"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--terminal-border)",
                  letterSpacing: "0.06em",
                }}
                data-testid="link-back-rs"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Relative Strength
              </a>
            </div>
          </div>

          {/* ─── Controls ─── */}
          <div
            className="rounded-lg border p-3 flex flex-wrap items-center gap-3"
            style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
          >
            {/* Search */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
              <div
                className="ai-stack-search flex items-center gap-1.5 px-2 py-1 rounded flex-1"
                style={{ background: "var(--overlay-subtle)", border: "1px solid var(--terminal-border)" }}
              >
                <Search className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Search ticker, company, or role'
                  aria-label="Search AI stack tickers, companies, and roles"
                  className="bg-transparent text-[11px] outline-none flex-1 min-w-0"
                  style={{ color: "var(--text-primary)" }}
                  data-testid="input-search"
                />
                {!query && (
                  <span className="ai-stack-kbd" aria-hidden="true">/</span>
                )}
                {query && (
                  <button
                    onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    aria-label="Clear search"
                    data-testid="button-search-clear"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Expand / Collapse — disabled when search auto-controls expansion */}
            <div
              className="flex items-center gap-1"
              aria-disabled={isSearching}
              title={isSearching ? "Search controls expansion — clear search to manage manually" : undefined}
            >
              <button
                onClick={expandAll}
                disabled={isSearching}
                className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--terminal-border)",
                  background: "transparent",
                  letterSpacing: "0.06em",
                }}
                data-testid="button-expand-all"
              >
                Expand All <span className="ai-stack-kbd ml-1" aria-hidden="true">E</span>
              </button>
              <button
                onClick={collapseAll}
                disabled={isSearching}
                className="px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--terminal-border)",
                  background: "transparent",
                  letterSpacing: "0.06em",
                }}
                data-testid="button-collapse-all"
              >
                Collapse All <span className="ai-stack-kbd ml-1" aria-hidden="true">C</span>
              </button>
            </div>

            {/* Counts */}
            <div
              className="text-[10px]"
              style={{ color: isSearching ? "var(--terminal-cyan)" : "var(--text-muted)" }}
              aria-live="polite"
            >
              {isSearching
                ? `${matchingCompanies} of ${totalCompanies} tickers match`
                : `${AI_STACK_DATA.length} layers · ${totalCompanies} tickers`}
            </div>
          </div>

          {/* ─── Stack rows ─── */}
          <div className="space-y-1.5">
            {filteredData.length === 0 ? (
              <div
                className="rounded-lg border p-8 text-center"
                style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
              >
                <Search className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-faint)" }} />
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  No tickers or layers match "{query}".
                </p>
              </div>
            ) : (
              filteredData.map((layer) => {
                const origIdx = "_origIdx" in layer ? (layer as { _origIdx: number })._origIdx : AI_STACK_DATA.indexOf(layer as typeof AI_STACK_DATA[number]);
                const open = isExpanded(origIdx);
                return (
                  <div
                    key={`${layer.layer}-${origIdx}`}
                    className="rounded-md overflow-hidden border"
                    style={{
                      background: open ? "var(--overlay-subtle)" : "var(--terminal-surface)",
                      borderColor: open ? "var(--terminal-cyan)" : "var(--terminal-border)",
                      transition: "border-color 0.2s, background 0.2s",
                    }}
                  >
                    {/* Layer header — L-tag is the spine, fixed 56px leading gutter */}
                    <button
                      onClick={() => !isSearching && toggle(origIdx)}
                      disabled={isSearching}
                      aria-expanded={open}
                      aria-controls={`layer-panel-${origIdx}`}
                      title={isSearching ? "Search controls expansion — clear search to manage manually" : undefined}
                      className="w-full flex items-stretch text-left disabled:cursor-default"
                      style={{ cursor: "pointer", userSelect: "none" }}
                      data-testid={`layer-${layer.layer}`}
                    >
                      {/* L-tag gutter — display-weight, the page's reading rhythm */}
                      <div
                        className="flex-shrink-0 flex items-center justify-center"
                        style={{
                          width: "56px",
                          background: open ? "var(--terminal-cyan)" : "var(--chip-bg)",
                          borderRight: `1px solid ${open ? "var(--terminal-cyan)" : "var(--terminal-border)"}`,
                          color: open ? "#fff" : "var(--text-secondary)",
                          fontWeight: 700,
                          fontSize: "18px",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          fontVariantNumeric: "tabular-nums lining-nums",
                          transition: "background 0.2s, color 0.2s, border-color 0.2s",
                        }}
                      >
                        {layer.layer}
                      </div>

                      <div className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-[13px] font-bold uppercase ${open ? "" : "truncate"}`}
                            style={{
                              color: open ? "var(--terminal-cyan)" : "var(--text-primary)",
                              letterSpacing: "0.06em",
                              transition: "color 0.2s",
                              ...(open ? { textWrap: "balance" as const } : null),
                            }}
                          >
                            {layer.label}
                          </div>
                          <div
                            className={`text-[10.5px] mt-0.5 ${open ? "" : "truncate"}`}
                            style={{
                              color: "var(--text-muted)",
                              lineHeight: open ? 1.5 : undefined,
                            }}
                          >
                            {layer.sublabel}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-bold tracking-wider"
                            style={{
                              color: !isSearching && layer.etf ? "var(--terminal-cyan)" : "var(--text-muted)",
                              border: "1px solid var(--terminal-border)",
                              letterSpacing: "0.06em",
                              fontVariantNumeric: "tabular-nums lining-nums",
                            }}
                            title={!isSearching && layer.etf ? `Closest ETF proxy: $${layer.etf}` : undefined}
                          >
                            {!isSearching && layer.etf
                              ? `$${layer.etf}`
                              : `${layer.companies.length} ${layer.companies.length === 1 ? "CO" : "COS"}`}
                          </span>
                          {isSearching ? (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase"
                              style={{
                                color: "var(--terminal-cyan)",
                                background: "var(--chip-bg)",
                                border: "1px solid var(--terminal-cyan)",
                                letterSpacing: "0.08em",
                              }}
                              aria-hidden="true"
                            >
                              Match
                            </span>
                          ) : (
                            <ChevronDown
                              className="w-3.5 h-3.5 ai-stack-chevron"
                              style={{
                                color: open ? "var(--terminal-cyan)" : "var(--text-muted)",
                                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s, color 0.2s",
                              }}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Companies grid — divider-table feel: subtle dividers, not a tile pattern */}
                    {open && (
                      <div
                        id={`layer-panel-${origIdx}`}
                        role="region"
                        aria-label={`${layer.label} — ${layer.companies.length} companies`}
                        className="grid"
                        style={{
                          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                          borderTop: "1px solid var(--terminal-border)",
                        }}
                      >
                        {layer.companies.map((co, j) => {
                          const isPrivate = co.ticker === "PRIVATE";
                          const { text: roleText, alsoLayers } = parseRole(co.role);
                          return (
                            <div
                              key={`${layer.layer}-${j}`}
                              className="px-3 py-2.5 ai-stack-co-cell"
                              data-testid={`co-${co.ticker}-${j}`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className="text-[10px] font-bold tracking-wider"
                                  style={{
                                    color: isPrivate ? "var(--text-faint)" : "var(--terminal-cyan)",
                                    letterSpacing: "0.06em",
                                    minWidth: "50px",
                                    fontVariantNumeric: "tabular-nums lining-nums",
                                  }}
                                >
                                  {isPrivate ? "PRIVATE" : `$${co.ticker}`}
                                </span>
                                <span className="text-[11px] font-bold truncate" style={{ color: "var(--text-primary)" }}>
                                  {co.name}
                                </span>
                              </div>
                              <div
                                className="text-[10.5px]"
                                style={{ color: "var(--text-muted)", lineHeight: 1.5 }}
                              >
                                {roleText}
                              </div>
                              {alsoLayers.length > 0 && (
                                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                  <span
                                    className="text-[8.5px] font-bold tracking-wider uppercase"
                                    style={{ color: "var(--text-faint)", letterSpacing: "0.1em" }}
                                  >
                                    Also
                                  </span>
                                  {alsoLayers.map((l) => (
                                    <span
                                      key={l}
                                      className="text-[9px] font-bold px-1.5 py-px rounded uppercase"
                                      style={{
                                        color: "var(--text-secondary)",
                                        background: "var(--chip-bg)",
                                        border: "1px solid var(--terminal-border)",
                                        letterSpacing: "0.06em",
                                        fontVariantNumeric: "tabular-nums lining-nums",
                                      }}
                                    >
                                      {l}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer
        className="flex-shrink-0 px-4 py-2 text-center text-[10px] border-t"
        style={{ borderColor: "var(--terminal-border)", color: "var(--text-faint)", letterSpacing: "0.06em" }}
      >
        Static taxonomy · Use Relative Strength for what's leading today
      </footer>
    </div>
  );
}
