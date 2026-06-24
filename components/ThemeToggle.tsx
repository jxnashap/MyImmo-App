"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export default function ThemeToggle({ variant = "full" }: { variant?: "full" | "icon" }) {
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

  if (variant === "icon") {
    return (
      <button
        onClick={toggle}
        title="Hell/Dunkel"
        aria-label="Hell-/Dunkelmodus umschalten"
        style={{
          background: "none",
          border: "1px solid var(--line2)",
          borderRadius: 20,
          cursor: "pointer",
          padding: "4px 10px",
          fontSize: 14,
          lineHeight: 1,
          color: "var(--muted)",
        }}
      >
        {theme === "dark" ? "🌙" : "☀️"}
      </button>
    );
  }

  return (
    <button onClick={toggle} className="btn btn-ghost" title="Hell/Dunkel">
      {theme === "dark" ? "🌙 Heller Modus" : "☀️ Dunkler Modus"}
    </button>
  );
}
