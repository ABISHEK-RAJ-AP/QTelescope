import * as React from "react";

const STORAGE_KEY = "qtelescope-theme";

const ThemeContext = React.createContext(undefined);

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeClass(theme) {
  const root = document.documentElement;
  root.classList.remove("dark");
  const resolved = theme === "system" ? getSystemTheme() : theme;
  if (resolved === "dark") {
    root.classList.add("dark");
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = STORAGE_KEY,
}) {
  const [theme, setThemeState] = React.useState(() => {
    if (typeof window === "undefined") return defaultTheme;
    const stored = localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    return defaultTheme;
  });

  const [resolved, setResolved] = React.useState(() =>
    theme === "system" ? getSystemTheme() : theme
  );

  React.useEffect(() => {
    applyThemeClass(theme);
    setResolved(theme === "system" ? getSystemTheme() : theme);
  }, [theme]);

  React.useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyThemeClass("system");
      setResolved(getSystemTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback(
    (next) => {
      localStorage.setItem(storageKey, next);
      setThemeState(next);
    },
    [storageKey]
  );

  const value = React.useMemo(
    () => ({ theme, setTheme, resolved }),
    [theme, setTheme, resolved]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
