"use client";

// NK-Seite (02.10.2026): „Positionen aus dem Vorjahr übernehmen“ und der Vorschlag für die neue
// Vorauszahlung. Steht außerhalb des Briefes (no-print). Rechnung: lib/nkVorjahr.ts.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CopyPlus, Lightbulb, Receipt, Gauge } from "lucide-react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { uebernehmeVorjahresPositionen } from "@/lib/actions/positions";
import { setzeMieteAb } from "@/lib/actions/mietzeitraeume";
import { uebernehmeGebuchteKosten } from "@/lib/actions/positions";
import type { ZaehlerSpanne } from "@/lib/zaehlerSpanne";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function NkVorjahrHilfe({
  mieterId, jahr, uebernahme, vorschlag, aktuellMonat, nurVorjahrsBetraege, naechsterMonat, ausBuchungen = null, zaehler = [],
}: {
  mieterId: string;
  jahr: number;
  uebernahme: { moeglich: boolean; anzahl: number };
  vorschlag: { vorschlag: number; differenz: number } | null;
  aktuellMonat: number;
  /** Positionen dieses Jahres wurden aus dem Vorjahr übernommen und haben noch Vorjahresbeträge. */
  nurVorjahrsBetraege: boolean;
  /** Vorschlag für „gilt ab“ (YYYY-MM), vom Server — nie `new Date()` im Render. */
  naechsterMonat: string;
  /** Paket C: gebuchte umlagefähige Kosten, die noch nicht als Position da sind. */
  ausBuchungen?: { anzahl: number; text: string; verteilerHref: string | null } | null;
  /** Paket C: gemeldete Zählerstände des Mieters im Jahr (zum Übertragen in Verbrauchs-Positionen). */
  zaehler?: ZaehlerSpanne[];
}) {
  const [abMonat, setAbMonat] = useState(naechsterMonat);
  const [uebernommen, setUebernommen] = useState(false);
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

  // Paket B (06.10.2026): Die angepasste Vorauszahlung endete bisher im Brief — das Soll im
  // Mietkonto blieb alt. Jetzt ab einem Monat übernehmen (frühere Monate bleiben).
  const insMietkonto = () =>
    startTransition(async () => {
      if (!vorschlag) return;
      try {
        const r = await setzeMieteAb(mieterId, abMonat, { nk_vorauszahlung: vorschlag.vorschlag });
        if (!r.ok) return toast(r.error ?? "Übernahme fehlgeschlagen.", "error");
        setUebernommen(true);
        toast("Neue Vorauszahlung im Mietkonto hinterlegt.");
        router.refresh();
      } catch {
        toast("Übernahme fehlgeschlagen.", "error");
      }
    });

  const buchungenUebernehmen = () =>
    startTransition(async () => {
      try {
        const f = actionFehler(await uebernehmeGebuchteKosten(mieterId, jahr));
        if (f) return toast(f, "error");
        toast(`Gebuchte Kosten ${jahr} als Positionen übernommen — bitte prüfen.`);
        router.refresh();
      } catch {
        toast("Übernahme fehlgeschlagen.", "error");
      }
    });

  if (!uebernahme.moeglich && !vorschlag && !nurVorjahrsBetraege && !ausBuchungen && zaehler.length === 0) return null;

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
      {ausBuchungen && (
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12.5 }}>
            <Receipt size={16} color="var(--gold)" />
            <span style={{ flex: 1, minWidth: 220 }}>
              Unter Ausgaben {jahr} gebucht und umlagefähig, aber noch nicht in der Abrechnung: <strong>{ausBuchungen.text}</strong>
            </span>
            {ausBuchungen.verteilerHref ? (
              <Link href={ausBuchungen.verteilerHref} className="btn btn-ghost" style={{ fontSize: 12 }}>Im Verteiler übernehmen</Link>
            ) : (
              <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} disabled={pending} onClick={buchungenUebernehmen}>
                {pending ? "…" : `${ausBuchungen.anzahl} übernehmen`}
              </button>
            )}
          </div>
        </div>
      )}
      {zaehler.length > 0 && (
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12.5, alignItems: "flex-start" }}>
            <Gauge size={16} color="var(--gold)" />
            <div style={{ flex: 1, minWidth: 220 }}>
              Vom Mieter gemeldete Zählerstände — für Verbrauchs-Positionen („Verbrauch Mieter“):
              {zaehler.map((z) => (
                <div key={`${z.art}-${z.zaehlernummer}-${z.einheit}`} style={{ marginTop: 4 }}>
                  <strong>{z.art}{z.zaehlernummer ? ` (Nr. ${z.zaehlernummer})` : ""}</strong>: {z.von.stand.toLocaleString("de-DE")} ({new Date(z.von.datum).toLocaleDateString("de-DE", { timeZone: "UTC" })}) →{" "}
                  {z.bis.stand.toLocaleString("de-DE")} ({new Date(z.bis.datum).toLocaleDateString("de-DE", { timeZone: "UTC" })}) ={" "}
                  <strong>{z.verbrauch.toLocaleString("de-DE")} {z.einheit ?? ""}</strong>
                  {!z.ganzesJahr && <span style={{ color: "var(--amber)" }}> · deckt nicht das ganze Jahr ab</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {nurVorjahrsBetraege && (
        <p style={{ fontSize: 12, color: "var(--amber)", margin: 0 }}>
          Die Beträge der Positionen entsprechen noch genau {jahr - 1}. Vor dem Versand mit den Rechnungen für {jahr} abgleichen
          (<Link href={`/tenants/${mieterId}/edit?jahr=${jahr}#positionen`}>Positionen bearbeiten</Link> oder die Abrechnung der Hausverwaltung oben einlesen).
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
          <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, paddingTop: 0 }}>
            <span style={{ flex: 1, minWidth: 220, color: "var(--muted)" }}>
              Nach der Mitteilung an den Mieter: neue Vorauszahlung im Mietkonto ab
            </span>
            <input type="month" aria-label="Neue Vorauszahlung gilt ab" className="set-input" value={abMonat}
              onChange={(e) => setAbMonat(e.target.value)} style={{ width: "auto" }} disabled={uebernommen} />
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }}
              disabled={pending || uebernommen || !/^\d{4}-\d{2}$/.test(abMonat)} onClick={insMietkonto}>
              {uebernommen ? "Übernommen" : "Ins Mietkonto übernehmen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
