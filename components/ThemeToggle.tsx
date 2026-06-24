"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved =
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("theme") as Theme | null)) ||
      (document.documentElement.getAttribute("data-theme") as Theme | null) ||
      "dark";
    setTheme(saved);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
      title={theme === "dark" ? "Heller Modus" : "Dunkler Modus"}
      aria-label="Hell-/Dunkelmodus umschalten"
    >
      <span className="w-4 text-center text-white/40">{theme === "dark" ? "☀" : "☾"}</span>
      {theme === "dark" ? "Heller Modus" : "Dunkler Modus"}
    </button>
  );
}
