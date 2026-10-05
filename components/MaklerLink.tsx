"use client";

// Makler-Link (05.10.2026): ausgewählte Dokumente des Makler-Ordners als zeitlich begrenzter Link —
// Gegenstück zum Bank-Link im Beleihungsordner. Erstellen nur nach frischer Anmeldung
// (`useReAuth`, Server prüft `pruefeFrischeAnmeldung`). Datensparsame Dokumente (Eigenkapital,
// Einkommen, Ausweis) sind NICHT vorausgewählt; wer sie wählt, sieht einen Hinweis.
// Jeder Datei-Abruf über den Link steht im Abruf-Protokoll darunter.

import { useState } from "react";
import { Share2, Copy, Mail, X, TriangleAlert, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useReAuth } from "@/components/ReAuthDialog";
import { MAKLER_CHECKLISTE, maklerLinkPfad, maklerVorauswahl, type MaklerDok } from "@/lib/makler";
import { createMaklerFreigabe, widerrufeMaklerFreigabe, type MaklerFreigabe } from "@/lib/actions/makler";
import { teilbarerLink } from "@/lib/appUrl";
import { abrufeJeLink, abrufZusammenfassung, type Abruf } from "@/lib/freigabeAbrufe";

export default function MaklerLink({
  docs, initialFreigaben, abrufe, jetzt,
}: { docs: Record<string, MaklerDok>; initialFreigaben: MaklerFreigabe[]; abrufe: Abruf[]; jetzt: string }) {
  const toast = useToast();
  const { absichern, dialog } = useReAuth();
  const [freigaben, setFreigaben] = useState(initialFreigaben);
  const [offen, setOffen] = useState(false);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [tage, setTage] = useState("14");
  const [busy, setBusy] = useState(false);
  const [neuerLink, setNeuerLink] = useState<string | null>(null);
  const [protokoll, setProtokoll] = useState<string | null>(null);

  const teilbar = MAKLER_CHECKLISTE.filter((i) => !!docs[i.key]?.datei_name);
  const heikelGewaehlt = teilbar.some((i) => i.datensparsam && auswahl.has(i.key));
  const jeLink = abrufeJeLink(abrufe);
  const label = new Map(MAKLER_CHECKLISTE.map((i) => [i.key, i.label]));
  const laeuft = (f: MaklerFreigabe) => f.aktiv && new Date(f.ablauf).getTime() > new Date(jetzt).getTime();

  function oeffnen() {
    setAuswahl(maklerVorauswahl(docs));
    setNeuerLink(null);
    setOffen(true);
  }

  function erstellen() {
    void absichern(async () => {
      setBusy(true);
      try {
        const f = await createMaklerFreigabe([...auswahl], Number(tage));
        setFreigaben((p) => [f, ...p]);
        setNeuerLink(teilbarerLink(maklerLinkPfad(f.token)));
      } catch (e) {
        toast(e instanceof Error ? e.message : "Link konnte nicht erstellt werden.", "error");
      } finally {
        setBusy(false);
      }
    });
  }

  async function widerrufen(token: string) {
    try {
      await widerrufeMaklerFreigabe(token);
      setFreigaben((p) => p.map((x) => (x.token === token ? { ...x, aktiv: false } : x)));
      toast("Link widerrufen — er ist sofort ungültig.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Widerrufen fehlgeschlagen.", "error");
    }
  }

  function kopieren(link: string) {
    navigator.clipboard.writeText(link).then(
      () => toast("Link kopiert."),
      () => toast("Kopieren fehlgeschlagen.", "error"),
    );
  }

  return (
    <div className="section" style={{ margin: 0 }}>
      {dialog}
      <div className="section-header" style={{ flexWrap: "wrap", gap: 8 }}>
        <h3><Share2 size={13} style={{ verticalAlign: "-2px" }} /> Link für den Makler</h3>
        {!offen && (
          <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} onClick={oeffnen} disabled={teilbar.length === 0}
            title={teilbar.length === 0 ? "Erst eine Datei hinterlegen" : undefined}>
            Link erstellen
          </button>
        )}
      </div>

      {offen && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "grid", gap: 10 }}>
          {neuerLink ? (
            <>
              <div style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontSize: 12, wordBreak: "break-all" }}>{neuerLink}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => kopieren(neuerLink)}><Copy size={13} /> Kopieren</button>
                <a className="btn btn-ghost" style={{ fontSize: 12 }}
                  href={`mailto:?subject=${encodeURIComponent("Meine Unterlagen als Kaufinteressent")}&body=${encodeURIComponent(`Guten Tag,\n\nüber folgenden Link finden Sie meine Unterlagen:\n${neuerLink}\n\nDer Link ist zeitlich begrenzt gültig. Bitte leiten Sie ihn nicht weiter.\n\nMit freundlichen Grüßen`)}`}>
                  <Mail size={13} /> Per E-Mail
                </a>
                <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginLeft: "auto" }} onClick={() => setOffen(false)}>Fertig</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                Wähle, was der Makler herunterladen darf. Der Link läuft automatisch ab, ist jederzeit widerrufbar,
                und jeder Abruf erscheint unten im Protokoll.
              </p>
              <div style={{ border: "1px solid var(--line)", borderRadius: 10 }}>
                {teilbar.map((i) => (
                  <label key={i.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid var(--line)", cursor: "pointer", fontSize: 12.5 }}>
                    <input type="checkbox" checked={auswahl.has(i.key)} style={{ accentColor: "var(--gold)" }}
                      onChange={(e) => setAuswahl((p) => {
                        const n = new Set(p);
                        if (e.target.checked) n.add(i.key); else n.delete(i.key);
                        return n;
                      })} />
                    <span style={{ flex: 1 }}>{i.label}</span>
                    {i.datensparsam && <span className="badge badge-amber">sensibel</span>}
                  </label>
                ))}
              </div>
              {heikelGewaehlt && (
                <div style={{ fontSize: 11.5, color: "var(--amber)", fontWeight: 600, lineHeight: 1.5 }}>
                  <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> Eigenkapital-, Einkommens- und Ausweisunterlagen
                  braucht ein Makler meist nicht als Datei. Beim Ausweis darfst du nicht benötigte Angaben (z. B. Zugangsnummer)
                  schwärzen — frag im Zweifel nach, wofür die Kopie gebraucht wird.
                </div>
              )}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Gültig für</label>
                  <select value={tage} onChange={(e) => setTage(e.target.value)}>
                    <option value="7">7 Tage</option>
                    <option value="14">14 Tage</option>
                    <option value="30">30 Tage</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOffen(false)}>Abbrechen</button>
                  <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} disabled={busy || auswahl.size === 0} onClick={erstellen}>
                    {busy ? "Erzeuge…" : `Link erzeugen (${auswahl.size})`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {freigaben.length === 0 && !offen && (
        <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted)" }}>
          Noch kein Link. Mit einem Link lädt der Makler die gewählten Dokumente selbst herunter — ohne Konto, zeitlich begrenzt.
        </div>
      )}

      {freigaben.slice(0, 10).map((f) => {
        const aktiv = laeuft(f);
        const liste = jeLink.get(f.token);
        const auf = protokoll === f.token;
        return (
          <div key={f.token} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", opacity: aktiv ? 1 : 0.65 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {f.item_keys.length} Dokument{f.item_keys.length === 1 ? "" : "e"} ·{" "}
                  {aktiv ? `gültig bis ${new Date(f.ablauf).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}` : f.aktiv ? "abgelaufen" : "widerrufen"}
                </div>
                <button type="button" onClick={() => setProtokoll(auf ? null : f.token)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: liste?.length ? "var(--gold)" : "var(--muted)" }}>
                  {abrufZusammenfassung(liste)} {liste?.length ? (auf ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : null}
                </button>
              </div>
              {aktiv && (
                <>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => kopieren(teilbarerLink(maklerLinkPfad(f.token)))}><Copy size={12} /> Kopieren</button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11, color: "var(--red)" }} onClick={() => widerrufen(f.token)}><X size={12} /> Widerrufen</button>
                </>
              )}
            </div>
            {auf && liste && (
              <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                {liste.map((a, n) => (
                  <li key={n} style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", gap: 8 }}>
                    <span style={{ minWidth: 118 }}>{new Date(a.abgerufen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span style={{ color: "var(--text)" }}>{label.get(a.item_key) ?? a.item_key}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
