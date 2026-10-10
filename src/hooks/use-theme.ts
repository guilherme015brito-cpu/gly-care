import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "glycare-theme";
const COLOR_KEY = "glycare-accent";
export const ACCENTS = [
  { name: "Verde cuidado", value: "#087F79" },
  { name: "Azul", value: "#2463C9" },
  { name: "Violeta", value: "#7750B2" },
  { name: "Rosa", value: "#B43E68" },
  { name: "Grafite", value: "#445463" },
];

function applyAccent(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  const root = document.documentElement;
  const channels = [1, 3, 5].map((i) => {
    const channel = parseInt(color.slice(i, i + 2), 16);
    return root.classList.contains("dark") ? Math.round(channel * 0.65 + 255 * 0.35) : channel;
  });
  const effectiveColor = "#" + channels.map((v) => v.toString(16).padStart(2, "0")).join("");
  const luminance = channels
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);
  root.style.setProperty("--primary", effectiveColor);
  root.style.setProperty("--ring", effectiveColor);
  root.style.setProperty("--chart-1", effectiveColor);
  root.style.setProperty("--primary-foreground", luminance > 0.179 ? "#111111" : "#ffffff");
  root.style.setProperty(
    "--primary-soft",
    `color-mix(in srgb, ${effectiveColor} 11%, var(--card))`,
  );
}

export function applyStoredTheme() {
  const t = localStorage.getItem(KEY);
  const dark = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
  applyAccent(localStorage.getItem(COLOR_KEY) ?? ACCENTS[0]!.value);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  const [accent, setAccentState] = useState(ACCENTS[0]!.value);
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    setAccentState(localStorage.getItem(COLOR_KEY) ?? ACCENTS[0]!.value);
  }, []);
  const set = (t: Theme) => {
    localStorage.setItem(KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
    applyAccent(accent);
    setTheme(t);
  };
  const setAccent = (color: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    localStorage.setItem(COLOR_KEY, color);
    applyAccent(color);
    setAccentState(color);
  };
  return { theme, setTheme: set, accent, setAccent };
}
