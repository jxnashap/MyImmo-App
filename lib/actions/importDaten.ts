"use server";

// Batch-Import (C6): vom Import-Assistenten bestätigte Zeilen anlegen.
// Objekte direkt; Mieter mit Objekt-Zuordnung über den Objektnamen
// (case-insensitiv). Es wird NUR eingefügt, nie aktualisiert/gelöscht.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pruefeEinheiten } from "@/lib/planGate";
import { mieterSchluessel, nameNorm, objektZuordnung, type ImportTyp, type ImportZeile } from "@/lib/importCsv";

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
  /** Zeilen, die es schon gibt (früherer Import oder doppelt in der Datei) — nicht erneut angelegt (B15). */
  uebersprungen?: number;
  fehler?: string;
};

export async function importiereDaten(
  typ: ImportTyp,
  zeilen: ImportZeile[],
): Promise<ImportAktionErgebnis> {
  const supabase = await createClient();
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
    if (!zeilen.some((z) => txt(z.bezeichnung))) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Keine gültigen Zeilen (Bezeichnung fehlt)." };
    // B15: Ein Objekt, das es (dem Namen nach) schon gibt, wird nicht ein zweites Mal angelegt — sonst
    // erzeugte ein wiederholter Import Dubletten, und der Mieter-Import fände den Namen danach doppelt.
    const { data: vorhanden, error: vorhandenFehler } = await supabase.from("properties").select("bezeichnung").eq("user_id", user.id);
    if (vorhandenFehler) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Objekte konnten nicht geprüft werden — es wurde nichts importiert." };
    const schon = new Set((vorhanden ?? []).map((p) => nameNorm(p.bezeichnung)));
    let uebersprungen = 0;
    const rows = zeilen
      .filter((z) => txt(z.bezeichnung))
      .filter((z) => {
        const n = nameNorm(z.bezeichnung);
        if (schon.has(n)) { uebersprungen++; return false; }
        schon.add(n);
        return true;
      })
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
    if (rows.length === 0) {
      return uebersprungen > 0
        ? { ok: true, angelegt: 0, ohneObjekt: 0, uebersprungen }
        : { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Keine gültigen Zeilen (Bezeichnung fehlt)." };
    }
    // B14 (11.10.2026): Der Import legt Objekte an wie das Formular — dieselbe Tarifgrenze (je Objekt
    // eine Einheit, die Spalte importiert er nicht). Vorher lief er daran vorbei.
    const grenze = await pruefeEinheiten(supabase, rows.length);
    if (!grenze.erlaubt) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: grenze.meldung ?? "Tarif-Limit erreicht." };
    const { error } = await supabase.from("properties").insert(rows);
    if (error?.hint === "einheiten_grenze") return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: `${error.message} Es wurde nichts importiert.` };
    if (error) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Import fehlgeschlagen." };
    revalidatePath("/properties");
    return { ok: true, angelegt: rows.length, ohneObjekt: 0, ...(uebersprungen ? { uebersprungen } : {}) };
  }

  // Mieter: Objekt-Zuordnung über den Namen (case-insensitiv, getrimmt).
  // Der Abfragefehler MUSS ausgewertet werden: Käme die Liste wegen eines
  // Fehlers leer zurück, würden ALLE Mieter ohne Objekt angelegt — und die
  // Meldung „n ohne Objekt" sähe aus wie ein Namensproblem der Eingabe.
  const { data: props, error: propsFehler } = await supabase
    .from("properties")
    .select("id,bezeichnung")
    .eq("user_id", user.id);
  if (propsFehler) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Objekte konnten nicht geladen werden — es wurde nichts importiert." };
  const objekte = (props ?? []) as { id: string; bezeichnung: string | null }[];

  // B15: Ein Name, der auf mehrere Objekte passt, wird NIE zugeordnet — dann lieber gar nicht importieren
  // als Mieter am falschen Haus (vorher gewann still das zuletzt geladene Objekt).
  const mehrdeutig = [...new Set(zeilen
    .filter((z) => txt(z.nachname) && objektZuordnung(objekte, z.objekt).art === "mehrdeutig")
    .map((z) => String(z.objekt ?? "").trim()))];
  if (mehrdeutig.length > 0) {
    return {
      ok: false, angelegt: 0, ohneObjekt: 0,
      fehler: `Der Objektname ${mehrdeutig.map((n) => `„${n}“`).join(", ")} passt auf mehrere Objekte. Bitte die Objekte eindeutig benennen (Objekt bearbeiten) und dann erneut importieren — es wurde nichts importiert.`,
    };
  }

  // Schon vorhandene Mieter (Objekt + Name + Mietbeginn) nicht ein zweites Mal anlegen.
  const { data: bestand, error: bestandFehler } = await supabase
    .from("mieter").select("prop_id,vorname,nachname,mietbeginn").eq("user_id", user.id);
  if (bestandFehler) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Mieter konnten nicht geprüft werden — es wurde nichts importiert." };
  const schon = new Set((bestand ?? []).map((m) => mieterSchluessel(m)));

  let ohneObjekt = 0;
  let uebersprungen = 0;
  const rows = zeilen
    .filter((z) => txt(z.nachname))
    .map((z) => {
      const treffer = objektZuordnung(objekte, z.objekt);
      const propId = treffer.art === "eindeutig" ? treffer.id : null;
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
    })
    .filter((r) => {
      const k = mieterSchluessel(r);
      if (schon.has(k)) { uebersprungen++; return false; }
      schon.add(k);
      if (!r.prop_id) ohneObjekt++;
      return true;
    });
  if (rows.length === 0 && uebersprungen > 0) return { ok: true, angelegt: 0, ohneObjekt: 0, uebersprungen };
  if (rows.length === 0) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Keine gültigen Zeilen (Nachname fehlt)." };
  const { error } = await supabase.from("mieter").insert(rows);
  if (error) return { ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Import fehlgeschlagen." };
  revalidatePath("/tenants");
  revalidatePath("/properties");
  return { ok: true, angelegt: rows.length, ohneObjekt, ...(uebersprungen ? { uebersprungen } : {}) };
}
