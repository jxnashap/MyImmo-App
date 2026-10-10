"use client";

import { Moon, Sun } from "lucide-react";

// Hell/Dunkel umschalten. Symbol und Beschriftung folgen dem Theme per CSS (`.tt-hell`/`.tt-dunkel`
// in globals.css, gesteuert über `data-theme` bzw. die Systemeinstellung) — nicht über einen
// React-Zustand. Vorher stand bis zur Hydration immer der Mond da, auch im hellen Modus
// (Gesamtprüfung C14), weil der Server das Theme nicht kennt. Das Umschalten liest den
// Zustand deshalb direkt am <html>, nicht aus einem Zustand, der nach dem Laden erst nachzieht.
function aktuellesTheme(): "dark" | "light" {
  const gesetzt = document.documentElement.getAttribute("data-theme");
  if (gesetzt === "dark" || gesetzt === "light") return gesetzt;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function umschalten() {
  const naechstes = aktuellesTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", naechstes);
  try {
    localStorage.setItem("theme", naechstes);
  } catch {
    /* ignore */
  }
}

export default function ThemeToggle({ variant = "full" }: { variant?: "full" | "icon" }) {
  if (variant === "icon") {
    return (
      <button type="button" onClick={umschalten} title="Hell/Dunkel" aria-label="Hell-/Dunkelmodus umschalten" className="theme-knopf">
        <span className="tt-dunkel"><Moon size={14} /></span>
        <span className="tt-hell"><Sun size={14} /></span>
      </button>
    );
  }

  return (
    <button type="button" onClick={umschalten} className="btn btn-ghost" title="Hell/Dunkel">
      <span className="tt-dunkel"><Moon size={14} style={{ verticalAlign: "-2px" }} /> Heller Modus</span>
      <span className="tt-hell"><Sun size={14} style={{ verticalAlign: "-2px" }} /> Dunkler Modus</span>
    </button>
  );
}
