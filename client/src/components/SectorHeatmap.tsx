interface Sector {
  symbol: string;
  name: string;
  changePercent: number;
}

interface SectorHeatmapProps {
  sectors: Sector[];
}

function getBarColor(changePercent: number): string {
  if (changePercent > 1) return "var(--terminal-green)";
  if (changePercent > 0) return "var(--sector-green-mid)";
  if (changePercent > -1) return "var(--sector-red-mid)";
  return "var(--terminal-red)";
}

export function SectorHeatmap({ sectors }: SectorHeatmapProps) {
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.changePercent)), 0.5);

  return (
    <div
      className="rounded-lg p-4 border h-full"
      style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
      data-testid="sector-heatmap"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold tracking-wider uppercase opacity-70">Daily Sector Performance</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--terminal-green)" }} />
            <span className="opacity-40">Leaders</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--terminal-red)" }} />
            <span className="opacity-40">Laggards</span>
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {sectors.map((sector, idx) => {
          const barWidth = Math.abs(sector.changePercent) / maxAbs * 100;
          const isPositive = sector.changePercent >= 0;
          const isLeader = idx < 3;
          const isLaggard = idx >= sectors.length - 3;

          return (
            <div key={sector.symbol} className="flex items-center gap-2 text-xs" data-testid={`sector-${sector.symbol}`}>
              {/* Label */}
              <div className="w-16 flex-shrink-0 flex items-center gap-1">
                <span className="font-bold opacity-70">{sector.symbol}</span>
                {isLeader && (
                  <span style={{ color: "var(--terminal-green)", fontSize: "10px" }}>★</span>
                )}
                {isLaggard && (
                  <span style={{ color: "var(--terminal-red)", fontSize: "10px" }}>▾</span>
                )}
              </div>

              {/* Bar */}
              <div className="flex-1 relative h-5 rounded overflow-hidden" style={{ background: "var(--sector-bar-bg)" }}>
                <div
                  className="absolute top-0 h-full rounded transition-all duration-500"
                  style={{
                    width: `${Math.max(barWidth, 2)}%`,
                    background: getBarColor(sector.changePercent),
                    left: isPositive ? "0" : undefined,
                    right: !isPositive ? "0" : undefined,
                    opacity: 0.6,
                  }}
                />
                <div className="absolute inset-0 flex items-center px-2 justify-between">
                  <span className="opacity-40 text-xs truncate">{sector.name}</span>
                  <span
                    className="font-bold text-xs"
                    style={{ color: getBarColor(sector.changePercent) }}
                  >
                    {sector.changePercent > 0 ? "+" : ""}{sector.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
