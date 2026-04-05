import { AlertTriangle } from "lucide-react";

interface AlertBannerProps {
  alerts: string[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="px-4 py-2 flex items-center gap-3 text-xs"
      style={{
        background: "var(--alert-amber-bg)",
        borderBottom: "1px solid var(--alert-amber-border)",
      }}
      data-testid="alert-banner"
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--terminal-amber)" }} />
      <div className="flex items-center gap-4">
        {alerts.map((alert, idx) => (
          <span key={idx} className="font-medium" style={{ color: "var(--terminal-amber)" }}>
            ⚠ {alert}
          </span>
        ))}
      </div>
    </div>
  );
}
