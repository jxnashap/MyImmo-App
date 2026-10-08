"use client";

import { useEffect } from "react";
import { DEMO_MERKMAL } from "@/lib/demoFehler";

/**
 * Macht die App im Demo-Konto schreibgeschützt — die sichtbare Ebene der
 * Demo-Sperre.
 *
 * **Warum das nötig ist, obwohl die Datenbank schon sperrt:** Ein per
 * restriktiver RLS-Policy blockiertes UPDATE oder DELETE wirft *keinen* Fehler,
 * es trifft schlicht null Zeilen (nachgemessen am 30.08.2026; nur INSERT meldet
 * sich mit „violates row-level security policy"). Ohne diese Komponente klickt
 * der Besucher auf „Speichern", bekommt keine Rückmeldung und glaubt, es sei
 * gespeichert. Das ist schlechter als eine ehrliche Sperre.
 *
 * Gegenstück: `lib/demo.ts` (Routen) und Migration `20260830150000` (Datenbank).
 *
 * Umgesetzt über einen MutationObserver — dasselbe Muster wie
 * `components/LabelVerknuepfung.tsx`, weil viele Formulare erst nach einer
 * Interaktion im DOM erscheinen (Dialoge, aufklappbare Abschnitte).
 *
 * **Ausnahmen:** Alles innerhalb eines Elements mit `data-demo-erlaubt` bleibt
 * bedienbar (Brief-Generator, PDF-Formulare, Vorschau-Wahl …). Seit P5/B26 außerdem
 * jedes Feld außerhalb eines absendenden Formulars — siehe `schreibFormular`.
 */
export default function DemoNurLesen() {
  useEffect(() => {
    const HINWEIS = "In der Demo nicht bearbeitbar. Nach der Anmeldung verfügbar.";
    // Merkmal für den Toast: Fehler beim Speichern bekommen in der Demo die Erklärung angehängt
    // (lib/demoFehler.ts → mitDemoHinweis, Audit P5 B54).
    document.documentElement.dataset[DEMO_MERKMAL] = "1";

    function erlaubt(el: Element): boolean {
      return !!el.closest("[data-demo-erlaubt]");
    }

    // Seit 08.10.2026 (Audit P5, B26): Gesperrt werden nur Felder in einem Formular, das etwas
    // ABSENDET. Vorher war JEDES Feld schreibgeschützt — auch Suche, Befehlspalette, Steuerjahr,
    // AfA-, Marktwert- und Verkaufsrechner, die nichts speichern. Gerade die Rechner sind das
    // Verkaufsargument der Demo. Ein Formular mit method="get" (Filter) speichert ebenfalls nichts.
    // Schreibknöpfe AUSSERHALB von Formularen tragen `data-demo-sperre` (DemoSperre erklärt sie);
    // was dann noch durchrutscht, scheitert an der Datenbank und erklärt sich im Toast.
    function schreibFormular(el: Element): boolean {
      const f = el.closest("form");
      return !!f && (f.getAttribute("method") ?? "").toLowerCase() !== "get";
    }

    function sperren(wurzel: ParentNode) {
      // Textfelder: readOnly statt disabled — disabled graut den Text aus und
      // macht die Beispieldaten schlechter lesbar. Genau die soll man ja sehen.
      wurzel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input:not([data-demo-gesperrt]), textarea:not([data-demo-gesperrt])",
      ).forEach((el) => {
        if (erlaubt(el) || !schreibFormular(el)) return;
        el.dataset.demoGesperrt = "1";
        const typ = (el as HTMLInputElement).type;
        if (typ === "checkbox" || typ === "radio" || typ === "file" || typ === "range") {
          // readOnly wirkt bei diesen Typen nicht — hier hilft nur disabled.
          (el as HTMLInputElement).disabled = true;
        } else {
          el.readOnly = true;
        }
        el.setAttribute("aria-readonly", "true");
        el.title = HINWEIS;
      });

      // Auswahlfelder kennen kein readOnly.
      wurzel.querySelectorAll<HTMLSelectElement>("select:not([data-demo-gesperrt])").forEach((el) => {
        if (erlaubt(el) || !schreibFormular(el)) return;
        el.dataset.demoGesperrt = "1";
        el.disabled = true;
        el.title = HINWEIS;
      });

      // Nur ABSENDENDE Knöpfe. Alles pauschal zu sperren würde Tabs,
      // Aufklapper und die Navigation mit lahmlegen — die Demo soll man ja
      // durchklicken können.
      wurzel.querySelectorAll<HTMLButtonElement>(
        "button[type=submit]:not([data-demo-gesperrt]), form button:not([type]):not([data-demo-gesperrt])",
      ).forEach((el) => {
        if (erlaubt(el)) return;
        el.dataset.demoGesperrt = "1";
        el.disabled = true;
        el.title = HINWEIS;
      });
    }

    sperren(document);
    const beobachter = new MutationObserver((eintraege) => {
      for (const e of eintraege) {
        e.addedNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) sperren(n as Element);
        });
      }
    });
    beobachter.observe(document.body, { childList: true, subtree: true });
    return () => {
      beobachter.disconnect();
      delete document.documentElement.dataset[DEMO_MERKMAL];
    };
  }, []);

  return null;
}
