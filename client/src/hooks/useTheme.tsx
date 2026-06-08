import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { flushSync } from "react-dom";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isAutoMode: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Module-level variable for in-memory theme persistence (browser storage is blocked in sandboxed iframes) */
let persistedTheme: string | null = null;

function readPersisted(): string | null {
  return persistedTheme;
}

function writePersisted(value: string) {
  persistedTheme = value;
}

/** Returns the auto theme based on the user's local time: dark 18:00–07:00, light 07:00–18:00 */
function getAutoTheme(): Theme {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 18 ? "light" : "dark";
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [manuallySet, setManuallySet] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const persisted = readPersisted();
    if (persisted === "light" || persisted === "dark") {
      return persisted;
    }
    return getAutoTheme();
  });

  const [hadPersisted] = useState(() => {
    const p = readPersisted();
    return p === "light" || p === "dark";
  });

  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  // Auto time-of-day switching
  useEffect(() => {
    if (manuallySet || hadPersisted) return;
    const interval = setInterval(() => {
      setTheme(getAutoTheme());
    }, 60_000);
    return () => clearInterval(interval);
  }, [manuallySet, hadPersisted]);

  const toggleTheme = useCallback(() => {
    setManuallySet(true);

    const next = themeRef.current === "dark" ? "light" : "dark";

    // Use View Transitions API for a smooth cross-fade morph between themes.
    // Falls back to instant swap if unsupported (Firefox) or reduced motion.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (
      doc.startViewTransition &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const transition = doc.startViewTransition(() => {
        // flushSync forces React to commit the DOM update synchronously
        // so the View Transition API can diff old vs new snapshots correctly
        flushSync(() => {
          applyThemeClass(next);
          setTheme(next);
        });
      });
      transition.finished.catch(() => {});
      writePersisted(next);
    } else {
      applyThemeClass(next);
      setTheme(next);
      writePersisted(next);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isAutoMode: !manuallySet && !hadPersisted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
