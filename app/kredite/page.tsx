import { createClient } from "@/lib/supabase/server";
import { eur, eur2 } from "@/lib/format";
import type { Kredit, Property } from "@/lib/types";

export default async function KreditePage() {
  const supabase = createClient();
  const [{ data: kred }, { data: props }] = await Promise.all([
    supabase.from("kredite").select("*"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const list = (kred ?? []) as Kredit[];

  const restSumme = list.reduce((s, k) => s + (k.restschuld ?? 0), 0);
  const rateSumme = list.reduce((s, k) => s + (k.monatsrate ?? 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl">Kredite</h1>
        <p className="mt-1 text-white/40">
          Restschuld gesamt <span style={{ color: "var(--red)" }}>{eur(restSumme)}</span>
          {"  ·  "}Raten/Mo. <span className="gold">{eur2(rateSumme)}</span>
        </p>
      </div>

      {list.length === 0 ? (
        <p className="text-white/40">Keine Kredite erfasst.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((k) => (
            <div key={k.id} className="card">
              <div className="flex items-center justify-between">
                <span className="font-medium">{k.bezeichnung || k.bank || "Darlehen"}</span>
                <span className="text-sm text-white/50">{k.prop_id ? nameOf.get(k.prop_id) ?? "" : ""}</span>
              </div>
              {k.bank && <div className="text-sm text-white/40">{k.bank}</div>}
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between"><span className="text-white/40">Restschuld</span><span>{eur(k.restschuld)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Rate/Mo.</span><span className="gold">{eur2(k.monatsrate)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Zinssatz</span><span>{k.zinssatz != null ? k.zinssatz + " %" : "—"}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Tilgung</span><span>{k.tilgungssatz != null ? k.tilgungssatz + " %" : "—"}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Zinsbindung</span><span>{k.zinsbindung ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Darlehen</span><span>{eur(k.betrag)}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
