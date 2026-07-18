"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Save } from "lucide-react";
import { useToast } from "@/components/Toast";
import { speichereSelbstauskunft } from "@/lib/actions/selbstauskunft";
import {
  LEERE_SELBSTAUSKUNFT, eigenkapitalGesamt, haushaltsNetto,
  type SelbstauskunftDaten, type Beschaeftigung, type Befristung,
} from "@/lib/kauf/selbstauskunft";

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");
const num = (s: string) => parseFloat(String(s).replace(",", ".")) || 0;

// numerische Felder (Rest sind Text/Select)
const ZAHL_FELDER: (keyof SelbstauskunftDaten)[] = [
  "kinder", "anzahlPersonen",
  "einkommen", "einkommenPartner", "mieteinnahmen", "kindergeld", "sonstigeEinnahmen",
  "wohnkostenAktuell", "versicherungen", "unterhalt", "ratenKredite", "sonstigeAusgaben",
  "bankguthaben", "wertpapiere", "bausparen", "sonstigesVermoegen",
  "summeVerbindlichkeiten",
];

const EINNAHMEN: [keyof SelbstauskunftDaten, string][] = [
  ["einkommen", "Nettoeinkommen (€/Mo)"],
  ["einkommenPartner", "Netto Partner:in (€/Mo)"],
  ["mieteinnahmen", "bestehende Mieteinnahmen (€/Mo)"],
  ["kindergeld", "Kindergeld (€/Mo)"],
  ["sonstigeEinnahmen", "sonstige Einnahmen (€/Mo)"],
];
const AUSGABEN: [keyof SelbstauskunftDaten, string][] = [
  ["wohnkostenAktuell", "aktuelle Wohnkosten/Miete (€/Mo)"],
  ["ratenKredite", "laufende Kreditraten (€/Mo)"],
  ["versicherungen", "Versicherungen (€/Mo)"],
  ["unterhalt", "Unterhalt (€/Mo)"],
  ["sonstigeAusgaben", "sonstige Ausgaben (€/Mo)"],
];
const VERMOEGEN: [keyof SelbstauskunftDaten, string][] = [
  ["bankguthaben", "Bank-/Tagesgeld (€)"],
  ["wertpapiere", "Wertpapiere/Depot (€)"],
  ["bausparen", "Bausparen (€)"],
  ["sonstigesVermoegen", "sonstiges Vermögen (€)"],
];

function toStrings(d: SelbstauskunftDaten): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of Object.keys(d) as (keyof SelbstauskunftDaten)[]) {
    const v = d[k];
    o[k] = typeof v === "number" ? (v === 0 ? "" : String(v)) : String(v ?? "");
  }
  return o;
}

export default function SelbstauskunftForm({ initial }: { initial: SelbstauskunftDaten | null }) {
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState<Record<string, string>>(toStrings(initial ?? LEERE_SELBSTAUSKUNFT));
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const netto = haushaltsNetto({
    einkommen: num(f.einkommen), einkommenPartner: num(f.einkommenPartner),
    kindergeld: num(f.kindergeld), sonstigeEinnahmen: num(f.sonstigeEinnahmen),
  } as SelbstauskunftDaten);
  const ek = eigenkapitalGesamt({
    bankguthaben: num(f.bankguthaben), wertpapiere: num(f.wertpapiere),
    bausparen: num(f.bausparen), sonstigesVermoegen: num(f.sonstigesVermoegen),
  } as SelbstauskunftDaten);

  async function speichern() {
    setSaving(true);
    const daten = { ...LEERE_SELBSTAUSKUNFT } as SelbstauskunftDaten;
    // Text/Select-Felder
    daten.familienstand = f.familienstand ?? "";
    daten.staatsangehoerigkeit = f.staatsangehoerigkeit ?? "";
    daten.beschaeftigung = (f.beschaeftigung as Beschaeftigung) || "angestellt";
    daten.beruf = f.beruf ?? "";
    daten.arbeitgeber = f.arbeitgeber ?? "";
    daten.beschaeftigtSeit = f.beschaeftigtSeit ?? "";
    daten.befristung = (f.befristung as Befristung) || "unbefristet";
    // Zahl-Felder
    for (const k of ZAHL_FELDER) (daten[k] as number) = num(f[k]);
    if (daten.anzahlPersonen < 1) daten.anzahlPersonen = 1;

    const r = await speichereSelbstauskunft(daten);
    setSaving(false);
    toast(r.ok ? "Selbstauskunft gespeichert." : (r.error ?? "Fehler beim Speichern."));
    // Server-Daten neu laden → Machbarkeits-Ampel zieht die neuen Zahlen ohne Reload.
    if (r.ok) router.refresh();
  }

  const geld = (paare: [keyof SelbstauskunftDaten, string][]) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
      {paare.map(([k, label]) => (
        <div className="field" key={k}>
          <label>{label}</label>
          <input inputMode="decimal" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11.5, color: "var(--muted)" }}>
        <ShieldCheck size={14} color="var(--green)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Diese Angaben werden <strong>verschlüsselt</strong> gespeichert (nur du kannst sie lesen) und dienen der Machbarkeitsprüfung und der Selbstauskunft für die Bank. Keine Weitergabe, keine Finanzberatung.</span>
      </div>

      <div>
        <div className="form-section-label">Person &amp; Beschäftigung</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          <div className="field"><label>Familienstand</label><input value={f.familienstand ?? ""} onChange={(e) => set("familienstand", e.target.value)} placeholder="ledig / verheiratet …" /></div>
          <div className="field"><label>Kinder</label><input inputMode="numeric" value={f.kinder ?? ""} onChange={(e) => set("kinder", e.target.value)} /></div>
          <div className="field"><label>Personen im Haushalt</label><input inputMode="numeric" value={f.anzahlPersonen ?? ""} onChange={(e) => set("anzahlPersonen", e.target.value)} placeholder="1" /></div>
          <div className="field"><label>Staatsangehörigkeit</label><input value={f.staatsangehoerigkeit ?? ""} onChange={(e) => set("staatsangehoerigkeit", e.target.value)} /></div>
          <div className="field">
            <label>Beschäftigung</label>
            <select value={f.beschaeftigung ?? "angestellt"} onChange={(e) => set("beschaeftigung", e.target.value)}>
              <option value="angestellt">Angestellt</option>
              <option value="selbststaendig">Selbstständig</option>
              <option value="beamter">Beamt:in</option>
              <option value="rentner">Rentner:in</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </div>
          <div className="field"><label>Beruf</label><input value={f.beruf ?? ""} onChange={(e) => set("beruf", e.target.value)} /></div>
          <div className="field"><label>Arbeitgeber</label><input value={f.arbeitgeber ?? ""} onChange={(e) => set("arbeitgeber", e.target.value)} /></div>
          <div className="field"><label>Beschäftigt seit</label><input type="month" value={f.beschaeftigtSeit ?? ""} onChange={(e) => set("beschaeftigtSeit", e.target.value)} /></div>
          <div className="field">
            <label>Anstellung</label>
            <select value={f.befristung ?? "unbefristet"} onChange={(e) => set("befristung", e.target.value)}>
              <option value="unbefristet">unbefristet</option>
              <option value="befristet">befristet</option>
              <option value="probezeit">in Probezeit</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="form-section-label">Einnahmen (monatlich, netto)</div>
        {geld(EINNAHMEN)}
      </div>
      <div>
        <div className="form-section-label">Ausgaben (monatlich)</div>
        {geld(AUSGABEN)}
      </div>
      <div>
        <div className="form-section-label">Vermögen / Eigenkapital</div>
        {geld(VERMOEGEN)}
      </div>
      <div>
        <div className="form-section-label">Verbindlichkeiten (Restschuld gesamt)</div>
        {geld([["summeVerbindlichkeiten", "Summe offener Kredite (€)"]])}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", padding: "12px 14px", borderRadius: 8, background: "var(--bg3)", border: "1px solid var(--line)" }}>
        <div><div style={{ fontSize: 11, color: "var(--muted)" }}>Haushalts-Netto</div><div style={{ fontSize: 17, fontWeight: 700 }}>{eur(netto)}/Mo</div></div>
        <div><div style={{ fontSize: 11, color: "var(--muted)" }}>Eigenkapital gesamt</div><div style={{ fontSize: 17, fontWeight: 700, color: "var(--gold)" }}>{eur(ek)}</div></div>
        <button type="button" className="btn btn-gold" style={{ marginLeft: "auto" }} onClick={speichern} disabled={saving}>
          <Save size={15} /> {saving ? "Speichert…" : "Selbstauskunft speichern"}
        </button>
      </div>
    </div>
  );
}
