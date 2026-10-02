"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { VOLLMACHT_ARTEN, VOLLMACHT_FORMEN, VOLLMACHT_DATEITYPEN, VOLLMACHT_MAX_BYTES } from "@/lib/vertreter";

// Vertreter / Bevollmächtigter (02.10.2026). Stammdaten einer Vertrauensperson und ihrer
// Vollmacht — KEIN App-Zugang (siehe lib/vertreter.ts). Jeder Schreibvorgang filtert
// ausdrücklich auf das eigene Konto; RLS ist die zweite Linie.

type Ergebnis = { ok: true } | { error: string };

const text = (fd: FormData, k: string, max: number): string | null => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const datum = (fd: FormData, k: string): string | null | false => {
  const v = String(fd.get(k) ?? "").trim();
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : false;
};

/** Anlegen (ohne `id`) oder ändern (mit `id`). Ein neuer Scan ersetzt den alten. */
export async function speichereVertreter(fd: FormData): Promise<Ergebnis> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const id = String(fd.get("id") ?? "").trim();
  const nachname = text(fd, "nachname", 100);
  if (!nachname) return { error: "Bitte den Nachnamen des Vertreters angeben." };

  const art = String(fd.get("vollmacht_art") ?? "");
  const form = String(fd.get("vollmacht_form") ?? "");
  if (!(art in VOLLMACHT_ARTEN)) return { error: "Bitte die Art der Vollmacht wählen." };
  if (!(form in VOLLMACHT_FORMEN)) return { error: "Bitte die Form der Vollmacht wählen." };

  const email = text(fd, "email", 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Die E-Mail-Adresse sieht nicht gültig aus." };

  const daten: Record<string, string | null> = {};
  for (const k of ["geburtsdatum", "ausgestellt_am", "gueltig_bis", "widerrufen_am"]) {
    const d = datum(fd, k);
    if (d === false) return { error: "Ein Datum ist ungültig." };
    daten[k] = d;
  }
  if (daten.ausgestellt_am && daten.gueltig_bis && daten.gueltig_bis < daten.ausgestellt_am) {
    return { error: "„Gültig bis“ liegt vor dem Ausstellungsdatum." };
  }

  const zeile: Record<string, unknown> = {
    vorname: text(fd, "vorname", 100),
    nachname,
    beziehung: text(fd, "beziehung", 100),
    geburtsort: text(fd, "geburtsort", 100),
    strasse: text(fd, "strasse", 200),
    plz: text(fd, "plz", 20),
    ort: text(fd, "ort", 100),
    land: text(fd, "land", 100),
    email,
    telefon: text(fd, "telefon", 50),
    vollmacht_art: art,
    vollmacht_form: form,
    umfang: text(fd, "umfang", 2000),
    im_ausland_unterzeichnet: fd.get("im_ausland_unterzeichnet") === "on",
    apostille: fd.get("apostille") === "on",
    beglaubigt_durch: text(fd, "beglaubigt_durch", 200),
    original_bei: text(fd, "original_bei", 200),
    notiz: text(fd, "notiz", 2000),
    ...daten,
    updated_at: new Date().toISOString(),
  };

  // Scan der Vollmacht: nur PDF/JPG/PNG, höchstens 8 MB. Ausgeliefert wird über dateiKopf().
  const f = fd.get("datei");
  if (f && typeof f !== "string" && (f as File).size > 0) {
    const file = f as File;
    if (file.size > VOLLMACHT_MAX_BYTES) return { error: "Die Datei ist zu groß (höchstens 8 MB)." };
    if (!(VOLLMACHT_DATEITYPEN as readonly string[]).includes(file.type)) {
      return { error: "Bitte die Vollmacht als PDF, JPG oder PNG hochladen." };
    }
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    Object.assign(zeile, {
      datei_name: (file.name || "Vollmacht").slice(0, 200),
      datei_type: file.type,
      datei_size: file.size,
      datei_data: `data:${file.type};base64,${base64}`,
    });
  } else if (id && fd.get("datei_entfernen") === "on") {
    Object.assign(zeile, { datei_name: null, datei_type: null, datei_size: null, datei_data: null });
  }

  if (id) {
    const { data, error } = await supabase
      .from("vertreter").update(zeile).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error || !data) return { error: "Der Vertreter konnte nicht gespeichert werden." };
  } else {
    const { data, error } = await supabase
      .from("vertreter").insert({ ...zeile, user_id: user.id }).select("id").maybeSingle();
    if (error || !data) return { error: "Der Vertreter konnte nicht gespeichert werden." };
  }

  revalidatePath("/einstellungen");
  return { ok: true };
}

export async function entferneVertreter(id: string): Promise<Ergebnis> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { error } = await supabase.from("vertreter").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Der Vertreter konnte nicht entfernt werden." };
  revalidatePath("/einstellungen");
  return { ok: true };
}
