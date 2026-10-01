"use client";

// Die Glas-Leiste der Reiter — mit dem offenen Reiter in der Mitte
// (01.10.2026, Vorgabe des Betreibers). Beim Laden sofort (vor dem ersten
// Anstrich, kein Springen), bei jedem Wechsel weich nachgeführt. Oberhalb von
// 860 px scrollt die Leiste nicht; dann ist nichts zu tun.
//
// Gekoppelt mit dem Wischen: `WISCH_EREIGNIS` nennt den Link des Reiters, zu
// dem der Inhalt gerade gleitet — die Leiste markiert ihn SOFORT und rückt
// ihn in die Mitte, parallel zum Gleiten. Vorher wartete sie auf die
// Serverantwort („dauert viel zu lange"). Ein Link, der nicht in dieser
// Leiste steht (verschachtelte Portal-Ansicht), wird ignoriert.
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { zentrierVersatz } from "@/lib/glasLeiste";
import { WISCH_EREIGNIS } from "@/components/WischReiter";

function zentriere(bar: HTMLElement, el: HTMLElement, sofort: boolean) {
  const left = zentrierVersatz({
    scrollBreite: bar.scrollWidth, sichtBreite: bar.clientWidth, reiterLinks: el.offsetLeft, reiterBreite: el.offsetWidth,
  });
  const ruhig = sofort || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  bar.scrollTo({ left, behavior: ruhig ? "auto" : "smooth" });
}

export default function GlassLeiste({ aktiv, label, style, children }: {
  /** Schlüssel des offenen Reiters — ändert er sich, wird nachgeführt. */
  aktiv: string;
  label: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const leiste = useRef<HTMLElement>(null);
  const erstesMal = useRef(true);

  useLayoutEffect(() => {
    const bar = leiste.current;
    const el = bar?.querySelector<HTMLElement>(".glass-item.active");
    if (!bar || !el) return;
    zentriere(bar, el, erstesMal.current);
    erstesMal.current = false;
  }, [aktiv]);

  useEffect(() => {
    const bar = leiste.current;
    if (!bar) return;
    const aufWisch = (e: Event) => {
      const href = (e as CustomEvent<{ href: string }>).detail?.href;
      const ziel = href ? Array.from(bar.querySelectorAll<HTMLAnchorElement>("a.glass-item")).find((a) => a.getAttribute("href") === href) : undefined;
      if (!ziel) return;
      for (const a of bar.querySelectorAll(".glass-item.active")) a.classList.remove("active");
      ziel.classList.add("active");
      zentriere(bar, ziel, false);
    };
    document.addEventListener(WISCH_EREIGNIS, aufWisch);
    return () => document.removeEventListener(WISCH_EREIGNIS, aufWisch);
  }, []);

  return (
    <nav ref={leiste} className="glass-bar" aria-label={label} style={style}>
      {children}
    </nav>
  );
}
