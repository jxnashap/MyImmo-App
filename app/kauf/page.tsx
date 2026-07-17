import Link from "next/link";
import {
  Search, Calculator, Route as RouteIcon, Landmark, FolderClosed, FileCheck2,
  ExternalLink, TriangleAlert, ArrowRight,
} from "lucide-react";

export const metadata = { title: "Kauf-Assistent — MyImmo" };

// Kauf-Assistent: ein einfaches Ablaufschema, das die vorhandenen Werkzeuge
// (Marktwert-Schätzer, Schnell-/Detailrechner, Beleihungsordner) zu einem
// linearen Kauf-Weg verklammert. Rein informativ/navigierend — keine
// Darlehensvermittlung (§ 34i GewO), nur redaktionelle Erklärtexte.

function Schritt({ n, letzte, icon: Icon, titel, children }: {
  n: number; letzte?: boolean; icon: React.ElementType; titel: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
      {/* Nummern-Spalte mit Verbindungslinie */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--gold)", color: "#1a1814", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16 }}>{n}</div>
        {!letzte && <div style={{ flex: 1, width: 2, background: "var(--line2)", marginTop: 4 }} />}
      </div>
      <div className="section" style={{ flex: 1, marginBottom: letzte ? 0 : 18 }}>
        <div className="section-header"><h3><Icon size={16} style={{ verticalAlign: "-3px" }} /> {titel}</h3></div>
        <div className="section-body">{children}</div>
      </div>
    </div>
  );
}

const DARLEHEN: { name: string; text: string; warn?: boolean }[] = [
  { name: "Annuitätendarlehen", text: "Konstante Rate aus Zins + Tilgung. Der Standard für fast alle Fälle — planbar, flexibel (Sondertilgung, Tilgungswechsel)." },
  { name: "Endfälliges Darlehen", text: "Nur Zinsen laufend, Tilgung am Ende über einen Tilgungsersatz. Für Vermieter interessant: Zinsen bleiben konstant hoch und voll als Werbungskosten abziehbar." },
  { name: "Volltilger", text: "Tilgt bis Ende der Zinsbindung auf 0 — oft Zinsrabatt, dafür wenig flexibel." },
  { name: "Forward-Darlehen", text: "Anschlusszins schon heute für später sichern. Aufschlag je Vorlaufmonat; Abnahmepflicht auch bei fallenden Zinsen (Zinswette)." },
  { name: "Bausparkombi / „Sofortfinanzierung“ zur Ablösung", text: "Tilgungsfreies Vorausdarlehen + Bausparvertrag, der später ablöst. Klingt nach Zinssicherung, ist aber oft intransparent und teuer — Verbraucherzentrale rät meist ab (Abschlussgebühr, unsicherer Zuteilungstermin, effektiv höhere Kosten).", warn: true },
];

const FOERDERUNG: { name: string; wer: string; ok: boolean }[] = [
  { name: "KfW 297/298 – Klimafreundlicher Neubau", wer: "298 auch für Vermieter", ok: true },
  { name: "KfW 261 – Sanierung zum Effizienzhaus", wer: "auch Vermieter", ok: true },
  { name: "KfW 458 – Heizungsförderung (Vermieter max. ~35 %)", wer: "auch Vermieter", ok: true },
  { name: "BAFA BEG EM – Gebäudehülle & Anlagentechnik", wer: "auch Vermieter", ok: true },
  { name: "Landesförderbanken (z. B. NRW.BANK Mietwohnraum)", wer: "Vermieter, mit Bindung", ok: true },
  { name: "KfW 124 / 300 / 308, Wohn-Riester", wer: "nur Selbstnutzer", ok: false },
];

export default function KaufPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Kauf-Assistent</div>
          <div className="topbar-sub">Vom gefundenen Objekt bis zur Finanzierungsanfrage — Schritt für Schritt</div>
        </div>
      </div>

      <Schritt n={1} icon={Search} titel="Objekt bewerten">
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Schätze den Marktwert nach ImmoWertV (Ertrags- oder Sachwert), schlage den Bodenrichtwert
          im amtlichen BORIS-Portal deines Bundeslands nach und vergleiche mit dem Kaufpreis.
        </p>
        <Link href="/bewertung" className="btn btn-gold" style={{ fontSize: 13 }}>
          Marktwert-Schätzer öffnen <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
        </Link>
      </Schritt>

      <Schritt n={2} icon={Calculator} titel="Kauf durchrechnen">
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Kaufnebenkosten, Finanzierungsrate, Cashflow und Rendite. Schnell für den ersten Überblick,
          im Detail für die belastbare Kalkulation.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/roter-faden" className="btn btn-outline" style={{ fontSize: 13 }}>
            <RouteIcon size={14} style={{ verticalAlign: "-2px" }} /> Schnell rechnen (Roter Faden)
          </Link>
          <Link href="/cockpit" className="btn btn-ghost" style={{ fontSize: 13 }}>
            <Calculator size={14} style={{ verticalAlign: "-2px" }} /> Im Detail (Cockpit)
          </Link>
        </div>
      </Schritt>

      <Schritt n={3} icon={Landmark} titel="Finanzierung & Förderung">
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Überblick über die Darlehensarten — welche zu dir passt, entscheidest du mit deiner Bank.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {DARLEHEN.map((d) => (
            <div key={d.name} style={{ padding: "8px 12px", borderRadius: 8, background: d.warn ? "rgba(240,160,48,0.08)" : "var(--bg3)", border: `1px solid ${d.warn ? "var(--amber)" : "var(--line)"}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {d.warn && <TriangleAlert size={13} color="var(--amber)" />} {d.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{d.text}</div>
            </div>
          ))}
        </div>

        <div className="form-section-label" style={{ marginTop: 16 }}>Förderprogramme (Auswahl, Stand 2026 — vor Antrag Konditionen prüfen)</div>
        <div style={{ display: "grid", gap: 4 }}>
          {FOERDERUNG.map((f) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: f.ok ? "var(--green)" : "var(--faint)", flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{f.name}</span>
              <span className={`badge ${f.ok ? "badge-green" : "badge-neutral"}`}>{f.wer}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <a href="https://www.kfw.de/inlandsfoerderung/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12 }}><ExternalLink size={12} style={{ verticalAlign: "-2px" }} /> KfW</a>
          <a href="https://www.bafa.de" target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12 }}><ExternalLink size={12} style={{ verticalAlign: "-2px" }} /> BAFA</a>
        </div>
      </Schritt>

      <Schritt n={4} icon={FolderClosed} titel="Finanzierungsmappe für die Bank">
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Alle Unterlagen, die Banken verlangen — passend zu deinem Objekt (Kauf, Vermietung, ETW).
          MyImmo erzeugt Kennblatt, Mietaufstellung & Co. aus deinen Daten. Du bekommst einen sicheren
          Link, den du <strong>selbst an deine Bank(en)</strong> schickst.
        </p>
        <Link href="/beleihung" className="btn btn-gold" style={{ fontSize: 13 }}>
          Beleihungsordner / Finanzierungsmappe <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
        </Link>
      </Schritt>

      <Schritt n={5} letzte icon={FileCheck2} titel="Angebote vergleichen & entscheiden">
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Die Bank prüft und schickt ihr Angebot zurück. Vergleiche die Angebote nach dem
          <strong> effektiven Jahreszins</strong> (nicht nur dem Sollzins) und der Flexibilität
          (Sondertilgung, Tilgungswechsel). Nach der Zusage: Notartermin, Grundschuld, Auszahlung
          durch die Bank — und das Objekt wandert in deinen MyImmo-Bestand.
        </p>
        <div style={{ fontSize: 11.5, color: "var(--faint)", display: "flex", gap: 7 }}>
          <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>MyImmo vermittelt keine Darlehen und gibt keine Finanzierungsempfehlung — die Auswahl von Bank
            und Darlehen triffst du selbst. Unterschrift und Auszahlung laufen über die Bank bzw. den Notar.</span>
        </div>
      </Schritt>
    </div>
  );
}
