import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ThemeContext = createContext(null);

export const THEMES = ["light", "dark", "ps5", "steam", "pro", "custom"];
export const STORAGE_KEY = "budsin_site_theme";
export const CUSTOM_KEY = "budsin_custom_theme";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY) || "light";
      return THEMES.includes(t) ? t : "light";
    } catch (e) {
      return "light";
    }
  });
  const [custom, setCustom] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}");
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-site-theme", theme);
    root.style.colorScheme = theme === "light" || theme === "custom" ? "light" : "dark";
    if (theme === "custom") {
      root.style.setProperty("--custom-primary", custom.primary || "#6366f1");
      root.style.setProperty("--custom-secondary", custom.secondary || "#a855f7");
      root.style.setProperty("--custom-accent", custom.accent || "#22d3ee");
      root.style.setProperty("--custom-bg", custom.bg || "#0f172a");
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
  }, [theme, custom]);

  const applyTheme = useCallback((next) => {
    setTheme(THEMES.includes(next) ? next : "light");
  }, []);

  const updateCustom = useCallback(
    (patch) => {
      const next = { ...custom, ...patch };
      setCustom(next);
      try {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      } catch (e) {}
    },
    [custom]
  );

  const cycle = useCallback(() => {
    const order = ["light", "dark", "ps5", "steam"];
    const current = theme === "pro" || theme === "custom" ? "dark" : theme;
    const next = order[(order.indexOf(current) + 1) % order.length];
    applyTheme(next);
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, applyTheme, cycle, custom, updateCustom }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
