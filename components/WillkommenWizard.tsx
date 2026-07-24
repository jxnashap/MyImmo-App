"use client";

// Willkommens-Assistent (Design-Handoff Phase 1): 4 Schritte — Objekt →
// Mietverhältnis (überspringbar) → Kredit (überspringbar) → Ergebnis mit
// gerechneten KPIs und den automatisch entstandenen Artefakten.
// Markup/Klassen exakt nach Prototyp (AppAnsicht.dc.html, "Onboarding").

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PROP_ICONS } from "@/lib/nav";
import { onboardingAnlegen, type OnboardingEingaben } from "@/lib/actions/onboarding";
import { zahlDe } from "@/lib/onboardingParse";

const TITEL: [string, string][] = [
  ["Dein Objekt", "Drei Angaben reichen — der Rest ist optional."],
  ["Wer wohnt drin?", "Mietverhältnis anlegen — Fristen und Mietkonto entstehen von selbst."],
  ["Die Finanzierung", "Damit Cashflow und Restschuld stimmen."],
  ["Fertig — sieh dir an, was daraus wurde", "Kein leerer Bildschirm: deine Zahlen stehen schon da."],
];

const TYPEN = ["Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie", "Ferienimmobilie", "Grundstück"];

const LEER: OnboardingEingaben = {
  typ: "Eigentumswohnung", adresse: "", preis: "", flaeche: "",
  mieterName: "", kalt: "", nkv: "", beginn: "", kaution: "",
  darlehen: "", zins: "", rate: "", bindung: "",
};

const eur = (n: number) =>
  "€ " + Math.round(n).toLocaleString("de-DE");

export default function WillkommenWizard({ ersteImmobilie }: { ersteImmobilie: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [o, setO] = useState<OnboardingEingaben>(LEER);
  const [fehler, setFehler] = useState<string | null>(null);
  const [artefakte, setArtefakte] = useState<{ wiederkehr: boolean; nkFrist: boolean; afa: boolean } | null>(null);
  const [busy, start] = useTransition();

  const set = (k: keyof OnboardingEingaben) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setO((s) => ({ ...s, [k]: ev.target.value }));

  const preis = zahlDe(o.preis) ?? 0;
  const kalt = zahlDe(o.kalt) ?? 0;
  const nkv = zahlDe(o.nkv) ?? 0;
  const rate = zahlDe(o.rate) ?? 0;
  const cf = kalt - rate - 90; // Kern-Logik: 90 € Bewirtschaftungspauschale

  const anlegen = () =>
    start(async () => {
      setFehler(null);
      const res = await onboardingAnlegen(o);
      if (res.ok) { setArtefakte(res.artefakte); setStep(4); }
      else setFehler(res.error);
    });

  const weiter = () => {
    if (step === 3) anlegen();
    else if (step === 4) router.push("/");
    else setStep(step + 1);
  };

  const weiterLabel = busy ? "Wird angelegt …" : step === 3 ? "Anlegen ✓" : step === 4 ? "Zum Dashboard →" : "Weiter →";
  const weiterDisabled = busy || (step === 1 && !o.adresse.trim());

  const autoListe = artefakte
    ? [
        artefakte.wiederkehr && `Mietkonto mit Wiederkehr-Vorlage „Miete ${o.mieterName.trim() || "Mieter"}" — Buchungen erzeugst du mit einem Klick unter Ein- & Ausgaben`,
        artefakte.nkFrist && "Frist erzeugt: Nebenkostenabrechnung nach § 556 III BGB — erscheint unter Termine",
        artefakte.afa && `AfA-Vorschlag berechnet: 2 % linear aus ${eur(preis)} — Feinschliff im AfA-Assistenten`,
        "Beleihungsordner angelegt — Unterlagen für die Bank einfach hineinziehen",
      ].filter((x): x is string => !!x)
    : [];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }} className="fade-up">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: "var(--gold)", fontWeight: 600, marginBottom: 10 }}>
            {ersteImmobilie ? "Erste Immobilie" : "Neues Objekt"} · Schritt {step} von 4
          </div>
          <div className="topbar-title">{TITEL[step - 1][0]}</div>
          <div className="topbar-sub">{TITEL[step - 1][1]}</div>
        </div>
        {step < 4 && <Link href="/" className="btn btn-ghost btn-sm">Später</Link>}
      </div>
      <div className="bar-track" style={{ margin: "20px 0 28px" }}>
        <div className="bar-fill" style={{ width: `${step * 25}%`, background: "var(--gold)" }} />
      </div>

      {step === 1 && (
        <div className="section" style={{ marginBottom: 0 }}><div className="section-body">
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 10 }}>Was für ein Objekt ist es?</div>
          <div className="grid-3" style={{ gap: 10, marginBottom: 20 }}>
            {TYPEN.map((t) => {
              const Icon = PROP_ICONS[t];
              const sel = o.typ === t;
              return (
                <button key={t} type="button" onClick={() => setO((s) => ({ ...s, typ: t }))}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px",
                    borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12, transition: "border-color 140ms",
                    background: sel ? "var(--gold-pale)" : "var(--bg3)",
                    border: `1px solid ${sel ? "var(--gold-dim)" : "var(--line2)"}`,
                    color: sel ? "var(--gold)" : "var(--muted)",
                  }}>
                  {Icon && <Icon size={18} />}{t}
                </button>
              );
            })}
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Adresse</label>
            <input type="text" value={o.adresse} onChange={set("adresse")} placeholder="Straße Hausnummer, Ort" autoFocus />
          </div>
          <div className="field-row">
            <div className="field"><label>Kaufpreis</label><input type="text" inputMode="decimal" value={o.preis} onChange={set("preis")} placeholder="z. B. 189.000" /></div>
            <div className="field"><label>Wohnfläche in m²</label><input type="text" inputMode="decimal" value={o.flaeche} onChange={set("flaeche")} placeholder="z. B. 68" /></div>
          </div>
        </div></div>
      )}

      {step === 2 && (
        <div className="section" style={{ marginBottom: 0 }}><div className="section-body">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Mieter (Name)</label>
            <input type="text" value={o.mieterName} onChange={set("mieterName")} placeholder="z. B. Anna Berger" autoFocus />
          </div>
          <div className="field-row" style={{ marginBottom: 12 }}>
            <div className="field"><label>Kaltmiete / Monat</label><input type="text" inputMode="decimal" value={o.kalt} onChange={set("kalt")} placeholder="z. B. 710" /></div>
            <div className="field"><label>NK-Vorauszahlung / Monat</label><input type="text" inputMode="decimal" value={o.nkv} onChange={set("nkv")} placeholder="z. B. 180" /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Mietbeginn</label><input type="text" value={o.beginn} onChange={set("beginn")} placeholder="TT.MM.JJJJ" /></div>
            <div className="field"><label>Kaution</label><input type="text" inputMode="decimal" value={o.kaution} onChange={set("kaution")} placeholder="z. B. 2.130" /></div>
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 14 }}>Steht gerade leer? Einfach leer lassen — du kannst Mieter jederzeit nachtragen.</div>
        </div></div>
      )}

      {step === 3 && (
        <div className="section" style={{ marginBottom: 0 }}><div className="section-body">
          <div className="field-row" style={{ marginBottom: 12 }}>
            <div className="field"><label>Darlehenssumme</label><input type="text" inputMode="decimal" value={o.darlehen} onChange={set("darlehen")} placeholder="z. B. 120.000" autoFocus /></div>
            <div className="field"><label>Sollzins % p. a.</label><input type="text" inputMode="decimal" value={o.zins} onChange={set("zins")} placeholder="z. B. 3,9" /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Monatsrate</label><input type="text" inputMode="decimal" value={o.rate} onChange={set("rate")} placeholder="z. B. 590" /></div>
            <div className="field"><label>Zinsbindung bis</label><input type="text" value={o.bindung} onChange={set("bindung")} placeholder="TT.MM.JJJJ" /></div>
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 14 }}>Ohne Kredit? Weiter geht&apos;s auch so — MyImmo rechnet dann ohne Rate.</div>
          {fehler && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 12 }}>{fehler}</div>}
        </div></div>
      )}

      {step === 4 && (
        <div className="section" style={{ marginBottom: 0, borderColor: "var(--gold-dim)" }}><div className="section-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", color: "var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✓</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{o.adresse.trim() || "Deine Immobilie"} ist angelegt</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Aus drei Eingaben hat MyImmo das hier gemacht:</div>
            </div>
          </div>
          <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
            <div className="stat-box"><div className="stat-lbl">Bruttorendite</div><div className="stat-val gold">{preis > 0 && kalt > 0 ? ((kalt * 12) / preis * 100).toFixed(1).replace(".", ",") + " %" : "—"}</div></div>
            <div className="stat-box"><div className="stat-lbl">Cashflow / Mo.</div><div className="stat-val" style={{ color: kalt > 0 ? (cf >= 0 ? "var(--green)" : "var(--red)") : "var(--muted)" }}>{kalt > 0 ? `${cf >= 0 ? "+ " : "− "}${eur(Math.abs(cf))}` : "—"}</div></div>
            <div className="stat-box"><div className="stat-lbl">Warmmiete</div><div className="stat-val">{kalt > 0 ? eur(kalt + nkv) : "—"}</div></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {autoListe.map((a) => (
              <div key={a} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--muted)" }}>
                <span style={{ color: "var(--green)" }}>✓</span>{a}
              </div>
            ))}
          </div>
          {kalt > 0 && <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 14 }}>Cashflow gerechnet mit 90 € Bewirtschaftungspauschale — Feinschliff jederzeit im Objekt.</div>}
        </div></div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 22 }}>
        <button type="button" className="btn btn-ghost" style={{ visibility: step > 1 && step < 4 ? "visible" : "hidden" }} onClick={() => setStep(Math.max(1, step - 1))} disabled={busy}>← Zurück</button>
        <button type="button" className="btn btn-gold" onClick={weiter} disabled={weiterDisabled}>{weiterLabel}</button>
      </div>
    </div>
  );
}
