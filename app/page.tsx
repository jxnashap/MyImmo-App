import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

const eur = (n: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-semibold mb-2">Willkommen bei MyImmo</h1>
        <p className="text-white/60 mb-6">Bitte einloggen, um dein Portfolio zu sehen.</p>
        <Link href="/login" className="rounded-lg bg-gold px-5 py-2 font-medium text-ink">
          Einloggen
        </Link>
      </div>
    );
  }

  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .order("bezeichnung");

  const list = (properties ?? []) as Property[];
  const totalValue = list.reduce((s, p) => s + (p.wert ?? p.kaufpreis ?? 0), 0);
  const totalRent = list.reduce((s, p) => s + (p.miete ?? 0), 0);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio-Überblick</h1>
          <p className="mt-1 text-white/60">
            Gesamtwert <span className="font-semibold text-gold">{eur(totalValue)}</span>
            {"  ·  "}Soll-Miete/Monat <span className="font-semibold">{eur(totalRent)}</span>
            {"  ·  "}{list.length} {list.length === 1 ? "Objekt" : "Objekte"}
          </p>
        </div>
        <Link href="/properties" className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
          Objekte verwalten
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="text-white/50">Noch keine Immobilien angelegt.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/properties/${p.id}`}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/25"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{p.bezeichnung}</h2>
                {p.obj_status && (
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60">
                    {p.obj_status}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-white/50">{p.adresse || "Keine Adresse"}</p>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-white/50">Aktueller Wert</span>
                <span className="font-medium text-gold">{eur(p.wert ?? p.kaufpreis)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
