import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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
    // No persisted preference — use auto time-of-day
    return getAutoTheme();
  });

  // On first render, check if there was a persisted choice (means user manually chose before)
  const [hadPersisted] = useState(() => {
    const p = readPersisted();
    return p === "light" || p === "dark";
  });

  // Apply the theme class whenever theme changes
  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  // Auto time-of-day switching — only active when user hasn't manually toggled
  useEffect(() => {
    if (manuallySet || hadPersisted) return;

    // Check every 60 seconds
    const interval = setInterval(() => {
      const autoTheme = getAutoTheme();
      setTheme(autoTheme);
    }, 60_000);

    return () => clearInterval(interval);
  }, [manuallySet, hadPersisted]);

  const toggleTheme = useCallback(() => {
    setManuallySet(true);
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      writePersisted(next);
      return next;
    });
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
