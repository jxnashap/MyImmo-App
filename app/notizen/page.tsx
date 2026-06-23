import { createClient } from "@/lib/supabase/server";
import type { Notiz, Property } from "@/lib/types";

export default async function NotizenPage() {
  const supabase = createClient();
  const [{ data: not }, { data: props }] = await Promise.all([
    supabase.from("notizen").select("*").order("created_at", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const list = (not ?? []) as Notiz[];

  return (
    <div>
      <h1 className="mb-6 text-3xl">Notizen</h1>
      {list.length === 0 ? (
        <p className="text-white/40">Keine Notizen.</p>
      ) : (
        <div className="grid gap-3">
          {list.map((n) => (
            <div key={n.id} className="card">
              <div className="flex items-center justify-between">
                <span className="font-medium">{n.titel || "Ohne Titel"}</span>
                <span className="text-xs text-white/40">
                  {n.kategorie ? n.kategorie + " · " : ""}{n.prop_id ? nameOf.get(n.prop_id) ?? "" : ""}
                </span>
              </div>
              {n.inhalt && <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{n.inhalt}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
