"use client";

import { useEffect, useRef } from "react";

/**
 * Fokus-Verwaltung für modale Dialoge — die drei Dinge, die in der App überall
 * fehlten und ohne die ein Modal für Tastatur- und Screenreader-Nutzer kaputt ist:
 *
 * 1. **Anfangsfokus.** Nach dem Öffnen stand der Fokus weiter auf dem Auslöser
 *    *hinter* dem Overlay. Wer nicht sieht, dass sich etwas geöffnet hat, merkt
 *    es schlicht nicht.
 * 2. **Fokus-Falle.** Tab lief aus dem Dialog heraus in die Seite dahinter —
 *    man tabbte durch die Navigation, während der Dialog offen blieb, und kam
 *    nicht mehr zum „Speichern".
 * 3. **Fokus-Rückgabe.** Beim Schließen landete der Fokus auf `<body>`; der
 *    nächste Tab begann wieder ganz oben in der Seitenleiste, statt dort, wo
 *    man war.
 *
 * Zusätzlich: Escape schließt, und der Hintergrund wird für Screenreader per
 * `aria-hidden` stummgeschaltet (sonst liest er den Dialog UND die Seite
 * dahinter vor — `aria-modal` allein genügt in der Praxis nicht).
 *
 * `aktiv` MUSS mitgegeben werden, wenn der Dialog bedingt gerendert wird
 * (`{offen && <div …>}`) oder erst nach einem Portal-Mount erscheint. Sonst
 * läuft der Effekt ein einziges Mal — mit noch leerer Ref — und danach nie
 * wieder: der Dialog hätte weder Falle noch Fokus. Der Haken ist unsichtbar,
 * weil optisch alles richtig aussieht.
 *
 * Rückgabe: `ref` auf das Element, das den Dialog umschließt.
 */
export function useModalFokus<T extends HTMLElement>(onClose: () => void, aktiv = true) {
  const ref = useRef<T>(null);
  // In einer Ref, damit ein neu erzeugtes onClose den Effekt nicht neu startet
  // und dabei den Fokus zurücksetzt.
  const schliessen = useRef(onClose);
  schliessen.current = onClose;

  useEffect(() => {
    if (!aktiv) return;
    const behaelter = ref.current;
    if (!behaelter) return;

    const vorher = document.activeElement as HTMLElement | null;

    const fokussierbare = () =>
      Array.from(
        behaelter.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Anfangsfokus auf den Dialog selbst (er braucht dafür tabIndex={-1}):
    // Screenreader lesen dann Rolle und Namen des Dialogs vor. Ginge der Fokus
    // gleich auf das erste Bedienelement, wäre das meist der Schließen-Knopf —
    // und angesagt würde „Schließen, Schaltfläche", ohne dass jemand erfährt,
    // was sich überhaupt geöffnet hat.
    // `data-autofokus` auf einem Element überschreibt das gezielt.
    const gewuenscht = behaelter.querySelector<HTMLElement>("[data-autofokus]");
    (gewuenscht ?? behaelter).focus({ preventScroll: true });

    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        schliessen.current();
        return;
      }
      if (e.key !== "Tab") return;
      const liste = fokussierbare();
      if (liste.length === 0) {
        e.preventDefault();
        return;
      }
      const erstes = liste[0];
      const letztes = liste[liste.length - 1];
      const aktivesElement = document.activeElement;
      // Umlaufen statt Ausbrechen — in beide Richtungen.
      if (!e.shiftKey && aktivesElement === letztes) {
        e.preventDefault();
        erstes.focus();
      } else if (e.shiftKey && (aktivesElement === erstes || aktivesElement === behaelter)) {
        e.preventDefault();
        letztes.focus();
      } else if (!behaelter.contains(aktivesElement)) {
        // Fokus ist (etwa per Mausklick) nach draußen geraten: zurückholen.
        e.preventDefault();
        erstes.focus();
      }
    };

    document.addEventListener("keydown", beiTaste, true);

    // Hintergrund für Screenreader ausblenden. Nur direkte Geschwister des
    // Dialog-Wurzelknotens — so bleibt der Dialog selbst lesbar.
    const wurzel = behaelter.closest("body > *") ?? behaelter;
    const versteckt: HTMLElement[] = [];
    Array.from(document.body.children).forEach((kind) => {
      if (kind === wurzel || kind.getAttribute("aria-hidden") === "true") return;
      (kind as HTMLElement).setAttribute("aria-hidden", "true");
      versteckt.push(kind as HTMLElement);
    });

    const scrollVorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", beiTaste, true);
      versteckt.forEach((el) => el.removeAttribute("aria-hidden"));
      document.body.style.overflow = scrollVorher;
      // Nur zurückgeben, wenn das Element noch existiert — nach einem Löschen
      // ist die Zeile, aus der der Dialog kam, oft weg.
      if (vorher && document.contains(vorher)) vorher.focus({ preventScroll: true });
    };
  }, [aktiv]);

  return ref;
}
