import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { DashboardData } from "@shared/schema";
import { HeroPanel } from "../components/HeroPanel";
import { CategoryPanel } from "../components/CategoryPanel";
import { SectorHeatmap } from "../components/SectorHeatmap";
import { ScoreBreakdown } from "../components/ScoreBreakdown";
import { AlertBanner } from "../components/AlertBanner";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { RefreshCw, Activity, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { AppHeader } from "../components/AppHeader";

const IS_STATIC = import.meta.env.VITE_DATA_MODE === "static";

export default function Dashboard() {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const { theme, toggleTheme } = useTheme();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  // Track last refresh time
  useEffect(() => {
    if (data) {
      setLastRefresh(new Date());
    }
  }, [data?.lastUpdated]);

  // Update "seconds ago" counter (only in API mode)
  useEffect(() => {
    if (IS_STATIC) return; // Don't run timer in static mode
    
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastRefresh]);

  const handleRefresh = () => {
    if (!IS_STATIC) {
      refetch();
    }
  };

  // Format timestamp for static mode
  const formatDataTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins < 1 ? "just now" : `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--terminal-bg)" }}>
        <div className="text-center p-8 rounded-lg border" style={{ borderColor: "var(--terminal-border)", background: "var(--terminal-surface)" }}>
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--terminal-amber)" }}>DATA FEED ERROR</h2>
          <p className="text-sm opacity-60 mb-4 max-w-md">{(error as Error)?.message || "Failed to connect to market data feed"}</p>
          {!IS_STATIC && (
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{ background: "var(--terminal-blue)", color: "#fff" }}
              data-testid="button-retry"
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--terminal-bg)" }}>
      <AppHeader
        activePage="monitor"
        statusContent={
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${IS_STATIC ? "" : "pulse-live"}`}
              style={{ background: IS_STATIC ? "var(--terminal-cyan)" : (isFetching ? "var(--terminal-amber)" : "var(--terminal-green)") }}
            />
            <span style={{ color: IS_STATIC ? "var(--terminal-cyan)" : (isFetching ? "var(--terminal-amber)" : "var(--terminal-green)") }}>
              {IS_STATIC ? "SNAPSHOT" : (isFetching ? "UPDATING" : "LIVE")}
            </span>
          </div>
        }
        updatedLabel={IS_STATIC && data?.lastUpdated ? `updated ${formatDataTimestamp(data.lastUpdated)}` : `updated ${secondsAgo}s ago`}
        actions={
          <>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100"
              data-testid="button-theme-toggle"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            {!IS_STATIC && (
              <button
                onClick={handleRefresh}
                className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100"
                data-testid="button-refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </button>
            )}
          </>
        }
      />

      {/* Alert Banner */}
      {data?.alerts && data.alerts.length > 0 && (
        <AlertBanner alerts={data.alerts} />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-3 md:p-4">
        {isLoading ? (
          <DashboardSkeleton />
        ) : data ? (
          <div className="max-w-[1600px] mx-auto space-y-3">
            {/* Hero + Terminal Analysis — aligned to 5-col grid below */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 items-stretch">
              <div className="xl:col-span-2">
                <HeroPanel
                  decision={data.decision}
                  marketQualityScore={data.marketQualityScore}
                  stance={data.terminalAnalysis?.stance}
                />
              </div>
              <div className="xl:col-span-3">
                <AnalysisPanel summary={data.summary} dataSource={data.dataSource} terminalAnalysis={data.terminalAnalysis} />
              </div>
            </div>

            {/* Category Panels Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              {data.categories.map((cat) => (
                <CategoryPanel
                  key={cat.name}
                  category={cat}
                  burst={cat.name === "Breadth" ? data.burst : undefined}
                  momentum20d={cat.name === "Breadth" ? data.momentum20d : undefined}
                  breadthToggle={cat.name === "Breadth" ? data.breadthToggle : undefined}
                />
              ))}
            </div>

            {/* Sector Heatmap + Score Breakdown — aligned to 5-col grid */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 items-stretch">
              <div className="xl:col-span-3 flex flex-col">
                <SectorHeatmap sectors={data.sectors} />
              </div>
              <div className="xl:col-span-2 flex flex-col">
                <ScoreBreakdown categories={data.categories} totalScore={data.marketQualityScore} />
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 px-4 py-2 text-center text-xs opacity-30 border-t" style={{ borderColor: "var(--terminal-border)" }}>
        {data?.dataSource || "Yahoo Finance (delayed ~15min)"} · For informational purposes only · Not financial advice
      </footer>
    </div>
  );
}
