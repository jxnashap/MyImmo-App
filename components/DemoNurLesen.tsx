"use client";

import { useEffect } from "react";

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
 * **Ausnahme:** Alles innerhalb eines Elements mit `data-demo-erlaubt` bleibt
 * bedienbar. Das trägt der Mieterhöhungs-Generator, das einzige in der Demo
 * freigegebene Werkzeug.
 */
export default function DemoNurLesen() {
  useEffect(() => {
    const HINWEIS = "In der Demo nicht bearbeitbar. Nach der Anmeldung verfügbar.";

    function erlaubt(el: Element): boolean {
      return !!el.closest("[data-demo-erlaubt]");
    }

    function sperren(wurzel: ParentNode) {
      // Textfelder: readOnly statt disabled — disabled graut den Text aus und
      // macht die Beispieldaten schlechter lesbar. Genau die soll man ja sehen.
      wurzel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input:not([data-demo-gesperrt]), textarea:not([data-demo-gesperrt])",
      ).forEach((el) => {
        if (erlaubt(el)) return;
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
        if (erlaubt(el)) return;
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
    return () => beobachter.disconnect();
  }, []);

  return null;
}
