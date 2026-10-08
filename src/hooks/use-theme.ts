import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "glycare-theme";

export function applyStoredTheme() {
  const t = localStorage.getItem(KEY);
  const dark = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);
  const set = (t: Theme) => {
    localStorage.setItem(KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
    setTheme(t);
  };
  return { theme, setTheme: set };
}
