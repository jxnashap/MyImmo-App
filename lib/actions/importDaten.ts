"use server";

// Batch-Import (C6): vom Import-Assistenten bestätigte Zeilen anlegen.
// Objekte direkt; Mieter mit Objekt-Zuordnung über den Objektnamen
// (case-insensitiv). Es wird NUR eingefügt, nie aktualisiert/gelöscht.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ImportTyp, ImportZeile } from "@/lib/importCsv";

const MAX_ZEILEN = 500;

const OBJEKT_TYPEN = new Set([
  "Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie",
  "Ferienimmobilie", "Grundstück", "Garage / Stellplatz", "Garagenkomplex",
]);

/** Freitext-Typ („ETW", „Wohnung") auf unsere Objekttypen abbilden. */
function mappeTyp(roh: unknown): string {
  const t = String(roh ?? "").trim();
  if (OBJEKT_TYPEN.has(t)) return t;
  const n = t.toLowerCase();
  if (/etw|eigentumswohnung|wohnung|apartment/.test(n)) return "Eigentumswohnung";
  if (/einfamilien|efh|haus\b|reihenhaus|doppelhaus/.test(n)) return "Einfamilienhaus";
  if (/mehrfamilien|mfh|zinshaus/.test(n)) return "Mehrfamilienhaus";
  if (/gewerbe|laden|buero|büro/.test(n)) return "Gewerbeimmobilie";
  if (/ferien/.test(n)) return "Ferienimmobilie";
  if (/grundst/.test(n)) return "Grundstück";
  if (/garage|stellplatz/.test(n)) return "Garage / Stellplatz";
  return "Eigentumswohnung"; // sinnvollster Default für Kleinvermieter
}

export type ImportAktionErgebnis = {
  ok: boolean;
  angelegt: number;
  ohneObjekt: number; // Mieter, die keinem Objekt zugeordnet werden konnten
  fehler?: string;
};

export async function importiereDaten(
  typ: ImportTyp,
  zeilen: ImportZeile[],
): Promise<ImportAktionErgebnis> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Nicht angemeldet." };

  if (!Array.isArray(zeilen) || zeilen.length === 0)
    return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Keine Zeilen zum Importieren." };
  if (zeilen.length > MAX_ZEILEN)
    return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: `Zu viele Zeilen (max. ${MAX_ZEILEN}).` };

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const txt = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s.slice(0, 300);
  };
  const datum = (v: unknown) => {
    const s = String(v ?? "");
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };

  if (typ === "objekte") {
    const rows = zeilen
      .filter((z) => txt(z.bezeichnung))
      .map((z) => ({
        user_id: user.id,
        bezeichnung: txt(z.bezeichnung)!,
        adresse: txt(z.adresse),
        typ: mappeTyp(z.typ),
        kaufpreis: num(z.kaufpreis),
        kaufdatum: datum(z.kaufdatum),
        wert: num(z.wert),
        flaeche: num(z.flaeche),
        baujahr: num(z.baujahr),
        miete: num(z.miete),
        hausgeld: num(z.hausgeld),
        zimmer: num(z.zimmer),
        obj_status: "Vermietet",
        afa_methode: "auto",
      }));
    if (rows.length === 0) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Keine gültigen Zeilen (Bezeichnung fehlt)." };
    const { error } = await supabase.from("properties").insert(rows);
    if (error) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Import fehlgeschlagen." };
    revalidatePath("/properties");
    return { ok: true, angelegt: rows.length, ohneObjekt: 0 };
  }

  // Mieter: Objekt-Zuordnung über den Namen (case-insensitiv, getrimmt).
  const { data: props } = await supabase.from("properties").select("id,bezeichnung");
  const propByName = new Map(
    (props ?? []).map((p) => [String(p.bezeichnung ?? "").trim().toLowerCase(), p.id]),
  );

  let ohneObjekt = 0;
  const rows = zeilen
    .filter((z) => txt(z.nachname))
    .map((z) => {
      const objektName = String(z.objekt ?? "").trim().toLowerCase();
      const propId = objektName ? propByName.get(objektName) ?? null : null;
      if (!propId) ohneObjekt++;
      return {
        user_id: user.id,
        prop_id: propId,
        vorname: txt(z.vorname),
        nachname: txt(z.nachname)!,
        einheit: txt(z.einheit),
        email: txt(z.email),
        telefon: txt(z.telefon),
        kaltmiete: num(z.kaltmiete),
        nk_vorauszahlung: num(z.nk_vorauszahlung),
        kaution: num(z.kaution),
        mietbeginn: datum(z.mietbeginn),
        mietende: datum(z.mietende),
        flaeche: num(z.flaeche),
      };
    });
  if (rows.length === 0) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Keine gültigen Zeilen (Nachname fehlt)." };
  const { error } = await supabase.from("mieter").insert(rows);
  if (error) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Import fehlgeschlagen." };
  revalidatePath("/tenants");
  revalidatePath("/properties");
  return { ok: true, angelegt: rows.length, ohneObjekt };
}
