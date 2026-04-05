import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  text: string;
  title?: string;
  children: ReactNode;
}

export function Tooltip({ text, title, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.top + window.scrollY,
      left: rect.left + rect.width / 2,
    });
  }, []);

  // Position the tooltip and keep it within viewport
  useEffect(() => {
    if (!visible || !tipRef.current) return;
    const tip = tipRef.current;
    const tipRect = tip.getBoundingClientRect();
    // Nudge horizontally if overflowing
    if (tipRect.left < 8) {
      tip.style.transform = `translateX(${-tipRect.left + 8}px)`;
    } else if (tipRect.right > window.innerWidth - 8) {
      tip.style.transform = `translateX(${window.innerWidth - 8 - tipRect.right}px)`;
    }
  }, [visible, pos]);

  return (
    <span
      ref={anchorRef}
      className="inline-flex items-center cursor-help"
      onMouseEnter={() => { updatePosition(); setVisible(true); }}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && createPortal(
        <span
          ref={tipRef}
          className="fixed z-[9999] rounded-md text-left pointer-events-none"
          style={{
            top: pos.top - 10,
            left: pos.left,
            transform: "translate(-50%, -100%)",
            width: "240px",
            padding: "10px 12px",
            fontSize: "10.5px",
            lineHeight: "1.55",
            fontFamily: "inherit",
            letterSpacing: "0.01em",
            background: "var(--terminal-surface)",
            border: "1px solid var(--terminal-border)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          {title && (
            <span
              style={{
                display: "block",
                fontWeight: 700,
                color: "var(--terminal-cyan)",
                marginBottom: "4px",
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {title}
            </span>
          )}
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
