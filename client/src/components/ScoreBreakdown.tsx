import type { CategoryScore } from "@shared/schema";

interface ScoreBreakdownProps {
  categories: CategoryScore[];
  totalScore: number;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "var(--terminal-green)";
  if (score >= 50) return "var(--terminal-amber)";
  return "var(--terminal-red)";
}

export function ScoreBreakdown({ categories, totalScore }: ScoreBreakdownProps) {
  return (
    <div
      className="rounded-lg p-4 border h-full glass-panel"
      style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
      data-testid="score-breakdown"
    >
      <h3 className="text-xs font-bold tracking-wider uppercase mb-4 section-header-scan rounded-sm px-1.5 py-1 -mx-1.5 -mt-1" style={{ color: 'var(--text-secondary)' }}>Scoring Breakdown</h3>

      <div className="space-y-3">
        {categories.map((cat) => {
          const contribution = Math.round(cat.score * cat.weight / 100);
          const maxContribution = cat.weight;
          const fillPct = (contribution / maxContribution) * 100;

          return (
            <div key={cat.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{cat.name}</span>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-faint)' }}>{cat.weight}% ×</span>
                  <span className="font-bold" style={{ color: getScoreColor(cat.score) }}>
                    {cat.score}
                  </span>
                  <span style={{ color: 'var(--text-faint)' }}>=</span>
                  <span className="font-bold" style={{ color: getScoreColor(cat.score) }}>
                    {contribution}
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bar-track)" }}>
                <div
                  className="glass-bar h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${fillPct}%`,
                    background: getScoreColor(cat.score),
                    "--bar-color": getScoreColor(cat.score),
                    "--bar-span": fillPct,
                  } as React.CSSProperties}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--terminal-border)" }}>
        <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>TOTAL SCORE</span>
        <span className="text-2xl font-black" style={{ color: getScoreColor(totalScore) }}>
          {totalScore}
        </span>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--terminal-green)" }} />
          <span style={{ color: 'var(--text-muted)' }}>80+ YES</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--terminal-amber)" }} />
          <span style={{ color: 'var(--text-muted)' }}>60-79 CAUTION</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--terminal-red)" }} />
          <span style={{ color: 'var(--text-muted)' }}>&lt;60 NO</span>
        </div>
      </div>
    </div>
  );
}
