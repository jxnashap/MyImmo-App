import { createClient } from "@/lib/supabase/server";
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

  // Automatische Fristen ableiten
  const fristen: Frist[] = [];
  for (const m of (miet ?? []) as { vorname: string | null; nachname: string | null; mietende: string | null }[]) {
    if (m.mietende) fristen.push({ datum: m.mietende, titel: `Mietende — ${[m.vorname, m.nachname].filter(Boolean).join(" ")}`, typ: "Mietverhältnis" });
  }
  for (const k of (kred ?? []) as { bezeichnung: string | null; zinsbindung: string | null }[]) {
    if (k.zinsbindung) fristen.push({ datum: k.zinsbindung, titel: `Zinsbindung endet — ${k.bezeichnung ?? "Darlehen"}`, typ: "Finanzierung" });
  }
  fristen.sort((a, b) => a.datum.localeCompare(b.datum));

  return (
    <div>
      <h1 className="mb-6 text-3xl">Termine</h1>

      {/* Neuer Termin */}
      <form action={createTermin} className="mb-8 flex flex-wrap items-end gap-3 rounded-[10px] border border-white/10 bg-white/[0.02] p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">Titel</span>
          <input name="titel" required className="input" placeholder="z.B. Heizungswartung" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">Datum</span>
          <input name="datum" type="date" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">Immobilie</span>
          <select name="prop_id" className="input">
            <option value="">—</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-[160px]">
          <span className="text-white/60">Notiz</span>
          <input name="notiz" className="input" />
        </label>
        <button className="btn-gold">+ Termin</button>
      </form>

      {/* Eigene Termine */}
      <h2 className="mb-3 text-xl">Eigene Termine</h2>
      {termine.length === 0 ? (
        <p className="mb-8 text-sm text-white/40">Keine eigenen Termine.</p>
      ) : (
        <div className="mb-8 overflow-hidden rounded-[10px] border border-white/10">
          <table className="w-full text-sm">
            <tbody>
              {termine.map((t) => {
                const del = deleteTermin.bind(null, t.id);
                return (
                  <tr key={t.id} className="border-t border-white/10 first:border-t-0">
                    <td className="px-4 py-3 text-white/70 w-32">{t.datum ?? "—"}</td>
                    <td className="px-4 py-3">{t.titel}</td>
                    <td className="px-4 py-3 text-white/50">{t.notiz ?? ""}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={del}><button className="text-white/30 hover:text-red-400">✕</button></form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Fristen */}
      <h2 className="mb-3 text-xl">Automatische Fristen</h2>
      {fristen.length === 0 ? (
        <p className="text-sm text-white/40">Keine Fristen aus Mietverhältnissen oder Krediten.</p>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-white/10">
          <table className="w-full text-sm">
            <tbody>
              {fristen.map((f, i) => (
                <tr key={i} className="border-t border-white/10 first:border-t-0">
                  <td className="px-4 py-3 text-white/70 w-32">{f.datum}</td>
                  <td className="px-4 py-3">{f.titel}</td>
                  <td className="px-4 py-3 text-right"><span className="badge badge-neutral">{f.typ}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
