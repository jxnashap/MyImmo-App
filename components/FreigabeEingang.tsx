"use client";

// Eingang des Eigentümers (06.10.2026): Dateien, die Bank oder Makler über ihren Link
// zurückgeschickt haben. Nichts davon liegt automatisch in den Unterlagen — erst „Ins Archiv
// übernehmen“ legt einen Archiv-Eintrag an; „Verwerfen“ leert die Datei. Beides ist endgültig.
import { useState } from "react";
import { Eye, Inbox, Archive, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { ARCHIV_ARTEN } from "@/components/ArchivManager";
import { uebernimmEingang, verwirfEingang } from "@/lib/actions/freigabeEingang";
import { EINGANG_STATUS_TEXT, type EingangZeile } from "@/lib/freigabeEingang";

const zeit = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });

const groesse = (b: number) =>
  b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export default function FreigabeEingang({
  zeilen,
  wer,
  werNom,
  nurLesen = false,
}: {
  zeilen: EingangZeile[];
  /** „der Bank“ / „dem Makler“ — für die Überschrift. */
  wer: string;
  /** „die Bank“ / „der Makler“ — für den Leerzustand. */
  werNom: string;
  nurLesen?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [titel, setTitel] = useState<Record<string, string>>({});
  const [art, setArt] = useState<Record<string, string>>({});

  const offen = zeilen.filter((z) => z.status === "neu");
  const erledigt = zeilen.filter((z) => z.status !== "neu").slice(0, 5);

  async function uebernehmen(z: EingangZeile) {
    setBusy(z.id);
    try {
      const r = await uebernimmEingang(z.id, titel[z.id] ?? z.datei_name, art[z.id] ?? "Sonstiges");
      if ("error" in r) toast(r.error, "error");
      else toast("Ins Archiv übernommen.");
    } catch {
      toast("Übernehmen fehlgeschlagen.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function verwerfen(z: EingangZeile) {
    if (!confirm(`„${z.datei_name}“ verwerfen? Die Datei wird gelöscht und lässt sich nicht wiederherstellen.`)) return;
    setBusy(z.id);
    try {
      const r = await verwirfEingang(z.id);
      if ("error" in r) toast(r.error, "error");
      else toast("Verworfen.");
    } catch {
      toast("Verwerfen fehlgeschlagen.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div id="eingang" className="section" style={{ marginBottom: 18 }}>
      <div className="section-header">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Inbox size={16} /> Eingang von {wer}
          {offen.length > 0 && <span className="badge badge-gold">{offen.length} neu</span>}
        </h3>
      </div>
      {zeilen.length === 0 && (
        <div style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
          Noch nichts eingegangen. Über den Link kann {werNom} Dateien zurückschicken — sie landen hier, nicht direkt in deinen Unterlagen.
        </div>
      )}
      {offen.map((z) => (
        <div key={z.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, overflowWrap: "anywhere" }}>{z.datei_name}</strong>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {zeit(z.created_at)} · {groesse(z.datei_size)}{z.absender ? ` · ${z.absender}` : ""}
            </span>
          </div>
          {z.nachricht && <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{z.nachricht}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <a className="btn btn-ghost" style={{ fontSize: 12 }} href={`/api/freigabe-eingang/${z.id}`} target="_blank" rel="noopener noreferrer">
              <Eye size={13} /> Ansehen
            </a>
            {!nurLesen && (
              <>
                <input
                  className="set-input"
                  style={{ flex: "1 1 180px", minWidth: 0 }}
                  aria-label="Titel im Archiv"
                  value={titel[z.id] ?? z.datei_name}
                  onChange={(e) => setTitel({ ...titel, [z.id]: e.target.value })}
                />
                <select
                  className="set-input"
                  style={{ flex: "0 1 190px" }}
                  aria-label="Art im Archiv"
                  value={art[z.id] ?? "Sonstiges"}
                  onChange={(e) => setArt({ ...art, [z.id]: e.target.value })}
                >
                  {ARCHIV_ARTEN.map((a) => <option key={a}>{a}</option>)}
                </select>
                <button className="btn btn-gold" style={{ fontSize: 12 }} disabled={busy === z.id} onClick={() => uebernehmen(z)}>
                  <Archive size={13} /> Ins Archiv übernehmen
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy === z.id} onClick={() => verwerfen(z)}>
                  <X size={13} /> Verwerfen
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {erledigt.length > 0 && (
        <div style={{ padding: "8px 16px 12px" }}>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Zuletzt entschieden</div>
          {erledigt.map((z) => (
            <div key={z.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "4px 0" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.datei_name}</span>
              {z.status === "uebernommen" ? (
                <a href="/archiv" style={{ color: "var(--gold)", whiteSpace: "nowrap" }}>{EINGANG_STATUS_TEXT[z.status]} → Archiv</a>
              ) : (
                <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{EINGANG_STATUS_TEXT[z.status]}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
