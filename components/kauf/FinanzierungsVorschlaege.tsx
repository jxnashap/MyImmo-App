"use client";

import { useState } from "react";
import { Info, TriangleAlert, Sparkles, ExternalLink } from "lucide-react";
import { fmtE } from "@/lib/kalk";
import { konfiguriereDarlehen, beispielZins, type Prioritaet } from "@/lib/kauf/darlehen";
import {
  foerderKredite, KFW_STAND,
  type Nutzung, type Energieklasse, type FoerderKreditTreffer,
} from "@/lib/kauf/foerderung";

// Zwei GLEICHWERTIGE, rein rechnerische Finanzierungs-Szenarien als gestapelter
// Balken (Eigenkapital + KfW-Förderkredit + evtl. weiterer Förderkredit +
// Bankdarlehen = Gesamtinvestition). Das passende KfW-Erwerbsprogramm samt
// Höchstgrenze wird aus den Angaben AUTOMATISCH erkannt und als Segment gezeigt.
// § 34i GewO: „kommt laut deinen Angaben in Frage" — KEINE Empfehlung, KEINE
// Vermittlung; alle Treffer wählbar, ein Klick entfernt das Segment.

const C_EK = "var(--gold)";
const C_KFW = "var(--green, #4a9d6f)";
const C_MANUELL = "var(--teal, #3aada8)";
const C_DARLEHEN = "#6b7a8f";

type Szenario = {
  id: string;
  titel: string;
  unter: string;
  prioritaet: Prioritaet;
  ekEinsatz: (ekVorhanden: number, nebenkosten: number) => number;
};

const SZENARIEN: Szenario[] = [
  {
    id: "solide",
    titel: "Szenario A · solide",
    unter: "Mehr Eigenkapital, höhere Tilgung — schneller schuldenfrei, weniger Zinskosten, höhere Rate.",
    prioritaet: "schnell_schuldenfrei",
    ekEinsatz: (ek) => ek,
  },
  {
    id: "liquide",
    titel: "Szenario B · liquiditätsschonend",
    unter: "Weniger Eigenkapital (Puffer bleibt), niedrigere Tilgung — kleinere Rate, dafür mehr Zinskosten und höhere Restschuld.",
    prioritaet: "niedrige_rate",
    ekEinsatz: (ek, neben) => Math.min(ek, Math.max(neben, 0)),
  },
];

const KLASSEN: Energieklasse[] = ["A+", "A", "B", "C", "D", "E", "F", "G", "H"];

export default function FinanzierungsVorschlaege({
  gesamtInvest, kaufpreis, ekVorhanden,
  nutzung, kinder = 0, zveJahr = 0,
}: {
  gesamtInvest: number; kaufpreis: number; ekVorhanden: number;
  nutzung?: Nutzung; kinder?: number; zveJahr?: number;
}) {
  const nebenkosten = Math.max(0, gesamtInvest - kaufpreis);
  const [ekInput, setEkInput] = useState(String(Math.round(ekVorhanden) || ""));
  const [manuellInput, setManuellInput] = useState("");
  const [zinsbindung, setZinsbindung] = useState(10);

  // Förder-Kontext (optional aufklappbar)
  const [foerderAktiv, setFoerderAktiv] = useState(true);
  const [vorhaben, setVorhaben] = useState<"kauf_bestand" | "neubau">("kauf_bestand");
  const [energieklasse, setEnergieklasse] = useState<"" | Energieklasse>("");
  const [eh40, setEh40] = useState(false);
  const [keineFossile, setKeineFossile] = useState(false);
  const [qng, setQng] = useState(false);
  const [einWE, setEinWE] = useState(true);
  const [progKey, setProgKey] = useState<string>(""); // "" = automatisch (größter Treffer)

  const num = (s: string) => {
    const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const ek = Math.max(0, Math.min(num(ekInput), gesamtInvest));
  const startJahr = new Date().getFullYear();
  const sollzins = beispielZins(zinsbindung);

  // Eligibilität einmal ermitteln (restbedarf großzügig → alle Treffer; Deckelung je Szenario).
  const treffer: FoerderKreditTreffer[] = (foerderAktiv && nutzung)
    ? foerderKredite({
        nutzung, vorhaben, einWohneinheit: einWE, kinder, zveJahr,
        eh40, keineFossileHeizung: keineFossile, qng,
        energieklasse: energieklasse || undefined,
        restbedarf: gesamtInvest,
      })
    : [];
  const gewaehlt = treffer.find((t) => t.key === progKey) ?? treffer[0] ?? null;
  const familieMoeglich = kinder >= 1 && zveJahr <= 0; // Hinweis: zvE fehlt

  if (gesamtInvest <= 0) {
    return (
      <div className="empty" style={{ padding: "28px 20px" }}>
        <div className="empty-icon" aria-hidden="true">📊</div>
        <h4>Noch kein Objekt übernommen</h4>
        <p>Rechne in Schritt 2 deine Kandidaten durch und übernimm das beste — dann erscheinen hier zwei grafische Finanzierungs-Szenarien.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Eingaben */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)" }}>
          Verfügbares Eigenkapital (€)
          <input value={ekInput} onChange={(e) => setEkInput(e.target.value)} inputMode="numeric" placeholder="z. B. 80000"
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 13, color: "var(--text)", width: 150 }} />
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

      {/* Förderung einbeziehen (optional, aufklappbar) */}
      <details open style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg3)" }}>
        <summary style={{ cursor: "pointer", userSelect: "none", padding: "10px 13px", fontSize: 12.5, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 7 }}>
          <Sparkles size={14} color="var(--green, #4a9d6f)" /> KfW-Förderkredit automatisch prüfen
          <span style={{ fontWeight: 400, color: "var(--faint)" }}>— je genauer die Angaben, desto passender</span>
        </summary>
        <div style={{ padding: "2px 13px 13px", display: "grid", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={foerderAktiv} onChange={(e) => setFoerderAktiv(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--gold)" }} />
            KfW-Förderkredit in der Grafik berücksichtigen
          </label>

          {foerderAktiv && (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["kauf_bestand", "neubau"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setVorhaben(v)}
                    className={`btn ${vorhaben === v ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: 12 }}>
                    {v === "kauf_bestand" ? "Bestandskauf" : "Neubau / Ersterwerb"}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--muted)", cursor: "pointer" }}>
                  <input type="checkbox" checked={einWE} onChange={(e) => setEinWE(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--gold)" }} />
                  Ein-/Zweifamilienhaus oder Eigentumswohnung
                </label>
                {vorhaben === "kauf_bestand" ? (
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--muted)" }}>
                    Energieklasse
                    <select value={energieklasse} onChange={(e) => setEnergieklasse(e.target.value as Energieklasse | "")}
                      style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 12, color: "var(--text)" }}>
                      <option value="">– unbekannt –</option>
                      {KLASSEN.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                ) : (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)", cursor: "pointer" }}>
                      <input type="checkbox" checked={eh40} onChange={(e) => setEh40(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--gold)" }} /> Effizienzhaus 40
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)", cursor: "pointer" }}>
                      <input type="checkbox" checked={keineFossile} onChange={(e) => setKeineFossile(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--gold)" }} /> keine Öl/Gas-Heizung
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)", cursor: "pointer" }}>
                      <input type="checkbox" checked={qng} onChange={(e) => setQng(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--gold)" }} /> QNG-Zertifikat
                    </label>
                  </>
                )}
              </div>

              {familieMoeglich && (
                <div style={{ fontSize: 11, color: "var(--amber)", display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <TriangleAlert size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                  Für die Familienprogramme KfW 300/308 bitte das zu versteuernde Haushaltseinkommen in der Selbstauskunft angeben.
                </div>
              )}

              {treffer.length > 0 ? (
                <div style={{ display: "grid", gap: 5 }}>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>Kommt laut deinen Angaben in Frage (du wählst, welcher in die Grafik geht):</div>
                  {treffer.map((t) => (
                    <label key={t.key} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11.5, color: "var(--muted)", cursor: "pointer" }}>
                      <input type="radio" name="kfwprog" checked={(gewaehlt?.key === t.key)} onChange={() => setProgKey(t.key)} style={{ marginTop: 2, accentColor: "var(--gold)" }} />
                      <span>
                        <strong style={{ color: "var(--text)" }}>{t.name}</strong>
                        <a href={t.url} target="_blank" rel="noopener noreferrer" title={`${t.key} auf kfw.de öffnen`}
                          style={{ color: "var(--muted)", marginLeft: 5, verticalAlign: "-1px" }}>
                          <ExternalLink size={11} />
                        </a>
                        {" "}· bis {fmtE(t.hoechstbetrag)} — kommt in Frage, wenn {t.bedingung}.
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--faint)" }}>
                  Zu deinen Angaben passt aktuell kein KfW-Erwerbskredit als Segment (z. B. vermieteter Bestand). Für Sanierung/Umbau siehe KfW 261/159 im Fördercheck.
                </div>
              )}

              <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)" }}>
                Anderer Förderkredit (€) — z. B. Landesförderbank, optional
                <input value={manuellInput} onChange={(e) => setManuellInput(e.target.value)} inputMode="numeric" placeholder="0"
                  style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 12.5, color: "var(--text)", width: 200 }} />
              </label>
            </>
          )}
        </div>
      </details>

      {ek < nebenkosten && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--amber)", background: "rgba(240,160,48,0.08)", fontSize: 11.5, color: "var(--text)" }}>
          <TriangleAlert size={14} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Dein Eigenkapital deckt nicht einmal die Kaufnebenkosten ({fmtE(nebenkosten)}). Banken und KfW finanzieren die
            Nebenkosten in der Regel nicht — Faustregel: mindestens die Nebenkosten aus eigenem Geld.</span>
        </div>
      )}

      {/* Zwei optisch identische Karten (§ 34i: keine wird hervorgehoben) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {SZENARIEN.map((s) => {
          const ekEin = Math.min(ek, gesamtInvest);
          const ekUsed = Math.min(s.ekEinsatz(ekEin, nebenkosten), gesamtInvest);
          const restbedarf = Math.max(0, gesamtInvest - ekUsed);
          const kfwSeg = gewaehlt ? Math.max(0, Math.min(gewaehlt.hoechstbetrag, restbedarf)) : 0;
          const manuellSeg = Math.max(0, Math.min(num(manuellInput), restbedarf - kfwSeg));
          const bankdarlehen = Math.max(0, restbedarf - kfwSeg - manuellSeg);
          const konfig = konfiguriereDarlehen(
            { darlehen: bankdarlehen, prioritaet: s.prioritaet, zinsbindung, sollzins, sondertilgung: true },
            startJahr,
          );
          const puffer = Math.max(0, ekEin - ekUsed);
          const seg = [
            { label: "Eigenkapital", wert: ekUsed, farbe: C_EK },
            ...(kfwSeg > 0 ? [{ label: `Förderkredit (${gewaehlt!.key})`, wert: kfwSeg, farbe: C_KFW }] : []),
            ...(manuellSeg > 0 ? [{ label: "weiterer Förderkredit", wert: manuellSeg, farbe: C_MANUELL }] : []),
            { label: "Bankdarlehen", wert: bankdarlehen, farbe: C_DARLEHEN },
          ].filter((x) => x.wert > 0);

          return (
            <div key={s.id} className="tile-hover" style={{ padding: 15, borderRadius: 14, background: "var(--bg2)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{s.titel}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, minHeight: 46 }}>{s.unter}</div>

              {/* Gestapelter Balken */}
              <div style={{ display: "flex", height: 26, borderRadius: 7, overflow: "hidden", marginTop: 12, border: "1px solid var(--line)" }}>
                {seg.map((x) => (
                  <div key={x.label} className="no-motion-transition" title={`${x.label}: ${fmtE(x.wert)}`}
                    style={{ width: `${(x.wert / gesamtInvest) * 100}%`, background: x.farbe, transition: "width .55s var(--ease)" }} />
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
                Sollzins {sollzins.toLocaleString("de-DE")} % (Beispiel — echten Zins nennt die Bank).
                {kfwSeg > 0 && " Die Monatsrate zeigt nur das Bankdarlehen — zzgl. KfW-Rate (Konditionen von KfW/Hausbank)."}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info zum Förder-Segment (§ 34i-neutral) */}
      {gewaehlt && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 13px", borderRadius: 9, background: "rgba(74,157,111,0.08)", border: "1px solid var(--green, #4a9d6f)" }}>
          <Sparkles size={14} color="var(--green, #4a9d6f)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--text)" }}>
            <a href={gewaehlt.url} target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--text)", fontWeight: 700, textDecoration: "underline", textDecorationColor: "var(--green, #4a9d6f)" }}>
              {gewaehlt.name} <ExternalLink size={11} style={{ verticalAlign: "-1px" }} />
            </a> kommt laut deinen Angaben in Frage — Höchstbetrag {fmtE(gewaehlt.hoechstbetrag)}
            {" "}(je Szenario auf den Finanzierungsbedarf begrenzt). Stand {KFW_STAND}, Konditionen können sich ändern.
            <strong> Antrag VOR Notarvertrag/Baubeginn</strong> über deine Hausbank. Keine Empfehlung — du entscheidest selbst;
            weitere/kombinierbare Programme siehe Fördercheck.
          </span>
        </div>
      )}

      {/* Pflicht-Disclaimer (§ 34i GewO) */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 13px", borderRadius: 9, background: "var(--bg3)", border: "1px solid var(--line)" }}>
        <Info size={14} color="var(--muted)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
          Zwei <strong>Rechenbeispiele</strong> nach deinen Angaben — <strong>keine Empfehlung, keine Vermittlung</strong>.
          Beide Varianten sind gleichwertig dargestellt; welche zu dir passt, entscheidest du selbst. Sollzinsen sind
          Beispielwerte, der echte Zins kommt von der Bank.
        </span>
      </div>
    </div>
  );
}
