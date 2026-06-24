import { createClient } from "@/lib/supabase/server";
import { eur2, istUmlagefaehig } from "@/lib/format";
import type { Kosten, Property, Tenant } from "@/lib/types";

export default async function KostenPage({
  searchParams,
}: {
  searchParams: { prop?: string; mieter?: string; umlage?: string };
}) {
  const supabase = createClient();
  const [{ data: kost }, { data: props }, { data: miet }] = await Promise.all([
    supabase.from("kosten").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[];
  const propName = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const mietName = new Map(tenants.map((t): [string, string] => [t.id, `${t.vorname ?? ""} ${t.nachname ?? ""}`.trim()]));

  let list = (kost ?? []) as Kosten[];
  if (searchParams.prop) list = list.filter((k) => k.prop_id === searchParams.prop);
  if (searchParams.mieter) list = list.filter((k) => k.mieter_id === searchParams.mieter);
  if (searchParams.umlage) list = list.filter((k) => istUmlagefaehig(k.kategorie) === searchParams.umlage);
  const total = list.reduce((s, k) => s + (k.betrag ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">Kosten &amp; Ausgaben</h1>
          <p className="mt-1 text-white/40">Alle erfassten Ausgaben</p>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
          <select name="prop" defaultValue={searchParams.prop ?? ""} className="input">
            <option value="">Alle Immobilien</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
          </select>
          <select name="mieter" defaultValue={searchParams.mieter ?? ""} className="input">
            <option value="">Alle Mieter</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{`${t.vorname ?? ""} ${t.nachname ?? ""}`.trim()}</option>)}
          </select>
          <select name="umlage" defaultValue={searchParams.umlage ?? ""} className="input">
            <option value="">Umlage: alle</option>
            <option value="ja">umlagefähig</option>
            <option value="nein">nicht umlagefähig</option>
            <option value="unklar">prüfen</option>
          </select>
          <button className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/5">Filtern</button>
        </form>
      </div>

      <div className="mb-4 text-sm text-white/50">
        {list.length} Buchungen · Summe <span style={{ color: "var(--red)" }}>{eur2(total)}</span>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Datum</th>
              <th className="px-4 py-3 font-medium">Immobilie</th>
              <th className="px-4 py-3 font-medium">Mieter</th>
              <th className="px-4 py-3 font-medium">Kategorie</th>
              <th className="px-4 py-3 font-medium">Umlage</th>
              <th className="px-4 py-3 text-right font-medium">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {list.map((k) => {
              const u = istUmlagefaehig(k.kategorie);
              return (
                <tr key={k.id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white/70">{k.buchungsdatum ?? "—"}</td>
                  <td className="px-4 py-3 text-white/70">{k.prop_id ? propName.get(k.prop_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3 text-white/70">{k.mieter_id ? mietName.get(k.mieter_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3">{k.kategorie ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u === "ja" ? "badge-ja" : u === "nein" ? "badge-nein" : "badge-neutral"}`}>
                      {u === "ja" ? "umlagefähig" : u === "nein" ? "nicht" : "prüfen"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{eur2(k.betrag)}</td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">Keine Kosten.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
