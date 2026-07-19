import { NextResponse } from "next/server";
import { KOSTEN_SPALTEN } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Excel-freundlicher CSV-Export aller Buchungen (Einnahmen + Kosten) als
// Datensicherung — ergänzt den JSON-Gesamtexport (/api/export) und den
// Anlage-V-CSV. Semikolon-getrennt, deutsche Zahlen, BOM für Umlaute.

const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const zahl = (n: number | null | undefined) =>
  n == null ? "" : n.toFixed(2).replace(".", ",");

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });

  const [{ data: einnahmen }, { data: kosten }, { data: props }] = await Promise.all([
    supabase.from("einnahmen").select("*"),
    supabase.from("kosten").select(KOSTEN_SPALTEN),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const nameOf = new Map(
    ((props ?? []) as { id: string; bezeichnung: string }[]).map((p) => [p.id, p.bezeichnung]),
  );
  const propName = (id: string | null) => (id ? nameOf.get(id) ?? "" : "");

  type Zeile = {
    datum: string;
    typ: "Einnahme" | "Kosten";
    kategorie: string;
    objekt: string;
    text: string;
    betrag: number | null;
    nkAnteil: number | null;
  };

  const zeilen: Zeile[] = [
    ...((einnahmen ?? []) as Record<string, unknown>[]).map((e) => ({
      datum: String(e.buchungsdatum ?? ""),
      typ: "Einnahme" as const,
      kategorie: String(e.kategorie ?? ""),
      objekt: propName(e.prop_id as string | null),
      text: String(e.beschreibung ?? ""),
      betrag: (e.betrag as number | null) ?? null,
      nkAnteil: (e.nk_anteil as number | null) ?? null,
    })),
    ...((kosten ?? []) as Record<string, unknown>[]).map((k) => ({
      datum: String(k.buchungsdatum ?? ""),
      typ: "Kosten" as const,
      kategorie: String(k.kategorie ?? ""),
      objekt: propName(k.prop_id as string | null),
      text: String(k.beschreibung ?? k.notiz ?? ""),
      betrag: (k.betrag as number | null) ?? null,
      nkAnteil: null,
    })),
  ].sort((a, b) => a.datum.localeCompare(b.datum));

  const kopf = [
    "Datum",
    "Typ",
    "Kategorie",
    "Objekt",
    "Bezeichnung/Notiz",
    "Betrag (EUR)",
    "NK-Anteil (EUR)",
  ];
  const rows = zeilen.map((z) =>
    [esc(z.datum), esc(z.typ), esc(z.kategorie), esc(z.objekt), esc(z.text), zahl(z.betrag), zahl(z.nkAnteil)].join(";"),
  );
  // BOM, damit Excel die UTF-8-Umlaute korrekt erkennt.
  const csv = "\ufeff" + [kopf.map(esc).join(";"), ...rows].join("\r\n") + "\r\n";

  const heute = new Date().toISOString().split("T")[0];
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="myimmo-buchungen-${heute}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
