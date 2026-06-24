import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { eur } from "@/lib/format";
import { deleteProperty } from "@/lib/actions/properties";
import DeleteButton from "@/components/DeleteButton";
import type { Property, Kredit } from "@/lib/types";

// Emoji je Objekttyp — wie in der HTML-Vorlage.
function objektIcon(typ: string | null, name: string): string {
  const t = `${typ ?? ""} ${name}`.toLowerCase();
  if (t.includes("eigentumswohnung") || t.includes("etw") || t.includes("wohnung")) return "🏢";
  if (t.includes("ferien")) return "⛱️";
  if (t.includes("einfamilien") || t.includes("efh")) return "🏡";
  return "🏠";
}

function statusPill(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s.includes("vermietet")) return "pill-green";
  if (s.includes("selbst")) return "pill-teal";
  if (s.includes("leer")) return "pill-red";
  return "pill-neutral";
}

export default async function PropertiesPage() {
  const supabase = createClient();
  const [{ data }, { data: kred }] = await Promise.all([
    supabase.from("properties").select("*").order("bezeichnung"),
    supabase.from("kredite").select("prop_id,restschuld"),
  ]);

  const list = (data ?? []) as Property[];
  const kredite = (kred ?? []) as Pick<Kredit, "prop_id" | "restschuld">[];

  const restMap = new Map<string, number>();
  for (const k of kredite) {
    if (!k.prop_id) continue;
    restMap.set(k.prop_id, (restMap.get(k.prop_id) ?? 0) + (k.restschuld ?? 0));
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">Immobilien</h1>
          <p className="mt-1 text-white/40">Alle erfassten Objekte</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/properties/new" className="btn-outline">🔗 Importieren</Link>
          <Link href="/properties/new" className="btn-gold">+ Neu</Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card text-white/50">Noch keine Objekte. Lege dein erstes an.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const wert = p.wert ?? p.kaufpreis;
            const rendite = wert && p.miete ? ((p.miete * 12) / wert) * 100 : null;
            const rest = restMap.get(p.id) ?? 0;
            return (
              <div key={p.id} className="card flex flex-col transition hover:border-white/20">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/5 text-lg">
                    {objektIcon(p.typ, p.bezeichnung)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/properties/${p.id}`} className="block truncate font-medium hover:text-gold">
                      {p.bezeichnung}
                    </Link>
                    <div className="truncate text-sm text-white/40">{p.adresse || "Keine Adresse"}</div>
                  </div>
                  <DeleteButton
                    action={deleteProperty.bind(null, p.id)}
                    confirmText={`„${p.bezeichnung}" wirklich löschen?`}
                    className="grid h-7 w-7 place-items-center rounded-md text-white/30 transition hover:bg-red-500/10 hover:text-red-400"
                    label="✕"
                    title="Löschen"
                  />
                </div>

                {p.obj_status && (
                  <div className="mt-3">
                    <span className={`pill ${statusPill(p.obj_status)}`}>{p.obj_status}</span>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm">{eur(wert)}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/35">Wert</div>
                  </div>
                  <div>
                    <div className="text-sm">{p.miete ? eur(p.miete) : "–"}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/35">Miete/Mo</div>
                  </div>
                  <div>
                    <div className="text-sm gold">{rendite != null ? `${rendite.toFixed(2)}%` : "–"}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/35">Rendite</div>
                  </div>
                </div>

                {rest > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3 text-sm text-white/50">
                    🏦 Restschuld: <span className="text-white/80">{eur(rest)}</span>
                  </div>
                )}

                <Link
                  href={`/properties/${p.id}`}
                  className="mt-3 border-t border-white/10 pt-3 text-sm text-gold hover:underline"
                >
                  → Details anzeigen
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
