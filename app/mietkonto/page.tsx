import { createClient } from "@/lib/supabase/server";
import { sollFuerMonat, zuJahrMonat, ymPlus } from "@/lib/mietkonto";
import MietkontoBestaetigung, { type MietkontoZeile } from "@/components/MietkontoBestaetigung";
import type { Tenant, MietZeitraum, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

// Mietkonto: je Monat die erwarteten Mieteingänge sehen und per Klick
// bestätigen. Soll-Beträge kommen aus lib/mietkonto.ts (Miet-Zeiträume mit
// Fallback auf die Mieter-Stammdaten).

export default async function MietkontoPage({
  searchParams,
}: {
  searchParams: { monat?: string };
}) {
  const supabase = createClient();

  const jetzt = new Date();
  const aktuellerMonat = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, "0")}`;
  const monat = /^\d{4}-\d{2}$/.test(searchParams.monat ?? "") ? searchParams.monat! : aktuellerMonat;

  const monatVon = `${monat}-01`;
  const monatBisExkl = `${ymPlus(monat, 1)}-01`;

  const [{ data: mieterRows }, { data: zrRows }, { data: einnRows }, { data: propRows }] =
    await Promise.all([
      supabase.from("mieter").select("*").order("nachname"),
      supabase.from("miet_zeitraeume").select("*"),
      supabase
        .from("einnahmen")
        .select("mieter_id,buchungsdatum,kategorie")
        .gte("buchungsdatum", monatVon)
        .lt("buchungsdatum", monatBisExkl),
      supabase.from("properties").select("id,bezeichnung"),
    ]);

  const mieter = (mieterRows ?? []) as Tenant[];
  const zeitraeume = (zrRows ?? []) as MietZeitraum[];
  const einnahmen = einnRows ?? [];
  const propName = new Map(
    ((propRows ?? []) as Pick<Property, "id" | "bezeichnung">[]).map((p) => [p.id, p.bezeichnung]),
  );

  const gebuchteMieter = new Set(
    einnahmen
      .filter((e) => (e.kategorie ?? "").toLowerCase() === "miete" && zuJahrMonat(e.buchungsdatum) === monat)
      .map((e) => e.mieter_id)
      .filter(Boolean) as string[],
  );

  const zeilen: MietkontoZeile[] = [];
  for (const m of mieter) {
    const soll = sollFuerMonat(
      m,
      zeitraeume.filter((z) => z.mieter_id === m.id),
      monat,
    );
    if (!soll || soll.gesamt <= 0) continue; // im Monat nicht aktiv / kein Soll
    zeilen.push({
      mieterId: m.id,
      propId: m.prop_id,
      name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
      objekt: [m.prop_id ? propName.get(m.prop_id) : null, m.einheit].filter(Boolean).join(" · ") || "—",
      kaltmiete: soll.kaltmiete,
      nk: soll.nk,
      stellplatz: soll.stellplatz,
      gesamt: soll.gesamt,
      schonGebucht: gebuchteMieter.has(m.id),
    });
  }

  return (
    <MietkontoBestaetigung monat={monat} aktuellerMonat={aktuellerMonat} zeilen={zeilen} />
  );
}
