import { useCallback, useState } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { TickerBar } from "@/components/TickerBar";
import { GlassBackdrop } from "@/components/GlassBackdrop";
import { LiquidGlassFilters } from "@/components/LiquidGlassFilters";
import type { DashboardData } from "@shared/schema";
import Dashboard from "@/pages/Dashboard";
import RelativeStrength from "@/pages/RelativeStrength";
import GoogleSheets from "@/pages/GoogleSheets";
import AIStack from "@/pages/AIStack";
import NotFound from "@/pages/not-found";
import { V2App, CLASSIC_ROUTE, type V2Page } from "@/v2/V2App";
import { UISwitch } from "@/v2/UISwitch";
import { lsGet, lsSet } from "@/v2/tokens";

/** Persistent ticker strip — fetches its own data so it stays alive across all routes */
function GlobalTickerBar() {
  const { data } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    staleTime: 30_000,
    refetchInterval: 45_000,
  });

  if (!data?.tickers) return null;
  return <TickerBar tickers={data.tickers} />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/relative-strength" component={RelativeStrength} />
      <Route path="/ai-stack" component={AIStack} />
      <Route path="/market-breadth" component={GoogleSheets} />
      <Route component={NotFound} />
    </Switch>
  );
}

/** The original UI — reachable from the "Classic UI" pull-tab */
function ClassicApp() {
  return (
    <Router hook={useHashLocation}>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--terminal-bg)" }}>
        {/* Procedural liquid-glass scene behind everything (glass theme only) */}
        <GlassBackdrop />
        {/* Shared SVG paint servers for the glass-theme RS histogram bars:
            pale at the baseline, saturated signal color at the tip */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="rs-glass-pos" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--terminal-green) 40%, #ffffff)", stopOpacity: 0.55 }} />
              <stop offset="0.55" style={{ stopColor: "var(--terminal-green)", stopOpacity: 0.8 }} />
              <stop offset="1" style={{ stopColor: "var(--terminal-green)", stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="rs-glass-neg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--terminal-red) 40%, #ffffff)", stopOpacity: 0.55 }} />
              <stop offset="0.55" style={{ stopColor: "var(--terminal-red)", stopOpacity: 0.8 }} />
              <stop offset="1" style={{ stopColor: "var(--terminal-red)", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
        </svg>
        {/* Reusable liquid-glass refraction filters (glass theme) —
            referenced by index.css via backdrop-filter: url(#lg-*) */}
        <LiquidGlassFilters />
        {/* Sticky ticker bar across all pages */}
        <div className="flex-shrink-0 sticky top-0 z-50 glass-chrome" style={{ background: "var(--terminal-surface)" }}>
          <GlobalTickerBar />
        </div>
        {/* Page content */}
        <div className="flex-1 flex flex-col min-h-0">
          <AppRouter />
        </div>
      </div>
    </Router>
  );
}

type UIMode = "new" | "classic";

/** Hash route the classic router reads; kept in sync while the new UI is shown */
function syncHash(route: string) {
  if (window.location.hash.replace(/^#/, "") !== route) history.replaceState(null, "", "#" + route);
}

function App() {
  const [ui, setUi] = useState<UIMode>(() => (lsGet("5ss-ui") === "classic" ? "classic" : "new"));
  const [fading, setFading] = useState(false);

  const onPageChange = useCallback((p: V2Page) => syncHash(CLASSIC_ROUTE[p]), []);

  // Fade the current UI out, then swap and fade the other one in
  const toggleUI = useCallback(() => {
    const next: UIMode = ui === "new" ? "classic" : "new";
    lsSet("5ss-ui", next);
    setFading(true);
    window.setTimeout(() => {
      setUi(next);
      window.scrollTo(0, 0);
      requestAnimationFrame(() => requestAnimationFrame(() => setFading(false)));
    }, 380);
  }, [ui]);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          {ui === "new" ? (
            <div style={{ position: "fixed", inset: 0, opacity: fading ? 0 : 1, transform: fading ? "scale(.94)" : "none", filter: fading ? "blur(10px)" : "none", transition: "opacity .8s ease, transform 1s cubic-bezier(.16,1,.3,1), filter .8s ease" }}>
              <V2App onPageChange={onPageChange} />
            </div>
          ) : (
            <div style={{ opacity: fading ? 0 : 1, transition: "opacity .7s ease" }}>
              <ClassicApp />
            </div>
          )}
          <UISwitch ui={ui} onToggle={toggleUI} />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
