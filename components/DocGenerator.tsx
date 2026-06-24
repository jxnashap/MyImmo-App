"use client";

import { useState } from "react";
import type { Tenant, Property, VermieterProfil, Iban } from "@/lib/types";

const fmtIban = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

const ARTEN: { v: string; label: string }[] = [
  { v: "allgemein", label: "Allgemeines Schreiben" },
  { v: "mieterhoehung", label: "Mieterhöhung (§ 558 BGB)" },
  { v: "zahlungserinnerung", label: "Zahlungserinnerung" },
  { v: "mahnung", label: "Mahnung" },
  { v: "kuendigung", label: "Kündigung" },
  { v: "reparatur", label: "Reparatur-Ankündigung" },
  { v: "nk-anschreiben", label: "NK-Abrechnung — Anschreiben" },
];

const TITEL: Record<string, string> = {
  allgemein: "Schreiben", mieterhoehung: "Mieterhöhungsverlangen",
  zahlungserinnerung: "Zahlungserinnerung", mahnung: "Mahnung",
  kuendigung: "Kündigung des Mietverhältnisses", reparatur: "Ankündigung von Instandhaltungsarbeiten",
  "nk-anschreiben": "Nebenkostenabrechnung — Anschreiben",
};

const eur = (n: number) => "€ " + (n || 0).toLocaleString("de-DE", { maximumFractionDigits: 2 });
const deDate = (s: string) => (s ? new Date(s).toLocaleDateString("de-DE") : "");
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

export default function DocGenerator({ tenant, property, vermieter, ibans = [] }: { tenant: Tenant; property: Property | null; vermieter: VermieterProfil | null; ibans?: Iban[] }) {
  const [art, setArt] = useState("allgemein");
  const [betrag, setBetrag] = useState("");
  const [datum, setDatum] = useState("");
  const [grund, setGrund] = useState("");
  const [ibanId, setIbanId] = useState("");
  const [vName, setVName] = useState(vermieter?.name ?? "");
  const [vAdr, setVAdr] = useState([vermieter?.strasse, [vermieter?.plz, vermieter?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", "));

  const zeigtBetrag = ["mieterhoehung", "zahlungserinnerung", "mahnung"].includes(art);
  const selectedIban = ibans.find((x) => x.id === ibanId) ?? null;
  const betragLabel = art === "mieterhoehung" ? "Neue Kaltmiete (€)" : "Offener Betrag (€)";
  const datumLabel = art === "mieterhoehung" ? "Wirksam ab" : art === "kuendigung" ? "Kündigung zum" : art === "reparatur" ? "Termin der Arbeiten" : "Zahlbar bis";

  function erstellen() {
    const m = tenant;
    const miete = m.kaltmiete ?? 0;
    const b = parseFloat(betrag) || 0;
    const heute = new Date().toLocaleDateString("de-DE");
    const objekt = property ? `${property.bezeichnung}${m.einheit ? ", " + m.einheit : ""}${property.adresse ? ", " + property.adresse : ""}` : "–";
    const titel = TITEL[art];

    let inhalt = "";
    if (art === "mieterhoehung") {
      inhalt = `<p>hiermit mache ich von meinem Recht auf Mieterhöhung gemäß § 558 BGB Gebrauch.</p>
<p>Die aktuelle Kaltmiete für die o.g. Wohnung beträgt <strong>${eur(miete)}</strong>. Ich bitte Sie um Zustimmung zur Erhöhung der monatlichen Kaltmiete auf <strong>${eur(b)}</strong>${datum ? `, wirksam ab dem <strong>${deDate(datum)}</strong>` : ""}.</p>
${grund ? `<p>Begründung: ${esc(grund)}</p>` : ""}
<p>Gemäß § 558b BGB haben Sie bis zum Ablauf des zweiten Kalendermonats nach Zugang dieses Schreibens Zeit, der Erhöhung zuzustimmen.</p>`;
    } else if (art === "zahlungserinnerung") {
      inhalt = `<p>bei der Durchsicht meiner Unterlagen habe ich festgestellt, dass die Mietzahlung in Höhe von <strong>${eur(b || miete)}</strong> noch nicht eingegangen ist.</p>
<p>Sicherlich handelt es sich um ein Versehen. Ich bitte Sie, den offenen Betrag${datum ? ` bis zum <strong>${deDate(datum)}</strong>` : " zeitnah"} zu überweisen.</p>
${grund ? `<p>${esc(grund)}</p>` : ""}
<p>Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.</p>`;
    } else if (art === "mahnung") {
      inhalt = `<p>trotz vorheriger Erinnerung ist die Mietzahlung in Höhe von <strong>${eur(b || miete)}</strong> bislang nicht eingegangen. Hiermit mahne ich die offene Forderung an.</p>
<p>Ich fordere Sie auf, den offenen Betrag${datum ? ` bis spätestens <strong>${deDate(datum)}</strong>` : " unverzüglich"} zu begleichen.</p>
${grund ? `<p>${esc(grund)}</p>` : ""}
<p>Sollte die Zahlung nicht fristgerecht eingehen, behalte ich mir weitere rechtliche Schritte vor.</p>`;
    } else if (art === "kuendigung") {
      inhalt = `<p>hiermit kündige ich das Mietverhältnis über die o.g. Wohnung ordentlich und fristgerecht${datum ? ` zum <strong>${deDate(datum)}</strong>` : ""}.</p>
${grund ? `<p>Begründung: ${esc(grund)}</p>` : ""}
<p>Ich bitte Sie, mir einen Termin zur Wohnungsübergabe vorzuschlagen. Die Wohnung ist besenrein und mit sämtlichen Schlüsseln zu übergeben.</p>
<p><em>Hinweis: Sie haben das Recht, der Kündigung gemäß § 574 BGB zu widersprechen.</em></p>`;
    } else if (art === "reparatur") {
      inhalt = `<p>hiermit kündige ich Instandhaltungs- bzw. Reparaturarbeiten in der o.g. Wohnung an${datum ? `, geplant für den <strong>${deDate(datum)}</strong>` : ""}.</p>
${grund ? `<p>Geplante Arbeiten: ${esc(grund)}</p>` : ""}
<p>Gemäß § 555a BGB sind Sie verpflichtet, Erhaltungsmaßnahmen zu dulden. Ich bemühe mich, die Beeinträchtigungen so gering wie möglich zu halten, und bitte Sie, den Zugang zur Wohnung zum genannten Termin zu ermöglichen.</p>`;
    } else if (art === "nk-anschreiben") {
      inhalt = `<p>anbei erhalten Sie die Nebenkostenabrechnung für die o.g. Wohnung.</p>
${grund ? `<p>${esc(grund)}</p>` : ""}
<p>Die Einzelheiten entnehmen Sie bitte der beigefügten Abrechnung. Bei Fragen stehe ich Ihnen gerne zur Verfügung.</p>`;
    } else {
      inhalt = `<p>${esc(grund) || "…"}</p>`;
    }

    const ibanBox = selectedIban && zeigtBetrag
      ? `<div style="margin-top:18px;background:#f9f7f4;border-left:2px solid #C4A862;padding:10px 14px;border-radius:4px;font-size:12px;">
<div style="font-weight:bold;">Bitte überweisen Sie auf folgendes Konto:</div>
<div style="margin-top:4px;font-weight:bold;">${esc(selectedIban.kontoname)}</div>
${selectedIban.inhaber ? `<div style="color:#555;">${esc(selectedIban.inhaber)}</div>` : ""}
<div style="font-family:monospace;font-size:13px;letter-spacing:1px;margin-top:4px;font-weight:bold;">${esc(fmtIban(selectedIban.iban))}</div>
</div>`
      : "";

    const name = vName || "–";
    const adr = vAdr || "–";
    const mieterName = `${m.vorname ?? ""} ${m.nachname ?? ""}`.trim();
    const empfAdr = m.mieter_adresse ? m.mieter_adresse.split(/,\s*/).map(esc).join("<br>") : esc(objekt);

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${titel}</title>
<style>
@page{size:A4;margin:0;}
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#222;width:210mm;min-height:297mm;margin:0 auto;padding:24mm 22mm;box-sizing:border-box;line-height:1.6;}
.kopf{display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:30px;}
.empf{margin:24px 0 6px;font-size:13px;}
.datum{text-align:right;margin-bottom:24px;font-size:12px;color:#555;}
h1{font-size:16px;margin:14px 0 12px;color:#1A1814;}
.objekt{background:#f9f7f4;padding:8px 12px;border-radius:4px;font-size:12px;margin-bottom:16px;border-left:2px solid #C4A862;}
.gruss{margin-top:36px;}
.unterschrift{margin-top:50px;border-top:1px solid #C4A862;display:inline-block;padding-top:4px;font-size:11px;color:#555;min-width:200px;}
.toolbar{position:sticky;top:0;background:#1a1a1a;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;font-size:13px;}
.toolbar button{background:#D4A847;border:none;color:#1a1a1a;padding:8px 16px;border-radius:6px;font-weight:bold;cursor:pointer;}
@media print{.toolbar{display:none!important;}body{padding:24mm 22mm;}}
</style></head><body>
<div class="toolbar" contenteditable="false"><span style="font-weight:bold;">✏️ ${titel}</span><span style="color:#999;font-size:11px;flex:1;">Text anklicken zum Bearbeiten, dann drucken.</span><button onclick="window.print()">🖨 Drucken / PDF</button></div>
<div contenteditable="true" spellcheck="false" style="outline:none;">
<div class="kopf"><div><strong>${esc(name)}</strong><br>${esc(adr).split(/,\s*/).join("<br>")}</div></div>
<div class="empf"><strong>${esc(mieterName)}</strong><br>${empfAdr}</div>
<div class="datum">${esc(adr).split(",")[0] ? esc((vermieter?.ort || "")) + ", " : ""}${heute}</div>
<h1>${titel}</h1>
<div class="objekt"><strong>Mietobjekt:</strong> ${esc(objekt)}</div>
<p>Sehr geehrte(r) ${esc(mieterName)},</p>
${inhalt}
${ibanBox}
<p class="gruss">Mit freundlichen Grüßen</p>
<div class="unterschrift">${esc(name)}<br>Vermieter</div>
</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Bitte Pop-ups für diese Seite erlauben."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  return (
    <div className="form-box" style={{ maxWidth: 620 }}>
      <h3>📄 Dokument erstellen</h3>
      <p>Brief an den Mieter — öffnet eine bearbeitbare Druckansicht.</p>

      {!vermieter && (
        <div style={{ marginBottom: 14, padding: "10px 12px", background: "rgba(240,160,48,0.1)", border: "1px solid rgba(240,160,48,0.3)", borderRadius: 7, fontSize: 12, color: "var(--amber)" }}>
          Tipp: Hinterlege deinen Absender unter <strong>Einstellungen</strong>, dann ist der Briefkopf automatisch gefüllt.
        </div>
      )}

      <div className="form-row">
        <div className="form-group"><label>Dokumentart</label><select value={art} onChange={(e) => setArt(e.target.value)}>{ARTEN.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}</select></div>
        <div className="form-group"><label>{datumLabel}</label><input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></div>
      </div>
      {zeigtBetrag && (
        <div className="form-row single">
          <div className="form-group"><label>{betragLabel}</label><input type="number" step="0.01" value={betrag} onChange={(e) => setBetrag(e.target.value)} /></div>
        </div>
      )}
      <div className="form-row single">
        <div className="form-group"><label>Begründung / Zusatztext (optional)</label><textarea rows={3} value={grund} onChange={(e) => setGrund(e.target.value)} style={{ resize: "vertical" }} /></div>
      </div>

      {zeigtBetrag && (
        <>
          <div className="form-section-label">Zahlungskonto (optional)</div>
          {ibans.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--faint)", padding: "4px 0 8px" }}>
              Noch keine IBANs — unter <strong>Einstellungen</strong> anlegen, dann erscheinen sie hier.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {ibans.map((x) => {
                const sel = x.id === ibanId;
                return (
                  <div
                    key={x.id}
                    onClick={() => setIbanId(sel ? "" : x.id)}
                    style={{ padding: "8px 12px", borderRadius: 7, border: `1px solid ${sel ? "var(--gold)" : "var(--line2)"}`, background: sel ? "var(--gold-pale)" : "var(--bg3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${sel ? "var(--gold)" : "var(--line2)"}`, background: sel ? "var(--gold)" : "transparent", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{x.kontoname}{x.inhaber ? " · " + x.inhaber : ""}</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>{fmtIban(x.iban)}</div>
                    </div>
                    {sel && <span style={{ color: "var(--gold)" }}>✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="form-section-label">Absender</div>
      <div className="form-row">
        <div className="form-group"><label>Name</label><input value={vName} onChange={(e) => setVName(e.target.value)} /></div>
        <div className="form-group"><label>Adresse</label><input value={vAdr} onChange={(e) => setVAdr(e.target.value)} placeholder="Straße, PLZ Ort" /></div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-gold" onClick={erstellen}>📄 Dokument erstellen</button>
      </div>
    </div>
  );
}
