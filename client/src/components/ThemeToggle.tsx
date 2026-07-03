import { Sun, Moon, Droplets } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

/** Icon shows the theme the click switches TO: light → dark → glass → light */
const NEXT_THEME = {
  light: { icon: Moon, title: "Switch to dark mode" },
  dark: { icon: Droplets, title: "Switch to liquid glass" },
  glass: { icon: Sun, title: "Switch to light mode" },
} as const;

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = NEXT_THEME[theme];
  const Icon = next.icon;

  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100"
      data-testid="button-theme-toggle"
      title={next.title}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
