import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "huddle-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function useTheme() {
  // The pre-render script in index.html applies the theme before React mounts.
  // Reading it back keeps the first render in sync and avoids a flash.
  const [theme, setTheme] = useState<Theme>(() => {
    const applied = document.documentElement.dataset.theme;
    return applied === "light" || applied === "dark" ? applied : systemTheme();
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#161513" : "#f7f4ee";
  }, [theme]);

  // Follow the system until the reader makes an explicit choice.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (!storedTheme()) setTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable in private browsing; the toggle still works.
    }
    setTheme(next);
  }

  return { theme, toggleTheme };
}
