"use client";

// Mietkonto → „Kontoauszug abgleichen“ (02.10.2026). Die CSV-Datei wird NUR im Browser gelesen
// (FileReader); zum Server gehen allein die bestätigten Buchungen über `bestaetigeMehrere`.
// Logik: lib/kontoauszug.ts. Seit B07/B09/B10 (11.10.2026): Jede Bankzeile geht mit einer Prüfsumme
// als Vorgang zum Server — derselbe Umsatz wird nie zweimal gebucht, verschiedene Teilzahlungen im
// selben Monat schon; NK-Anteil und Verteilung (Sammelzahlung, Überzahlung) rechnet der Server.
//
// Ablauf A (Prüfstand 11.10.2026, Phase 5): Kontoauszug → Vorschlag → Prüfung → Buchung → Mietkonto →
// Erinnerungsvorschlag. Dazu kamen:
//   · Mehrdeutigkeit sichtbar: Passt eine Zahlung auf mehrere Mieter, stehen die anderen in der Zeile
//     („auch möglich: …“), und der Mieter lässt sich wechseln — nicht nur der Monat.
//   · Eingänge ohne Zuordnung sind gelistet und lassen sich von Hand einem Mieter zuordnen (nie
//     vorausgewählt). Vorher waren sie nur eine Zahl.
//   · Ausgänge an einen Mieter: Rücklastschrift (Monat wird wieder offen) oder Erstattung einer
//     Überzahlung — nie vorausgewählt, der Server lehnt alles ab, was nicht dazu passt.
//   · Vorschau der Verteilung (Sammelzahlung) mit derselben Funktion wie der Server.
//   · Nach dem Buchen: was bei den betroffenen Mietern noch offen ist, mit vorbereitetem Brief
//     (Entwurf im Brief-Generator — versendet wird nichts ohne ausdrückliche Freigabe).
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileUp, ShieldCheck, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/Toast";
import BriefWahl from "@/components/BriefWahl";
import { bestaetigeMehrere, type BatchZeile, type OffenNachAbgleich } from "@/lib/actions/mietkonto";
import { monatLabel, ymPlus, zuJahrMonat } from "@/lib/mietkonto";
import {
  leseKontoauszug, gleicheAb, gleicheRueckbuchungenAb, normIban, bankzeilenSchluessel, offeneMonate, rueckMonate,
  vorschauVerteilung, namensHinweis, zielMonat,
  type AbgleichMieter, type MieterStand, type RueckArt, type RueckMieter, type RueckTreffer, type Treffer, type Zahlung,
} from "@/lib/kontoauszug";
import type { Verteilung } from "@/lib/mietZahlung";
import type { NacherfassungMieter } from "@/components/MietkontoBestaetigung";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const datumDe = (s: string) => s.split("-").reverse().join(".");

/** Text einer Datei lesen: UTF-8, bei Ersatzzeichen noch einmal als Windows-1252 (Sparkasse, Volksbank). */
async function leseDatei(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

async function sha256Hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Ergebnis = {
  treffer: Treffer[];
  ohneZuordnung: Zahlung[];
  rueck: RueckTreffer[];
  alle: Zahlung[];
  ausgaenge: number;
  datei: string;
  von: string;
  bis: string;
  /** Vorgeschlagener Mieter je unzugeordnetem Eingang (eindeutiger Name/IBAN), nicht angehakt. */
  hinweis: Record<number, string>;
};

type Nachher = { anzahl: number; offen: OffenNachAbgleich[]; abgelehnt: string[] };

export default function KontoauszugAbgleich({ nacherfassung, aktuellerMonat }: { nacherfassung: NacherfassungMieter[]; aktuellerMonat: string }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set());
  const [monatWahl, setMonatWahl] = useState<Record<number, string>>({});
  const [mieterWahl, setMieterWahl] = useState<Record<number, string>>({});
  const [artWahl, setArtWahl] = useState<Record<number, RueckArt>>({});
  const [nachher, setNachher] = useState<Nachher | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  // Vertrag + gebuchte Zahlungen je Mieter — Grundlage für Rest, Überzahlung, Vorschau.
  const daten = useMemo(() => {
    const m = new Map<string, MieterStand>();
    for (const n of nacherfassung) m.set(n.mieterId, { mieter: n.mieter, zeitraeume: n.zeitraeume, zahlungen: n.zahlungen ?? [] });
    return m;
  }, [nacherfassung]);

  const lesen = async (f: File | undefined) => {
    setFehler(null);
    setErgebnis(null);
    setNachher(null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setFehler("Die Datei ist größer als 5 MB — bitte einen kürzeren Zeitraum exportieren.");
    const a = leseKontoauszug(await leseDatei(f));
    if (!a.ok) return setFehler(a.fehler);
    if (a.zahlungen.length === 0 && a.abgaenge.length === 0) return setFehler("Im Auszug sind keine Umsätze.");

    // Offene Soll-Monate im Zeitraum des Auszugs (± Puffer) — mit dem tatsächlichen Rest nach
    // Teilzahlungen und Rückbuchungen (dieselbe Rechnung wie der Server).
    const monate = [...a.zahlungen, ...a.abgaenge].map((z) => zuJahrMonat(z.datum)!).sort();
    const von = ymPlus(monate[0], -3);
    const bis = ymPlus(monate[monate.length - 1], 1);
    const mieter: AbgleichMieter[] = nacherfassung.map((n) => ({
      mieterId: n.mieterId,
      propId: n.propId,
      name: n.name,
      nachname: n.nachname ?? null,
      ibanHash: n.ibanHash ?? null,
      offen: offeneMonate(daten.get(n.mieterId)!, von, bis),
    }));
    const rueckMieter: RueckMieter[] = nacherfassung.map((n) => ({
      mieterId: n.mieterId, propId: n.propId, name: n.name, nachname: n.nachname ?? null, ibanHash: n.ibanHash ?? null,
      stand: daten.get(n.mieterId)!,
    }));

    const hashe = new Map<number, string>();
    for (const z of [...a.zahlungen, ...a.abgaenge]) if (normIban(z.iban)) hashe.set(z.zeile, await sha256Hex(normIban(z.iban)));

    const erg = gleicheAb(a.zahlungen, mieter, hashe);
    const rueck = gleicheRueckbuchungenAb(a.abgaenge, rueckMieter, hashe);
    const hinweis: Record<number, string> = {};
    for (const z of erg.ohneZuordnung) {
      const id = namensHinweis(z, mieter, hashe);
      if (id) hinweis[z.zeile] = id;
    }
    setErgebnis({ ...erg, rueck, alle: [...a.zahlungen, ...a.abgaenge], ausgaenge: a.ausgaenge, datei: f.name, von, bis, hinweis });
    // Vorausgewählt ist nur, was „sicher“ ist. Rückbuchungen und Handzuordnungen nie.
    setAuswahl(new Set(erg.treffer.filter((t) => t.stufe === "sicher").map((t) => t.zahlung.zeile)));
    setMonatWahl({});
    setMieterWahl({});
    setArtWahl({});
  };

  // ---- effektive Wahl je Zeile ------------------------------------------------------------
  const offenFuer = (mieterId: string) => (ergebnis && daten.get(mieterId) ? offeneMonate(daten.get(mieterId)!, ergebnis.von, ergebnis.bis) : []);

  /** Eingang aus „Zuordnungen“: gewählter Mieter (Standard: der stärkste), seine offenen Monate, Monat. */
  const trefferWahl = (t: Treffer) => {
    const id = mieterWahl[t.zahlung.zeile] ?? t.mieterId;
    const k = id === t.mieterId ? t : t.alternativen.find((a) => a.mieterId === id) ?? t;
    return { mieterId: k.mieterId, monate: k.monate, monat: monatWahl[t.zahlung.zeile] ?? k.jahrMonat, gruende: k.gruende, gewechselt: k !== t };
  };

  /** Eingang ohne Zuordnung: Mieter von Hand (Vorschlag aus Name/IBAN), Monat Zielmonat bzw. ältester offener. */
  const handWahl = (z: Zahlung) => {
    const id = mieterWahl[z.zeile] ?? ergebnis?.hinweis[z.zeile] ?? "";
    const monate = id ? offenFuer(id) : [];
    const ziel = zielMonat(z.datum);
    const standard = monate.find((o) => o.jahrMonat === ziel)?.jahrMonat ?? monate[0]?.jahrMonat ?? "";
    return { mieterId: id, monate, monat: monatWahl[z.zeile] ?? standard };
  };

  /** Ausgang an einen Mieter: Art, Monat aus den Monaten mit Zahlung (Rücklastschrift) bzw. Überzahlung. */
  const rueckWahl = (r: RueckTreffer) => {
    const id = mieterWahl[r.zahlung.zeile] ?? r.mieterId;
    const art = artWahl[r.zahlung.zeile] ?? r.art;
    const alle = id === r.mieterId ? r.monate : daten.get(id) ? rueckMonate(daten.get(id)!) : [];
    const monate = alle.filter((m) => (art === "ruecklastschrift" ? m.gezahlt > 0 : m.ueberzahlt > 0));
    const standard = id === r.mieterId && art === r.art && r.jahrMonat && monate.some((m) => m.jahrMonat === r.jahrMonat)
      ? r.jahrMonat
      : monate[monate.length - 1]?.jahrMonat ?? "";
    return { mieterId: id, art, monate, monat: monatWahl[r.zahlung.zeile] ?? standard };
  };

  // Vorschau der Verteilung (Sammelzahlung, Überzahlung) für alle ausgewählten Eingänge — in der
  // Reihenfolge, in der der Server bucht (nach Datum), mit derselben Funktion.
  const vorschau = ergebnis
    ? vorschauVerteilung(
        [
          ...ergebnis.treffer.filter((t) => auswahl.has(t.zahlung.zeile)).map((t) => ({ z: t.zahlung, w: trefferWahl(t) })),
          ...ergebnis.ohneZuordnung.filter((z) => auswahl.has(z.zeile)).map((z) => ({ z, w: handWahl(z) })),
        ]
          .filter((x) => x.w.mieterId && x.w.monat)
          .sort((a, b) => a.z.datum.localeCompare(b.z.datum))
          .map((x) => ({ schluessel: x.z.zeile, mieterId: x.w.mieterId, betrag: x.z.betrag, monat: x.w.monat })),
        daten,
        aktuellerMonat,
      )
    : new Map<number, Verteilung>();

  const anzahlGewaehlt = auswahl.size;

  const umschalten = (zeile: number) =>
    setAuswahl((s) => { const n = new Set(s); if (n.has(zeile)) n.delete(zeile); else n.add(zeile); return n; });

  const buchen = () =>
    startTransition(async () => {
      if (!ergebnis) return;
      // Prüfsumme je Bankzeile (lib/kontoauszug.ts → bankzeilenSchluessel): Ein erneutes Hochladen
      // desselben Auszugs ergibt dieselben Kennungen, der Server bucht nichts doppelt.
      const schluessel = bankzeilenSchluessel(ergebnis.alle);
      const vorgang = async (zeile: number) => (await sha256Hex(schluessel.get(zeile)!)).slice(0, 40);
      const zeilen: BatchZeile[] = [];
      for (const t of ergebnis.treffer) {
        if (!auswahl.has(t.zahlung.zeile)) continue;
        const w = trefferWahl(t);
        zeilen.push({ mieter_id: w.mieterId, buchungsdatum: t.zahlung.datum, betrag: t.zahlung.betrag, soll_monat: w.monat, vorgang: await vorgang(t.zahlung.zeile) });
      }
      for (const z of ergebnis.ohneZuordnung) {
        const w = handWahl(z);
        if (!auswahl.has(z.zeile) || !w.mieterId || !w.monat) continue;
        zeilen.push({ mieter_id: w.mieterId, buchungsdatum: z.datum, betrag: z.betrag, soll_monat: w.monat, vorgang: await vorgang(z.zeile) });
      }
      for (const r of ergebnis.rueck) {
        const w = rueckWahl(r);
        if (!auswahl.has(r.zahlung.zeile) || !w.monat) continue;
        zeilen.push({ mieter_id: w.mieterId, buchungsdatum: r.zahlung.datum, betrag: r.zahlung.betrag, soll_monat: w.monat, vorgang: await vorgang(r.zahlung.zeile), art: w.art });
      }
      if (zeilen.length === 0) return toast("Keine vollständige Zeile ausgewählt — bitte Mieter und Monat wählen.", "error");
      try {
        const r = await bestaetigeMehrere(zeilen, "kontoauszug");
        if (!r.ok) return toast(r.error ?? "Buchen fehlgeschlagen.", "error");
        const zusatz = [
          r.uebersprungen ? `${r.uebersprungen} schon gebucht` : "",
          r.ueberzahlung ? `Überzahlung ${eur(r.ueberzahlung)}` : "",
        ].filter(Boolean).join(" · ");
        const gebucht = `${r.anzahl} ${r.anzahl === 1 ? "Buchung" : "Buchungen"} aus dem Kontoauszug`;
        if (r.abgelehnt?.length) toast(`${gebucht}, ${r.abgelehnt.length} nicht gebucht — Grund steht unten.`, "error");
        else toast(`${gebucht} ✓${zusatz ? ` (${zusatz})` : ""}`, "success");
        setNachher({ anzahl: r.anzahl, offen: r.offen ?? [], abgelehnt: r.abgelehnt ?? [] });
        setErgebnis(null);
        router.refresh();
      } catch {
        toast("Buchen fehlgeschlagen.", "error");
      }
    });

  const verteilungText = (zeile: number) => {
    const v = vorschau.get(zeile);
    if (!v || (v.teile.length <= 1 && v.ueberzahlung <= 0)) return null;
    const teile = v.teile.map((t) => `${monatLabel(t.jahrMonat)} ${eur(t.betrag)}`).join(" · ");
    return `→ ${teile}${v.ueberzahlung > 0 ? ` · davon Überzahlung ${eur(v.ueberzahlung)}` : ""}`;
  };

  const mitOffen = useMemo(
    () => new Set(ergebnis ? nacherfassung.filter((n) => offeneMonate(daten.get(n.mieterId)!, ergebnis.von, ergebnis.bis).length > 0).map((n) => n.mieterId) : []),
    [ergebnis, nacherfassung, daten],
  );

  return (
    <div>
      <div className="glass-card" style={{ padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label className="btn btn-gold" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} data-demo-erlaubt>
            <FileUp size={15} /> CSV-Kontoauszug wählen
            <input type="file" accept=".csv,.txt,text/csv" style={{ display: "none" }} onChange={(e) => { void lesen(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <span style={{ fontSize: 12, color: "var(--muted)", flex: 1, minWidth: 220 }}>
            Exportiere im Online-Banking die Umsätze als CSV (z. B. die letzten 3 Monate). MyImmo schlägt je Geldeingang
            vor, welche offene Miete er ausgleicht — gebucht wird erst, was du bestätigst.
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--green)", margin: "10px 0 0", display: "flex", gap: 6, alignItems: "flex-start" }}>
          <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          Die Datei wird nur in deinem Browser gelesen und nicht hochgeladen. Gespeichert werden ausschließlich die Buchungen, die du unten bestätigst.
        </p>
      </div>

      {fehler && <p role="alert" style={{ fontSize: 13, color: "var(--red)" }}>{fehler}</p>}

      {nachher && <NachDemAbgleich nachher={nachher} />}

      {ergebnis && (
        <div className="section">
          <div className="section-header">
            <div>
              <h3>{ergebnis.treffer.length} {ergebnis.treffer.length === 1 ? "Zuordnung" : "Zuordnungen"} aus „{ergebnis.datei}“</h3>
              <div className="section-sub">
                {ergebnis.ohneZuordnung.length} {ergebnis.ohneZuordnung.length === 1 ? "Eingang" : "Eingänge"} ohne Zuordnung
                {ergebnis.rueck.length > 0 ? ` · ${ergebnis.rueck.length} ${ergebnis.rueck.length === 1 ? "Ausgang" : "Ausgänge"} an Mieter` : ""}
                {" · "}{ergebnis.ausgaenge - ergebnis.rueck.length === 1 ? "1 weiterer Ausgang" : `${ergebnis.ausgaenge - ergebnis.rueck.length} weitere Ausgänge`} übersprungen
              </div>
            </div>
          </div>
          <div className="section-body">
            {ergebnis.treffer.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                Keinem Eingang ließ sich eine offene Miete sicher zuordnen. Zugeordnet wird nur bei IBAN des Mieters oder Nachname plus
                passendem Betrag — trage die IBAN beim Mieter ein, dann klappt es öfter. Eingänge ohne Zuordnung kannst du unten von Hand zuordnen.
              </p>
            ) : (
              <div className="table-scroll"><table className="ka-tabelle" style={{ fontSize: 12 }}>
                <thead><tr><th></th><th>Eingang</th><th>Zahler / Zweck</th><th>Mieter</th><th>Mietmonat</th><th>Grund</th></tr></thead>
                <tbody>
                  {ergebnis.treffer.map((t) => {
                    const an = auswahl.has(t.zahlung.zeile);
                    const w = trefferWahl(t);
                    const verteilung = an ? verteilungText(t.zahlung.zeile) : null;
                    return (
                      <tr key={t.zahlung.zeile} style={{ opacity: an ? 1 : 0.65 }}>
                        <td className="ka-wahl">
                          <input type="checkbox" checked={an} aria-label="übernehmen" data-demo-erlaubt onChange={() => umschalten(t.zahlung.zeile)} />
                        </td>
                        <td data-label="Eingang" style={{ whiteSpace: "nowrap" }}><strong>{eur(t.zahlung.betrag)}</strong><div style={{ color: "var(--muted)" }}>{datumDe(t.zahlung.datum)}</div></td>
                        <ZahlerZelle z={t.zahlung} />
                        <td data-label="Mieter">
                          {t.alternativen.length === 0 ? t.name : (
                            <select className="input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} data-demo-erlaubt aria-label="Mieter"
                              value={w.mieterId}
                              onChange={(e) => {
                                const zeile = t.zahlung.zeile;
                                setMieterWahl((s) => ({ ...s, [zeile]: e.target.value }));
                                setMonatWahl((s) => { const n = { ...s }; delete n[zeile]; return n; });
                              }}>
                              {[t, ...t.alternativen].map((k) => <option key={k.mieterId} value={k.mieterId}>{k.name} ({k.punkte} P.)</option>)}
                            </select>
                          )}
                        </td>
                        <td data-label="Mietmonat">
                          <MonatWahl monate={w.monate} wert={w.monat} onChange={(v) => setMonatWahl((s) => ({ ...s, [t.zahlung.zeile]: v }))} />
                          {verteilung && <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>{verteilung}</div>}
                        </td>
                        <td data-label="Grund">
                          {w.gewechselt ? (
                            <span className="badge badge-amber">von dir gewählt</span>
                          ) : (
                            <span className={`badge ${t.stufe === "sicher" ? "badge-green" : "badge-amber"}`}>{t.stufe}</span>
                          )}
                          <div style={{ color: "var(--faint)", fontSize: 11 }}>{(w.gewechselt ? w.gruende : t.gruende).join(" + ")}</div>
                          {t.alternativen.length > 0 && (
                            <div style={{ color: "var(--amber)", fontSize: 11 }}>
                              auch möglich: {[t, ...t.alternativen].filter((k) => k.mieterId !== w.mieterId).map((a) => a.name).join(", ")}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}

            {ergebnis.ohneZuordnung.length > 0 && (
              <details style={{ marginTop: 14 }} open={ergebnis.treffer.length === 0}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Eingänge ohne Zuordnung ({ergebnis.ohneZuordnung.length}) — von Hand zuordnen
                </summary>
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "6px 0 8px" }}>
                  Hier stehen auch Gehalt und Privates. Nur was du einem Mieter zuordnest und anhakst, wird gebucht.
                  {mitOffen.size === 0 && " Im Zeitraum des Auszugs ist bei keinem Mieter etwas offen."}
                </p>
                <div className="table-scroll"><table className="ka-tabelle" style={{ fontSize: 12 }}>
                  <thead><tr><th></th><th>Eingang</th><th>Zahler / Zweck</th><th>Mieter</th><th>Mietmonat</th></tr></thead>
                  <tbody>
                    {ergebnis.ohneZuordnung.map((z) => {
                      const w = handWahl(z);
                      const an = auswahl.has(z.zeile) && !!w.mieterId && !!w.monat;
                      const verteilung = an ? verteilungText(z.zeile) : null;
                      return (
                        <tr key={z.zeile} style={{ opacity: an ? 1 : 0.65 }}>
                          <td className="ka-wahl">
                            <input type="checkbox" checked={an} disabled={!w.mieterId || !w.monat} aria-label="übernehmen" data-demo-erlaubt onChange={() => umschalten(z.zeile)} />
                          </td>
                          <td data-label="Eingang" style={{ whiteSpace: "nowrap" }}><strong>{eur(z.betrag)}</strong><div style={{ color: "var(--muted)" }}>{datumDe(z.datum)}</div></td>
                          <ZahlerZelle z={z} />
                          <td data-label="Mieter">
                            <select className="input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} data-demo-erlaubt aria-label="Mieter"
                              value={w.mieterId}
                              onChange={(e) => {
                                setMieterWahl((s) => ({ ...s, [z.zeile]: e.target.value }));
                                setMonatWahl((s) => { const n = { ...s }; delete n[z.zeile]; return n; });
                              }}>
                              <option value="">— Mieter wählen —</option>
                              {nacherfassung.map((n) => <option key={n.mieterId} value={n.mieterId}>{n.name}{mitOffen.has(n.mieterId) ? "" : " (nichts offen)"}</option>)}
                            </select>
                            {ergebnis.hinweis[z.zeile] && !mieterWahl[z.zeile] && (
                              <div style={{ color: "var(--faint)", fontSize: 11 }}>Vorschlag aus Name/IBAN — Betrag passt zu keinem offenen Monat</div>
                            )}
                          </td>
                          <td data-label="Mietmonat">
                            {w.mieterId ? <MonatWahl monate={w.monate} wert={w.monat} onChange={(v) => setMonatWahl((s) => ({ ...s, [z.zeile]: v }))} /> : "–"}
                            {verteilung && <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>{verteilung}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              </details>
            )}

            {ergebnis.rueck.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 13, margin: "0 0 4px" }}>Ausgänge an Mieter ({ergebnis.rueck.length})</h4>
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 8px" }}>
                  Eine <strong>Rücklastschrift</strong> holt eine Mietzahlung zurück — der Monat ist danach wieder offen. Eine
                  <strong> Erstattung</strong> gibt eine Überzahlung zurück. Nichts davon ist vorausgewählt. Kaution oder
                  NK-Guthaben gehören nicht hierher, sondern unter Ein-/Ausgaben.
                </p>
                <div className="table-scroll"><table className="ka-tabelle" style={{ fontSize: 12 }}>
                  <thead><tr><th></th><th>Ausgang</th><th>Empfänger / Zweck</th><th>Mieter</th><th>Art</th><th>Mietmonat</th></tr></thead>
                  <tbody>
                    {ergebnis.rueck.map((r) => {
                      const w = rueckWahl(r);
                      const an = auswahl.has(r.zahlung.zeile) && !!w.monat;
                      return (
                        <tr key={r.zahlung.zeile} style={{ opacity: an ? 1 : 0.65 }}>
                          <td className="ka-wahl">
                            <input type="checkbox" checked={an} disabled={!w.monat} aria-label="übernehmen" data-demo-erlaubt onChange={() => umschalten(r.zahlung.zeile)} />
                          </td>
                          <td data-label="Ausgang" style={{ whiteSpace: "nowrap" }}><strong style={{ color: "var(--red)" }}>{eur(r.zahlung.betrag)}</strong><div style={{ color: "var(--muted)" }}>{datumDe(r.zahlung.datum)}</div></td>
                          <ZahlerZelle z={r.zahlung} />
                          <td data-label="Mieter">
                            {r.alternativen.length === 0 ? r.name : (
                              <select className="input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} data-demo-erlaubt aria-label="Mieter"
                                value={w.mieterId}
                                onChange={(e) => {
                                  setMieterWahl((s) => ({ ...s, [r.zahlung.zeile]: e.target.value }));
                                  setMonatWahl((s) => { const n = { ...s }; delete n[r.zahlung.zeile]; return n; });
                                }}>
                                {[{ mieterId: r.mieterId, name: r.name }, ...r.alternativen].map((k) => <option key={k.mieterId} value={k.mieterId}>{k.name}</option>)}
                              </select>
                            )}
                            <div style={{ color: "var(--faint)", fontSize: 11 }}>{r.gruende.join(" + ")}</div>
                          </td>
                          <td data-label="Art">
                            <select className="input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} data-demo-erlaubt aria-label="Art"
                              value={w.art}
                              onChange={(e) => {
                                setArtWahl((s) => ({ ...s, [r.zahlung.zeile]: e.target.value as RueckArt }));
                                setMonatWahl((s) => { const n = { ...s }; delete n[r.zahlung.zeile]; return n; });
                              }}>
                              <option value="ruecklastschrift">Rücklastschrift</option>
                              <option value="erstattung">Erstattung (Überzahlung)</option>
                            </select>
                          </td>
                          <td data-label="Mietmonat">
                            {w.monate.length === 0 ? (
                              <span style={{ color: "var(--amber)", fontSize: 11.5 }}>
                                {w.art === "ruecklastschrift" ? "Kein Monat mit Zahlung" : "Kein überzahlter Monat"} — nicht buchbar
                              </span>
                            ) : (
                              <select className="input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} data-demo-erlaubt aria-label="Mietmonat"
                                value={w.monat} onChange={(e) => setMonatWahl((s) => ({ ...s, [r.zahlung.zeile]: e.target.value }))}>
                                {w.monate.map((m) => (
                                  <option key={m.jahrMonat} value={m.jahrMonat}>
                                    {monatLabel(m.jahrMonat)} · {w.art === "ruecklastschrift" ? `gezahlt ${eur(m.gezahlt)}` : `überzahlt ${eur(m.ueberzahlt)}`}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-gold" disabled={pending || anzahlGewaehlt === 0} onClick={buchen}>
                {pending ? "Bucht…" : `${anzahlGewaehlt} ${anzahlGewaehlt === 1 ? "Umsatz" : "Umsätze"} buchen`}
              </button>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                Gebucht wird der tatsächliche Betrag mit dem Datum aus dem Auszug. Derselbe Umsatz wird nie doppelt gebucht; Teilzahlungen bleiben getrennt, ein Überschuss geht auf offene Folgemonate, der Rest wird als Überzahlung ausgewiesen.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZahlerZelle({ z }: { z: Zahlung }) {
  return (
    <td data-label="Zahler / Zweck" className="ka-zweck">
      <div>{z.name || "–"}</div>
      <div style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={z.zweck}>{z.zweck}</div>
    </td>
  );
}

function MonatWahl({ monate, wert, onChange }: { monate: { jahrMonat: string; gesamt: number; rest?: number }[]; wert: string; onChange: (v: string) => void }) {
  if (monate.length === 0) return <span style={{ color: "var(--amber)", fontSize: 11.5 }}>nichts offen</span>;
  return (
    <select className="input" style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} data-demo-erlaubt aria-label="Mietmonat"
      value={wert} onChange={(e) => onChange(e.target.value)}>
      {monate.map((m) => (
        <option key={m.jahrMonat} value={m.jahrMonat}>
          {monatLabel(m.jahrMonat)} · {m.rest != null && m.rest < m.gesamt ? `offen ${eur(m.rest)} von ${eur(m.gesamt)}` : `Soll ${eur(m.gesamt)}`}
        </option>
      ))}
    </select>
  );
}

/** Ergebnis nach dem Buchen: was weiter offen ist, mit vorbereitetem Brief — gesendet wird nichts. */
function NachDemAbgleich({ nachher }: { nachher: Nachher }) {
  return (
    <div className="section" style={{ marginBottom: 14 }}>
      <div className="section-header">
        <div>
          <h3>Nach dem Abgleich</h3>
          <div className="section-sub">
            {nachher.anzahl} {nachher.anzahl === 1 ? "Buchung" : "Buchungen"} angelegt ·{" "}
            {nachher.offen.length === 0 ? "bei den betroffenen Mietern ist nichts mehr offen" : `${nachher.offen.length} ${nachher.offen.length === 1 ? "Monat" : "Monate"} weiter offen`}
          </div>
        </div>
      </div>
      <div className="section-body">
        {nachher.abgelehnt.length > 0 && (
          <div role="alert" style={{ fontSize: 12.5, color: "var(--amber)", marginBottom: 10 }}>
            <TriangleAlert size={14} style={{ verticalAlign: "-2px" }} /> Nicht gebucht:
            <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>{nachher.abgelehnt.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}
        {nachher.offen.map((o) => (
          <div key={`${o.mieterId}-${o.jahrMonat}`} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
            <Link href={`/tenants/${o.mieterId}`} style={{ fontWeight: 600, color: "var(--text)" }}>{o.name}</Link>
            <span style={{ color: "var(--muted)" }}>{monatLabel(o.jahrMonat)}</span>
            <span style={{ color: "var(--red)", fontWeight: 600 }}>{eur(o.rest)} offen</span>
            {o.gezahlt !== 0 && <span style={{ color: "var(--muted)", fontSize: 12 }}>gezahlt {eur(o.gezahlt)} von {eur(o.gesamt)}</span>}
            <span className={`badge ${o.tageOffen > 14 ? "badge-red" : "badge-amber"}`}>
              {o.tageOffen === 0 ? "heute fällig" : `${o.tageOffen} Tag${o.tageOffen === 1 ? "" : "e"} überfällig`}
            </span>
            {o.wahl && <span style={{ marginLeft: "auto" }}><BriefWahl wahl={o.wahl} /></span>}
          </div>
        ))}
        <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "10px 0 0" }}>
          Es wurde nichts versendet. „Dokument“ öffnet einen Entwurf im Brief-Generator mit Mieter, Monat und offenem
          Betrag; ob und wie er rausgeht, entscheidest du dort.
        </p>
      </div>
    </div>
  );
}
