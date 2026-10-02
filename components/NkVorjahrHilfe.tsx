"use client";

// NK-Seite (02.10.2026): „Positionen aus dem Vorjahr übernehmen“ und der Vorschlag für die neue
// Vorauszahlung. Steht außerhalb des Briefes (no-print). Rechnung: lib/nkVorjahr.ts.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CopyPlus, Lightbulb } from "lucide-react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { uebernehmeVorjahresPositionen } from "@/lib/actions/positions";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function NkVorjahrHilfe({
  mieterId, jahr, uebernahme, vorschlag, aktuellMonat, nurVorjahrsBetraege,
}: {
  mieterId: string;
  jahr: number;
  uebernahme: { moeglich: boolean; anzahl: number };
  vorschlag: { vorschlag: number; differenz: number } | null;
  aktuellMonat: number;
  /** Positionen dieses Jahres wurden aus dem Vorjahr übernommen und haben noch Vorjahresbeträge. */
  nurVorjahrsBetraege: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const uebernehmen = () =>
    startTransition(async () => {
      try {
        const f = actionFehler(await uebernehmeVorjahresPositionen(mieterId, jahr));
        if (f) return toast(f, "error");
        toast(`Positionen aus ${jahr - 1} übernommen — Beträge jetzt mit den Rechnungen ${jahr} abgleichen.`);
        router.refresh();
      } catch {
        toast("Übernahme fehlgeschlagen.", "error");
      }
    });

  if (!uebernahme.moeglich && !vorschlag && !nurVorjahrsBetraege) return null;

  const grund = vorschlag
    ? `Anpassung der Nebenkostenvorauszahlung nach der Abrechnung ${jahr} (§ 560 Abs. 4 BGB): künftig ${eur(vorschlag.vorschlag)} monatlich statt bisher ${eur(aktuellMonat)}.`
    : "";

  return (
    <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto 14px", display: "grid", gap: 10 }}>
      {uebernahme.moeglich && (
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12.5 }}>
            <CopyPlus size={16} color="var(--gold)" />
            <span style={{ flex: 1, minWidth: 220 }}>
              Für {jahr} sind noch keine Positionen erfasst. <strong>{uebernahme.anzahl} Positionen aus {jahr - 1}</strong> als
              Startpunkt übernehmen? Umlageschlüssel und Beträge werden kopiert, Zählerstände und Lohnanteile nicht.
            </span>
            <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} disabled={pending} onClick={uebernehmen}>
              {pending ? "…" : "Aus Vorjahr übernehmen"}
            </button>
          </div>
        </div>
      )}
      {nurVorjahrsBetraege && (
        <p style={{ fontSize: 12, color: "var(--amber)", margin: 0 }}>
          Die Beträge der Positionen entsprechen noch genau {jahr - 1}. Vor dem Versand mit den Rechnungen für {jahr} abgleichen
          (Positionen bearbeiten oder die Abrechnung der Hausverwaltung oben einlesen).
        </p>
      )}
      {vorschlag && (
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12.5 }}>
            <Lightbulb size={16} color="var(--gold)" />
            <span style={{ flex: 1, minWidth: 220 }}>
              Die abgerechneten Kosten entsprechen <strong>{eur(vorschlag.vorschlag)} im Monat</strong>, die Vorauszahlung liegt bei {eur(aktuellMonat)}{" "}
              ({vorschlag.differenz > 0 ? "+" : "−"}{eur(Math.abs(vorschlag.differenz))}). Nach einer Abrechnung kann die Vorauszahlung
              angemessen angepasst werden (§ 560 Abs. 4 BGB).
            </span>
            <Link
              href={`/tenants/${mieterId}/dokument?art=allgemein&grund=${encodeURIComponent(grund)}`}
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
            >
              Anpassung schreiben
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
