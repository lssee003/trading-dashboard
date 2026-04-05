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
      className="rounded-lg p-4 border h-full"
      style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
      data-testid="score-breakdown"
    >
      <h3 className="text-xs font-bold tracking-wider uppercase opacity-70 mb-4">Scoring Breakdown</h3>

      <div className="space-y-3">
        {categories.map((cat) => {
          const contribution = Math.round(cat.score * cat.weight / 100);
          const maxContribution = cat.weight;
          const fillPct = (contribution / maxContribution) * 100;

          return (
            <div key={cat.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium opacity-60">{cat.name}</span>
                <div className="flex items-center gap-2">
                  <span className="opacity-30">{cat.weight}% ×</span>
                  <span className="font-bold" style={{ color: getScoreColor(cat.score) }}>
                    {cat.score}
                  </span>
                  <span className="opacity-30">=</span>
                  <span className="font-bold" style={{ color: getScoreColor(cat.score) }}>
                    {contribution}
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bar-track)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${fillPct}%`,
                    background: getScoreColor(cat.score),
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--terminal-border)" }}>
        <span className="text-sm font-bold opacity-70">TOTAL SCORE</span>
        <span className="text-2xl font-black" style={{ color: getScoreColor(totalScore) }}>
          {totalScore}
        </span>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--terminal-green)" }} />
          <span className="opacity-40">80+ YES</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--terminal-amber)" }} />
          <span className="opacity-40">60-79 CAUTION</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--terminal-red)" }} />
          <span className="opacity-40">&lt;60 NO</span>
        </div>
      </div>
    </div>
  );
}
