"use client";

// ELSTER-Ausfüllhilfe: bereitet die Anlage-V-Werte je Objekt so auf, dass
// sie 1:1 in "Mein ELSTER" übertragen werden können (je Objekt eine eigene
// Anlage V). Kein amtlicher Versand — reine Übertragungshilfe.
import { useState } from "react";
import { Copy, Check, Printer, Landmark } from "lucide-react";
import { eur2 } from "@/lib/format";
import { elsterZeilen, type AnlageVObjekt } from "@/lib/anlageV";

const elsterBetrag = (n: number) => n.toFixed(2).replace(".", ",");

function ObjektBlock({ o, jahr }: { o: AnlageVObjekt; jahr: number }) {
  const [kopiert, setKopiert] = useState(false);
  const zeilen = elsterZeilen(o);

  const kopieren = async () => {
    const kopf = `Anlage V — ${o.name}${o.adresse ? `, ${o.adresse}` : ""}\nSteuerjahr ${jahr}\n`;
    const body = zeilen
      .map((z) => `Zeile ${z.zeile}\t${z.bezeichnung}: ${elsterBetrag(z.betrag)} €`)
      .join("\n");
    await navigator.clipboard.writeText(kopf + body);
    setKopiert(true);
    setTimeout(() => setKopiert(false), 1800);
  };

  return (
    <div className="section elster-objekt" style={{ pageBreakInside: "avoid" }}>
      <div className="section-header">
        <div>
          <h3>{o.name}</h3>
          {o.adresse && <span style={{ fontSize: 11, color: "var(--muted)" }}>{o.adresse}</span>}
        </div>
        <button type="button" className="btn btn-ghost no-print" style={{ fontSize: 12 }} onClick={kopieren}>
          {kopiert ? <><Check size={13} style={{ verticalAlign: "-2px" }} /> Kopiert</> : <><Copy size={13} style={{ verticalAlign: "-2px" }} /> Werte kopieren</>}
        </button>
      </div>
      <div className="section-body">
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 0 }}>
          In „Mein ELSTER" eine <strong>eigene Anlage V für dieses Objekt</strong> anlegen und die
          Beträge in die genannten Zeilen eintragen.
        </p>
        <table style={{ fontSize: 12.5, width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 64 }}>Zeile</th>
              <th>Bezeichnung (Anlage V)</th>
              <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Betrag</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, i) => (
              <tr key={i} style={z.bereich === "summe" ? { fontWeight: 700, background: "var(--bg3)" } : undefined}>
                <td style={{ color: "var(--gold)", fontWeight: 600 }}>{z.zeile}</td>
                <td style={{ color: z.bereich === "summe" ? "var(--text)" : "var(--muted)" }}>{z.bezeichnung}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap", color: z.bereich === "summe" && z.betrag < 0 ? "var(--red)" : undefined }}>
                  {eur2(z.betrag)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ElsterHilfe({ objekte, jahr }: { objekte: AnlageVObjekt[]; jahr: number }) {
  if (objekte.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <div className="section" style={{ borderColor: "var(--gold-dim)" }}>
        <div className="section-header">
          <h3><Landmark size={15} style={{ verticalAlign: "-2px", color: "var(--gold)" }} /> ELSTER-Ausfüllhilfe {jahr}</h3>
          <button type="button" className="btn btn-gold no-print" style={{ fontSize: 12 }} onClick={() => window.print()}>
            <Printer size={13} style={{ verticalAlign: "-2px" }} /> Als PDF drucken
          </button>
        </div>
        <div className="section-body">
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            So überträgst du deine Zahlen kostenlos ans Finanzamt, ohne Steuerberater:
            Melde dich bei <strong>Mein ELSTER</strong> an (elster.de), lege je Objekt eine
            Anlage V an und trage die Beträge in die unten genannten Zeilen ein.
            Die Zeilennummern folgen dem Formular der letzten Jahre — bitte im aktuellen
            Steuerjahr kurz gegenprüfen, da sie sich verschieben können.
          </p>
        </div>
      </div>

      {objekte.map((o) => <ObjektBlock key={o.propId ?? "x"} o={o} jahr={jahr} />)}

      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12, lineHeight: 1.6 }}>
        Hinweis: Übertragungshilfe, keine Steuerberatung und keine amtliche Übermittlung.
        Die direkte elektronische Abgabe aus MyImmo ist als späteres Zusatzmodul geplant.
      </div>
    </div>
  );
}
