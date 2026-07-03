import { AlertTriangle } from "lucide-react";

interface AlertBannerProps {
  alerts: string[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden px-4 py-2 flex items-center gap-3 text-xs glass-panel glass-tint"
      style={{
        background: "var(--alert-amber-bg)",
        borderBottom: "1px solid var(--alert-amber-border)",
      }}
      data-testid="alert-banner"
    >
      {/* Amber light field (glass only) — same construction as the hero */}
      <div
        className="hero-lights"
        aria-hidden="true"
        style={{ "--blob-color": "var(--terminal-amber)" } as React.CSSProperties}
      >
        <span className="hero-blob hero-blob-a" />
        <span className="hero-blob hero-blob-b" />
      </div>
      <AlertTriangle className="relative z-10 w-4 h-4 flex-shrink-0" style={{ color: "var(--terminal-amber)" }} />
      <div className="relative z-10 flex items-center gap-4">
        {alerts.map((alert, idx) => (
          <span key={idx} className="font-medium" style={{ color: "var(--terminal-amber)" }}>
            ⚠ {alert}
          </span>
        ))}
      </div>
    </div>
  );
}
