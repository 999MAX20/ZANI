import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ZaniTheme = "light" | "dark";

const THEME_KEY = "zani_workspace_theme";

type ThemeContextValue = {
  theme: ZaniTheme;
  setTheme: (theme: ZaniTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): ZaniTheme {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ZaniTheme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.zaniTheme = theme;
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => {
    function setTheme(nextTheme: ZaniTheme) {
      localStorage.setItem(THEME_KEY, nextTheme);
      setThemeState(nextTheme);
    }

    return {
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    };
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
