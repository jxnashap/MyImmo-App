"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useModalFokus } from "@/lib/modalFokus";
import { demoAktion, demoBereich, demoSperrZiel, type DemoBereich } from "@/lib/demo";
import { REGISTRIERUNG_OFFEN, START_CTA } from "@/lib/preise";

/** Wohin der Early-Access-Knopf führt — dieselbe Seite wie auf der Landing. */
export const DEMO_CTA_ZIEL = "/anmelden";

/**
 * Demo verlassen: erst abmelden, dann HART navigieren.
 *
 * Abmelden ist nötig, weil `/` für ein angemeldetes Konto das Dashboard zeigt
 * statt der Startseite — genau das war Befund 7 des Reviews („man kommt nicht
 * zurück"). Und `/anmelden` mit einer noch offenen Demo-Sitzung hieße, sich
 * neben dem geteilten Demo-Konto zu registrieren. Die harte Navigation wirft
 * den Client-Cache weg, der sonst noch Demo-Seiten ausliefern könnte.
 */
export async function demoVerlassen(ziel: string) {
  try {
    // NUR diese Sitzung (Audit P5, B52): Alle Demo-Besucher teilen ein Konto — global hätte
    // jeden anderen Besucher mit abgemeldet.
    await createClient().auth.signOut({ scope: "local" });
  } catch {
    /* Sitzung ggf. schon weg — die Navigation reicht dann */
  }
  window.location.assign(ziel);
}

/**
 * Klicks auf gesperrte Bereiche erklären statt ins Leere laufen lassen.
 *
 * VORHER (Review 30.09.2026): Ein gesperrter Eintrag in der Seitenleiste war
 * ein `<span>` mit `title` — ein Klick tat nichts, und auf dem Handy gibt es
 * kein Hovern. Jeder andere Link auf einen gesperrten Bereich (die
 * Aufgabenliste des Dashboards, „Karte aktivieren") lief in die Middleware und
 * landete kommentarlos wieder auf dem Dashboard.
 *
 * JETZT, an EINER Stelle:
 *  1. Ein Klick-Abfang in der Capture-Phase auf `document` fängt JEDEN Link
 *     auf ein gesperrtes Ziel ab — auch künftige, an die niemand denkt. Er
 *     läuft vor dem Handler von Next-`<Link>`, weil `document` über dem
 *     React-Wurzelknoten liegt.
 *  2. Wer eine gesperrte Adresse direkt aufruft, wird von der Middleware nach
 *     `/?demo=gesperrt&bereich=…` geschickt; dieselbe Komponente öffnet dann
 *     den Dialog. `bereich` dient nur als Schlüssel für einen festen Text.
 *
 * Nur im Demo-Konto eingebunden (`app/(app)/layout.tsx` — Vermieter-App UND seit P5/B55 die
 * Hülle von Mieter- und Service-Portal).
 */
export default function DemoSperre() {
  const [offen, setOffen] = useState<DemoBereich | null>(null);
  const sp = useSearchParams();
  const router = useRouter();
  const pfad = usePathname();

  // (2) Rückkehr aus der Middleware.
  const gesperrt = sp.get("demo") === "gesperrt" ? sp.get("bereich") ?? "" : null;
  useEffect(() => {
    if (gesperrt === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Rückkehr aus dem Proxy: Dialog öffnen und den Parameter aus der Adresse entfernen
    setOffen(demoBereich(gesperrt));
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.delete("demo");
    params.delete("bereich");
    const qs = params.toString();
    router.replace(qs ? `${pfad}?${qs}` : pfad, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesperrt]);

  // (1) Klick-Abfang.
  useEffect(() => {
    function beiKlick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      // (1a) Knöpfe, die schreiben würden (`data-demo-sperre`, Audit P5 B54/B55): erklären statt
      // die Action zu starten. Läuft vor Reacts onClick (Capture-Phase auf document).
      const knopf = (e.target as Element | null)?.closest?.("[data-demo-sperre]");
      if (knopf) {
        e.preventDefault();
        e.stopPropagation();
        setOffen(demoAktion(knopf.getAttribute("data-demo-sperre")));
        return;
      }
      // Strg-/Cmd-Klick öffnet einen neuen Tab — dort greift Weg (2).
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!link || link.hasAttribute("download")) return;
      const ziel = demoSperrZiel(link.getAttribute("href") ?? "", window.location.href);
      if (!ziel) return;
      e.preventDefault();
      e.stopPropagation();
      setOffen(demoBereich(ziel));
    }
    document.addEventListener("click", beiKlick, true);
    return () => document.removeEventListener("click", beiKlick, true);
  }, []);

  const schliessen = useCallback(() => setOffen(null), []);
  if (!offen) return null;
  return <SperrDialog bereich={offen} onClose={schliessen} />;
}

function SperrDialog({ bereich, onClose }: { bereich: DemoBereich; onClose: () => void }) {
  const ref = useModalFokus<HTMLDivElement>(onClose, true);
  const [unterwegs, setUnterwegs] = useState(false);

  return createPortal(
    // Eigene Ebene ÜBER der Seitenleiste: Auf dem Handy liegt die aufgeklappte
    // Leiste bei z-index 70, Dialoge bei 60 — der Dialog ginge genau dort
    // dahinter auf, wo man ihn per Tipp auf einen gesperrten Eintrag öffnet.
    <div className="modal-overlay demo-sperre-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-sperre-titel"
        tabIndex={-1}
        // Der Dialog darf in der Demo bedient werden — `DemoNurLesen` sperrt
        // sonst Knöpfe in Formularen.
        data-demo-erlaubt
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="demo-sperre-kicker">
              <Lock size={12} aria-hidden /> In der Demo gesperrt
            </div>
            <h3 id="demo-sperre-titel" style={{ fontSize: 18, marginTop: 6 }}>{bereich.titel}</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen" title="Schließen">
            <X size={16} />
          </button>
        </div>
        <p style={{ margin: "12px 0 0", lineHeight: 1.6 }}>{bereich.text}</p>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
          Die Demo zeigt Objekte, Mieter und Buchungen mit Beispieldaten. Mit einem eigenen
          Zugang arbeitest du hier mit deinen Daten.
        </p>
        <div className="demo-sperre-knoepfe">
          {REGISTRIERUNG_OFFEN && (
            <button
              type="button"
              className="btn btn-gold"
              disabled={unterwegs}
              onClick={() => {
                setUnterwegs(true);
                void demoVerlassen(DEMO_CTA_ZIEL);
              }}
            >
              {START_CTA}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Weiter umsehen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
