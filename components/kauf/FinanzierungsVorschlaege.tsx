"use client";

import { useState } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { fmtE } from "@/lib/kalk";
import {
  konfiguriereDarlehen, beispielZins, type Prioritaet,
} from "@/lib/kauf/darlehen";

// Zwei GLEICHWERTIGE, rein rechnerische Finanzierungs-Szenarien als gestapelter
// Balken (Eigenkapital + evtl. Förderkredit + Bankdarlehen = Gesamtinvestition).
// KEINE Empfehlung, KEINE Vermittlung (§ 34i GewO): beide Karten optisch
// identisch, kein „empfohlen", keine Vorauswahl. Nur Anzeige aus bereits
// berechneten Werten — kein neuer Datenweg, keine Persistenz.

// Farben der Balkensegmente — bewusst neutral, keine wertet eine Variante auf.
const C_EK = "var(--gold)";
const C_FOERDER = "var(--green, #4a9d6f)";
const C_DARLEHEN = "#6b7a8f";

type Szenario = {
  id: string;
  titel: string;
  unter: string;
  prioritaet: Prioritaet;
  // Anteil des verfügbaren Eigenkapitals, der eingesetzt wird (Rest bleibt Liquiditätspuffer).
  ekEinsatz: (ekVorhanden: number, nebenkosten: number) => number;
};

const SZENARIEN: Szenario[] = [
  {
    id: "solide",
    titel: "Szenario A · solide",
    unter: "Mehr Eigenkapital, höhere Tilgung — schneller schuldenfrei, weniger Zinskosten, höhere Rate.",
    prioritaet: "schnell_schuldenfrei",
    ekEinsatz: (ek) => ek, // gesamtes verfügbares EK einsetzen
  },
  {
    id: "liquide",
    titel: "Szenario B · liquiditätsschonend",
    unter: "Weniger Eigenkapital (Puffer bleibt), niedrigere Tilgung — kleinere Rate, dafür mehr Zinskosten und höhere Restschuld.",
    prioritaet: "niedrige_rate",
    // nur die Nebenkosten aus EK decken (Banken finanzieren die i. d. R. nicht) — Rest als Puffer behalten
    ekEinsatz: (ek, neben) => Math.min(ek, Math.max(neben, 0)),
  },
];

export default function FinanzierungsVorschlaege({
  gesamtInvest, kaufpreis, ekVorhanden,
}: {
  gesamtInvest: number; kaufpreis: number; ekVorhanden: number;
}) {
  const nebenkosten = Math.max(0, gesamtInvest - kaufpreis);
  const [ekInput, setEkInput] = useState(String(Math.round(ekVorhanden) || ""));
  const [foerderInput, setFoerderInput] = useState("");
  const [zinsbindung, setZinsbindung] = useState(10);

  const num = (s: string) => {
    const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const ek = Math.max(0, Math.min(num(ekInput), gesamtInvest));
  const foerder = Math.max(0, Math.min(num(foerderInput), gesamtInvest));
  const startJahr = new Date().getFullYear();
  const sollzins = beispielZins(zinsbindung);

  if (gesamtInvest <= 0) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 14px", borderRadius: 8, background: "var(--bg3)", border: "1px solid var(--line)", fontSize: 12, color: "var(--muted)" }}>
        <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Wähle zuerst ein Objekt (Schritt 2 „übernehmen") — dann rechnen wir dir hier zwei Finanzierungs-Szenarien.</span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Eingaben: EK (aus Selbstauskunft vorbelegt) + optionaler Förderkredit + Zinsbindung */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)" }}>
          Verfügbares Eigenkapital (€)
          <input value={ekInput} onChange={(e) => setEkInput(e.target.value)} inputMode="numeric" placeholder="z. B. 80000"
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 13, color: "var(--text)", width: 150 }} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)" }}>
          Förderkredit, falls geplant (€)
          <input value={foerderInput} onChange={(e) => setFoerderInput(e.target.value)} inputMode="numeric" placeholder="z. B. KfW 100000"
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 13, color: "var(--text)", width: 160 }} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)" }}>
          Zinsbindung
          <select value={zinsbindung} onChange={(e) => setZinsbindung(Number(e.target.value))}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 13, color: "var(--text)" }}>
            <option value={10}>10 Jahre</option>
            <option value={15}>15 Jahre</option>
            <option value={20}>20 Jahre</option>
          </select>
        </label>
        <div style={{ fontSize: 11.5, color: "var(--faint)", marginLeft: "auto", alignSelf: "flex-end" }}>
          Gesamtinvestition <strong style={{ color: "var(--text)" }}>{fmtE(gesamtInvest)}</strong>
          {nebenkosten > 0 && <> · davon {fmtE(nebenkosten)} Nebenkosten</>}
        </div>
      </div>

      {ek + foerder < nebenkosten && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--amber)", background: "rgba(240,160,48,0.08)", fontSize: 11.5, color: "var(--text)" }}>
          <TriangleAlert size={14} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Dein Eigenkapital deckt nicht einmal die Kaufnebenkosten ({fmtE(nebenkosten)}). Banken finanzieren die
            Nebenkosten in der Regel nicht — die Faustregel lautet: mindestens die Nebenkosten aus eigenem Geld.</span>
        </div>
      )}

      {/* Zwei optisch identische Karten (§ 34i: keine wird hervorgehoben) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {SZENARIEN.map((s) => {
          const ekEin = Math.min(ek, gesamtInvest);
          const ekUsed = Math.min(s.ekEinsatz(ekEin, nebenkosten), gesamtInvest);
          const bankdarlehen = Math.max(0, gesamtInvest - ekUsed - foerder);
          const konfig = konfiguriereDarlehen(
            { darlehen: bankdarlehen, prioritaet: s.prioritaet, zinsbindung, sollzins, sondertilgung: true },
            startJahr,
          );
          const puffer = Math.max(0, ekEin - ekUsed);
          const seg = [
            { label: "Eigenkapital", wert: ekUsed, farbe: C_EK },
            ...(foerder > 0 ? [{ label: "Förderkredit", wert: foerder, farbe: C_FOERDER }] : []),
            { label: "Bankdarlehen", wert: bankdarlehen, farbe: C_DARLEHEN },
          ].filter((x) => x.wert > 0);

          return (
            <div key={s.id} style={{ padding: 15, borderRadius: 14, background: "var(--bg2)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{s.titel}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, minHeight: 46 }}>{s.unter}</div>

              {/* Gestapelter Balken */}
              <div style={{ display: "flex", height: 26, borderRadius: 7, overflow: "hidden", marginTop: 12, border: "1px solid var(--line)" }}>
                {seg.map((x) => (
                  <div key={x.label} title={`${x.label}: ${fmtE(x.wert)}`}
                    style={{ width: `${(x.wert / gesamtInvest) * 100}%`, background: x.farbe }} />
                ))}
              </div>
              {/* Legende */}
              <div style={{ display: "grid", gap: 4, marginTop: 9 }}>
                {seg.map((x) => (
                  <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: x.farbe, flexShrink: 0 }} />
                    <span style={{ color: "var(--muted)" }}>{x.label}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--text)" }}>{fmtE(x.wert)}</span>
                    <span style={{ color: "var(--faint)", width: 42, textAlign: "right" }}>{Math.round((x.wert / gesamtInvest) * 100)} %</span>
                  </div>
                ))}
              </div>

              {/* Kennzahlen des Bankdarlehens */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 13, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                {[
                  { l: "Monatsrate (Bankdarlehen)", w: fmtE(konfig.monatsrate) },
                  { l: "Anfangstilgung", w: konfig.anfangstilgung.toLocaleString("de-DE") + " %" },
                  { l: `Restschuld nach ${zinsbindung} J.`, w: fmtE(konfig.restschuldNachBindung) },
                  { l: "Zinskosten (Bindung)", w: fmtE(konfig.zinskostenBindung) },
                  { l: "Schuldenfrei ca.", w: konfig.volltilgungJahr > 0 ? String(konfig.volltilgungJahr) : "> 60 J." },
                  { l: "Liquiditätspuffer (EK)", w: fmtE(puffer) },
                ].map((k) => (
                  <div key={k.l}>
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{k.l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginTop: 1 }}>{k.w}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 10 }}>
                Sollzins {sollzins.toLocaleString("de-DE")} % (Beispiel, Stand 2026 — den echten Zins nennt dir die Bank).
                {foerder > 0 && " Der Förderkredit hat eigene, meist günstigere Konditionen (KfW/Hausbank)."}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pflicht-Disclaimer direkt am Balken (§ 34i GewO) */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 13px", borderRadius: 9, background: "var(--bg3)", border: "1px solid var(--line)" }}>
        <Info size={14} color="var(--muted)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
          Zwei <strong>Rechenbeispiele</strong> nach deinen Angaben — <strong>keine Empfehlung, keine Vermittlung</strong>.
          Beide Varianten sind gleichwertig dargestellt; welche zu dir passt, entscheidest du selbst. Sollzinsen sind
          Beispielwerte, der echte Zins kommt von der Bank. Ein Förderkredit muss <strong>vor Vorhabensbeginn</strong>
          {" "}beantragt werden (Kauf = vor Notarvertrag).
        </span>
      </div>
    </div>
  );
}
