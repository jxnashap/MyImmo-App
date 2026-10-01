"use client";

// Die Glas-Leiste der Reiter — mit dem offenen Reiter in der Mitte
// (01.10.2026, Vorgabe des Betreibers). Beim Laden sofort (vor dem ersten
// Anstrich, kein Springen), bei jedem Wechsel weich nachgeführt. Oberhalb von
// 860 px scrollt die Leiste nicht; dann ist nichts zu tun.
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { zentrierVersatz } from "@/lib/glasLeiste";

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
    const left = zentrierVersatz({
      scrollBreite: bar.scrollWidth, sichtBreite: bar.clientWidth, reiterLinks: el.offsetLeft, reiterBreite: el.offsetWidth,
    });
    const sofort = erstesMal.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    erstesMal.current = false;
    bar.scrollTo({ left, behavior: sofort ? "auto" : "smooth" });
  }, [aktiv]);

  return (
    <nav ref={leiste} className="glass-bar" aria-label={label} style={style}>
      {children}
    </nav>
  );
}
