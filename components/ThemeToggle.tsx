"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

export default function ThemeToggle({ variant = "full" }: { variant?: "full" | "icon" }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved =
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("theme") as Theme | null)) ||
      (document.documentElement.getAttribute("data-theme") as Theme | null);
    if (saved) {
      setTheme(saved);
      return;
    }
    // Weder localStorage noch data-theme gesetzt: Standard ist jetzt HELL
    // (Quiet Luxury), dunkel nur wenn das OS Dunkel bevorzugt — exakt wie die
    // CSS-Regel :root:not([data-theme]) + @media(prefers-color-scheme:dark).
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
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
        {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
      </button>
    );
  }

  return (
    <button onClick={toggle} className="btn btn-ghost" title="Hell/Dunkel">
      {theme === "dark" ? <><Moon size={14} style={{ verticalAlign: "-2px" }} /> Heller Modus</> : <><Sun size={14} style={{ verticalAlign: "-2px" }} /> Dunkler Modus</>}
    </button>
  );
}
