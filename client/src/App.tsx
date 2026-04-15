import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { TickerBar } from "@/components/TickerBar";
import type { DashboardData } from "@shared/schema";
import Dashboard from "@/pages/Dashboard";
import RelativeStrength from "@/pages/RelativeStrength";
import GoogleSheets from "@/pages/GoogleSheets";
import NotFound from "@/pages/not-found";

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
      <Route path="/market-breadth" component={GoogleSheets} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <div className="min-h-screen flex flex-col" style={{ background: "var(--terminal-bg)" }}>
              {/* Sticky ticker bar across all pages */}
              <div className="flex-shrink-0 sticky top-0 z-50" style={{ background: "var(--terminal-surface)" }}>
                <GlobalTickerBar />
              </div>
              {/* Page content */}
              <div className="flex-1 flex flex-col min-h-0">
                <AppRouter />
              </div>
            </div>
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
