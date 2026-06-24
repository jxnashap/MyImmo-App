import { createClient } from "@/lib/supabase/server";
import { datum } from "@/lib/format";
import { createTermin, deleteTermin } from "@/lib/actions/termine";
import type { Termin, Property } from "@/lib/types";

type Frist = { datum: string; titel: string; typ: string };

export default async function TerminePage() {
  const supabase = createClient();
  const [{ data: term }, { data: props }, { data: miet }, { data: kred }] = await Promise.all([
    supabase.from("termine").select("*").order("datum"),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("vorname,nachname,mietende"),
    supabase.from("kredite").select("bezeichnung,zinsbindung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const termine = (term ?? []) as Termin[];

  const fristen: Frist[] = [];
  for (const m of (miet ?? []) as { vorname: string | null; nachname: string | null; mietende: string | null }[]) {
    if (m.mietende) fristen.push({ datum: m.mietende, titel: `Mietende — ${[m.vorname, m.nachname].filter(Boolean).join(" ")}`, typ: "Mietverhältnis" });
  }
  for (const k of (kred ?? []) as { bezeichnung: string | null; zinsbindung: string | null }[]) {
    if (k.zinsbindung) fristen.push({ datum: k.zinsbindung, titel: `Zinsbindung endet — ${k.bezeichnung ?? "Darlehen"}`, typ: "Finanzierung" });
  }
  fristen.sort((a, b) => a.datum.localeCompare(b.datum));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">📅 Termine</div>
          <div className="topbar-sub">Fristen aus Mietern &amp; Krediten plus eigene Termine</div>
        </div>
      </div>

      {/* Neuer Termin */}
      <div className="section">
        <div className="section-header"><h3>＋ Neuer Termin</h3></div>
        <div className="section-body">
          <form action={createTermin} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Titel</span>
              <input name="titel" required className="input" placeholder="z.B. Heizungswartung" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Datum</span>
              <input name="datum" type="date" required className="input" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Immobilie</span>
              <select name="prop_id" className="input">
                <option value="">—</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, flex: 1, minWidth: 160 }}>
              <span style={{ color: "var(--muted)" }}>Notiz</span>
              <input name="notiz" className="input" />
            </label>
            <button className="btn btn-gold">＋ Termin</button>
          </form>
        </div>
      </div>

      {/* Eigene Termine */}
      <div className="section">
        <div className="section-header"><h3>Eigene Termine</h3></div>
        <div className="section-body">
          {termine.length === 0 ? (
            <div className="empty"><div className="empty-icon">📅</div><p>Keine eigenen Termine</p></div>
          ) : (
            <table>
              <tbody>
                {termine.map((t) => {
                  const del = deleteTermin.bind(null, t.id);
                  return (
                    <tr key={t.id}>
                      <td style={{ color: "var(--muted)", width: 110 }}>{datum(t.datum)}</td>
                      <td style={{ fontWeight: 500 }}>{t.titel}</td>
                      <td style={{ color: "var(--muted)" }}>{t.notiz ?? ""}</td>
                      <td style={{ textAlign: "right" }}>
                        <form action={del}><button className="delete-btn">✕</button></form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Automatische Fristen */}
      <div className="section">
        <div className="section-header"><h3>Automatische Fristen</h3></div>
        <div className="section-body">
          {fristen.length === 0 ? (
            <div className="empty"><div className="empty-icon">🗓️</div><p>Keine Fristen aus Mietverhältnissen oder Krediten</p></div>
          ) : (
            <table>
              <tbody>
                {fristen.map((f, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--muted)", width: 110 }}>{datum(f.datum)}</td>
                    <td style={{ fontWeight: 500 }}>{f.titel}</td>
                    <td style={{ textAlign: "right" }}><span className="badge badge-teal">{f.typ}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
