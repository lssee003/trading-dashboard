import { Brain, AlertTriangle } from "lucide-react";
import type { TerminalAnalysis } from "@shared/schema";

const SIGNAL_COLORS: Record<string, string> = {
  bullish: "var(--terminal-green)",
  bearish: "var(--terminal-red)",
  neutral: "var(--terminal-amber)",
};

const REGIME_COLORS: Record<string, string> = {
  GREEN: "var(--terminal-green)",
  AMBER: "var(--terminal-amber)",
  RED: "var(--terminal-red)",
};

interface AnalysisPanelProps {
  summary: string;
  dataSource: string;
  terminalAnalysis?: TerminalAnalysis;
}

export function AnalysisPanel({ summary, dataSource, terminalAnalysis }: AnalysisPanelProps) {
  if (!terminalAnalysis) {
    return (
      <div
        className="rounded-lg p-4 border h-full flex flex-col"
        style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
        data-testid="analysis-panel"
      >
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-3.5 h-3.5" style={{ color: "var(--terminal-cyan)" }} />
          <h3 className="text-xs font-bold tracking-wider uppercase" style={{ color: "var(--terminal-cyan)" }}>
            Terminal Analysis
          </h3>
        </div>
        <p className="text-sm leading-relaxed opacity-75">{summary}</p>
        <div className="mt-auto pt-3 text-xs opacity-30" style={{ borderTop: "1px solid var(--terminal-border)" }}>
          {dataSource}
        </div>
      </div>
    );
  }

  const { regime, narrative, stance, bounceAlert } = terminalAnalysis;
  const regimeColor = REGIME_COLORS[regime.signal];

  return (
    <div
      className="rounded-lg p-3 border h-full flex flex-col"
      style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
      data-testid="analysis-panel"
    >
      {/* Header + Regime */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5" style={{ color: "var(--terminal-cyan)" }} />
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: "var(--terminal-cyan)" }}>
            Terminal Analysis
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full pulse-live"
            style={{ background: regimeColor }}
          />
          <span className="text-xs font-black tracking-wide" style={{ color: regimeColor }}>
            {regime.label}
          </span>
        </div>
      </div>

      {/* Narrative */}
      <div className="flex-1 mb-2.5">
        <p className="text-[11px] leading-[1.6] opacity-80">{narrative}</p>
      </div>

      {/* Bounce alert */}
      {bounceAlert && (
        <div
          className="flex items-start gap-1.5 rounded px-2 py-1.5 mb-2.5 text-[10px] leading-[1.5]"
          style={{
            background: "var(--alert-amber-bg)",
            border: "1px solid var(--alert-amber-border)",
            color: "var(--terminal-amber)",
          }}
        >
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "var(--terminal-amber)" }} />
          <span>{bounceAlert}</span>
        </div>
      )}

      {/* Stance */}
      <div
        className="flex items-center gap-2 pt-2 mt-auto"
        style={{ borderTop: "1px solid var(--terminal-border)" }}
      >
        <span className="text-[9px] font-bold tracking-wider opacity-40">STANCE</span>
        <span
          className="text-[10px] font-bold"
          style={{ color: regimeColor }}
        >
          {stance}
        </span>
      </div>
    </div>
  );
}
