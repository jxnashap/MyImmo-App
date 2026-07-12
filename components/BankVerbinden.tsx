"use client";

// "Konto verbinden": Bank wählen (+ optionale Objekt-Zuordnung) und zur
// Bank-Freigabe (Enable Banking) weiterleiten.
import { useMemo, useState, useTransition } from "react";
import { Landmark, Search } from "lucide-react";
import { starteBankVerbindung } from "@/lib/actions/banking";

export type BankOption = { name: string; country: string };

export default function BankVerbinden({
  banken,
  properties,
}: {
  banken: BankOption[];
  properties: { id: string; bezeichnung: string }[];
}) {
  const [suche, setSuche] = useState("");
  const [gewaehlt, setGewaehlt] = useState<BankOption | null>(null);
  const [propId, setPropId] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const liste = q ? banken.filter((b) => b.name.toLowerCase().includes(q)) : banken;
    return liste.slice(0, 30);
  }, [banken, suche]);

  const verbinden = () =>
    startTransition(async () => {
      if (!gewaehlt) return;
      setFehler(null);
      const fd = new FormData();
      fd.set("aspspName", gewaehlt.name);
      fd.set("aspspCountry", gewaehlt.country);
      fd.set("propId", propId);
      const r = await starteBankVerbindung(fd);
      if (r.error || !r.url) setFehler(r.error ?? "Start fehlgeschlagen.");
      else window.location.assign(r.url); // weiter zur Bank-Freigabe
    });

  return (
    <div className="section">
      <div className="section-header"><h3><Landmark size={15} style={{ verticalAlign: "-2px" }} /> Konto verbinden</h3></div>
      <div className="section-body" style={{ display: "grid", gap: 10 }}>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          Du wirst zum sicheren Login deiner Bank weitergeleitet und gibst dort den
          <strong> Lesezugriff</strong> frei — MyImmo sieht nie dein Bank-Passwort.
          Die Freigabe gilt 90 Tage (PSD2) und ist jederzeit widerrufbar.
        </p>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--faint)" }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Bank suchen (z. B. Sparkasse, DKB … / Sandbox: Mock)"
            value={suche}
            onChange={(e) => { setSuche(e.target.value); setGewaehlt(null); }}
          />
        </div>
        {gefiltert.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--faint)", margin: 0 }}>Keine Bank gefunden.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto" }}>
            {gefiltert.map((b) => {
              const aktiv = gewaehlt?.name === b.name && gewaehlt?.country === b.country;
              return (
                <button
                  key={`${b.name}|${b.country}`}
                  type="button"
                  className="badge"
                  onClick={() => setGewaehlt(aktiv ? null : b)}
                  style={{
                    cursor: "pointer", border: `1px solid ${aktiv ? "var(--gold)" : "var(--line)"}`,
                    background: aktiv ? "var(--gold-pale)" : "var(--bg3)", color: aktiv ? "var(--gold)" : "var(--muted)",
                    padding: "6px 12px", fontSize: 12,
                  }}
                >
                  {b.name} <span style={{ opacity: 0.6 }}>({b.country})</span>
                </button>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
            <label>Objekt zuordnen (optional)</label>
            <select value={propId} onChange={(e) => setPropId(e.target.value)}>
              <option value="">– kein Objekt –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-gold" disabled={pending || !gewaehlt} onClick={verbinden}>
            {pending ? "Starte …" : gewaehlt ? `${gewaehlt.name} verbinden` : "Bank wählen"}
          </button>
        </div>
        {fehler && <p style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
      </div>
    </div>
  );
}
