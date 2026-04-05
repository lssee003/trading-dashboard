import type { MarketQuote } from "@shared/schema";

interface TickerBarProps {
  tickers: MarketQuote[];
}

export function TickerBar({ tickers }: TickerBarProps) {
  const items = tickers.filter(t => t.price > 0);

  return (
    <div className="overflow-hidden py-1.5 px-2" style={{ background: "var(--ticker-bg)" }}>
      <div className="ticker-animate flex gap-6 whitespace-nowrap" style={{ width: "max-content" }}>
        {/* Duplicate for seamless loop */}
        {[...items, ...items].map((ticker, idx) => (
          <TickerItem key={`${ticker.symbol}-${idx}`} ticker={ticker} />
        ))}
      </div>
    </div>
  );
}

function TickerItem({ ticker }: { ticker: MarketQuote }) {
  const isPositive = ticker.change >= 0;
  const color = ticker.change === 0 ? "var(--terminal-dim)" : isPositive ? "var(--terminal-green)" : "var(--terminal-red)";
  const arrow = ticker.change > 0 ? "▲" : ticker.change < 0 ? "▼" : "●";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs" data-testid={`ticker-${ticker.symbol}`}>
      <span className="font-bold opacity-70">{ticker.symbol}</span>
      <span style={{ color }}>{ticker.price.toFixed(2)}</span>
      <span style={{ color, fontSize: "10px" }}>
        {arrow} {Math.abs(ticker.changePercent).toFixed(2)}%
      </span>
    </span>
  );
}
