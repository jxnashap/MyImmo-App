"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { vorjahrUebernahme, type VorjahrPosition } from "@/lib/nkVorjahr";
import { nkAusBuchungen } from "@/lib/nkAusBuchungen";
import { belegung, jahresTage } from "@/lib/nk";
import { zeigeVerteiler } from "@/lib/umlage";

const AUFTEILUNGEN = ["voll", "flaeche", "zeit", "verbrauch", "gradtag", "hkvo"];
const aufteilungOk = (v: unknown): string =>
  AUFTEILUNGEN.includes(String(v)) ? String(v) : "voll";

const numOderNull = (v: FormDataEntryValue | null): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export async function addPosition(mieterId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const betragRaw = formData.get("betrag");
  const betrag =
    betragRaw == null || betragRaw === ""
      ? null
      : Number(String(betragRaw).replace(",", "."));

  const jahrRaw = formData.get("jahr");
  const jahr = jahrRaw ? Number(jahrRaw) : null;

  const { error } = await supabase.from("mieter_positionen").insert({
    user_id: user.id,
    mieter_id: mieterId,
    bezeichnung: String(formData.get("bezeichnung") ?? ""),
    betrag: betrag != null && Number.isNaN(betrag) ? null : betrag,
    jahr: jahr != null && Number.isNaN(jahr) ? null : jahr,
    umlageschluessel: (formData.get("umlageschluessel") as string) || null,
    umlagefaehig: formData.get("umlagefaehig") === "on",
    aufteilung: aufteilungOk(formData.get("aufteilung")),
    verbrauch_mieter: numOderNull(formData.get("verbrauch_mieter")),
    verbrauch_gesamt: numOderNull(formData.get("verbrauch_gesamt")),
    grundkosten_prozent: numOderNull(formData.get("grundkosten_prozent")),
    flaeche_gesamt: numOderNull(formData.get("flaeche_gesamt")),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/tenants/${mieterId}/edit`);
}

// Mehrere per OCR erkannte Positionen auf einmal anlegen (umlagefähig, aktuelles Jahr).
export async function addPositionsBulk(mieterId: string, positionenJson: string, jahr?: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let items: { name?: string; betrag?: number; gesamt?: number; flaecheGesamt?: number }[] = [];
  try { items = JSON.parse(positionenJson); } catch { items = []; }
  // Jahr kommt vom Aufrufer (die NK-Seite übergibt das ANGEZEIGTE
  // Abrechnungsjahr). Der alte Default `new Date().getFullYear()` war ein
  // stiller Fehler: Die NK-Abrechnung zeigt standardmäßig das VORJAHR — die
  // hochgeladenen Positionen landeten also in einem Jahr, das niemand ansah.
  const zielJahr = Number.isInteger(jahr) && jahr! >= 2000 && jahr! <= 2100
    ? jahr!
    : new Date().getFullYear() - 1;

  const zahl = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const rows = items
    .filter((p) => p && p.name)
    .map((p) => {
      const gesamt = zahl(p.gesamt);
      const flaecheGesamt = zahl(p.flaecheGesamt);
      // Gebäude-Gesamtkosten + Gesamtfläche → Flächen-Aufteilung: Die App
      // rechnet den Mieteranteil selbst und weist Gesamtkosten + Rechenweg in
      // der Abrechnung aus. Sonst: der Betrag ist bereits der Wohnungsanteil.
      const alsFlaeche = gesamt != null && flaecheGesamt != null;
      return {
        user_id: user.id,
        mieter_id: mieterId,
        bezeichnung: String(p.name),
        betrag: alsFlaeche ? gesamt : (zahl(p.betrag) ?? gesamt),
        jahr: zielJahr,
        umlagefaehig: true,
        aufteilung: alsFlaeche ? "flaeche" : "voll",
        flaeche_gesamt: alsFlaeche ? flaecheGesamt : null,
        umlageschluessel: alsFlaeche ? "Fläche" : null,
      };
    })
    .filter((r) => r.betrag != null);
  if (rows.length === 0) return;

  const { error } = await supabase.from("mieter_positionen").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath(`/tenants/${mieterId}/edit`);
  revalidatePath(`/tenants/${mieterId}/nk`);
}

// Eine bestehende Position inline aktualisieren (Autosave im PositionsManager).
export async function updatePosition(
  id: string,
  mieterId: string,
  f: {
    bezeichnung: string;
    betrag: number | null;
    jahr: number | null;
    umlageschluessel: string | null;
    umlagefaehig: boolean;
    aufteilung?: string;
    verbrauch_mieter?: number | null;
    verbrauch_gesamt?: number | null;
    grundkosten_prozent?: number | null;
    flaeche_gesamt?: number | null;
  },
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("mieter_positionen")
    .update({
      bezeichnung: f.bezeichnung,
      betrag: f.betrag,
      jahr: f.jahr,
      umlageschluessel: f.umlageschluessel,
      umlagefaehig: f.umlagefaehig,
      aufteilung: aufteilungOk(f.aufteilung),
      verbrauch_mieter: f.verbrauch_mieter ?? null,
      verbrauch_gesamt: f.verbrauch_gesamt ?? null,
      grundkosten_prozent: f.grundkosten_prozent ?? null,
      flaeche_gesamt: f.flaeche_gesamt ?? null,
    })
    .eq("id", id);

  revalidatePath(`/tenants/${mieterId}/edit`);
  return { ok: !error };
}

// Abgleich-Übernahme aus der ausgelesenen Hausverwaltungs-Abrechnung:
// vorhandene Positionen bekommen neue Beträge (Update), nur wirklich neue
// Kostenarten werden angelegt. Zuordnung passiert im Client (lib/nkOcrAbgleich)
// und wird dort angezeigt — hier nur Validierung und Schreiben.
export async function uebernehmeNkOcr(
  mieterId: string,
  jahr: number,
  datenJson: string,
): Promise<{ ok: boolean; fehler?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const zielJahr = Number.isInteger(jahr) && jahr >= 2000 && jahr <= 2100
    ? jahr
    : new Date().getFullYear() - 1;

  let daten: {
    updates?: { id?: string; betrag?: number; flaecheGesamt?: number; alsFlaeche?: boolean }[];
    neue?: { name?: string; betrag?: number; flaecheGesamt?: number; alsFlaeche?: boolean }[];
  } = {};
  try { daten = JSON.parse(datenJson); } catch { return { ok: false, fehler: "Ungültige Daten." }; }

  const zahl = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

  for (const u of daten.updates ?? []) {
    const betrag = zahl(u.betrag);
    if (!u.id || betrag == null) continue;
    const felder: Record<string, unknown> = { betrag, jahr: zielJahr };
    if (u.alsFlaeche && zahl(u.flaecheGesamt) != null) {
      // Upgrade einer direkt erfassten Position auf die Flächen-Aufteilung:
      // Betrag ist dann die Gebäude-Gesamtsumme, die App rechnet den Anteil.
      felder.aufteilung = "flaeche";
      felder.flaeche_gesamt = zahl(u.flaecheGesamt);
      felder.umlageschluessel = "Fläche";
    }
    const { error } = await supabase
      .from("mieter_positionen")
      .update(felder)
      .eq("id", u.id)
      .eq("mieter_id", mieterId);
    if (error) return { ok: false, fehler: error.message };
  }

  const rows = (daten.neue ?? [])
    .filter((p) => p && p.name && zahl(p.betrag) != null)
    .map((p) => {
      const alsFlaeche = !!p.alsFlaeche && zahl(p.flaecheGesamt) != null;
      return {
        user_id: user.id,
        mieter_id: mieterId,
        bezeichnung: String(p.name),
        betrag: zahl(p.betrag),
        jahr: zielJahr,
        umlagefaehig: true,
        aufteilung: alsFlaeche ? "flaeche" : "voll",
        flaeche_gesamt: alsFlaeche ? zahl(p.flaecheGesamt) : null,
        umlageschluessel: alsFlaeche ? "Fläche" : null,
      };
    });
  if (rows.length > 0) {
    const { error } = await supabase.from("mieter_positionen").insert(rows);
    if (error) return { ok: false, fehler: error.message };
  }

  revalidatePath(`/tenants/${mieterId}/edit`);
  revalidatePath(`/tenants/${mieterId}/nk`);
  return { ok: true };
}

export async function deletePosition(id: string, mieterId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("mieter_positionen").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/tenants/${mieterId}/edit`);
}

/**
 * NK-Positionen des Vorjahres als Startpunkt übernehmen (02.10.2026). Nur wenn für das Jahr noch
 * keine eigenen Positionen bestehen; Zählerstände und Lohnanteile bleiben leer (lib/nkVorjahr.ts).
 */
export async function uebernehmeVorjahresPositionen(mieterId: string, jahr: number): Promise<{ ok: true; anzahl: number } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  if (!Number.isInteger(jahr) || jahr < 2001 || jahr > 2100) return { error: "Ungültiges Jahr." };

  const { data, error } = await supabase
    .from("mieter_positionen")
    .select("bezeichnung,betrag,umlageschluessel,umlagefaehig,jahr,aufteilung,grundkosten_prozent,flaeche_gesamt,art_35a")
    .eq("mieter_id", mieterId)
    .eq("user_id", user.id)
    .in("jahr", [jahr, jahr - 1]);
  // Fehler → abbrechen: leer hieße sonst „noch nichts da“, und es käme eine zweite Liste dazu.
  if (error) return { error: "Positionen konnten nicht gelesen werden." };

  const u = vorjahrUebernahme((data ?? []) as VorjahrPosition[], jahr);
  if (!u.moeglich) {
    return { error: u.anzahl === 0 ? `Für ${jahr - 1} sind keine Positionen hinterlegt.` : `Für ${jahr} gibt es schon Positionen.` };
  }
  const { error: e2 } = await supabase
    .from("mieter_positionen")
    .insert(u.zeilen.map((z) => ({ ...z, user_id: user.id, mieter_id: mieterId })));
  if (e2) return { error: "Die Positionen konnten nicht übernommen werden." };

  revalidatePath(`/tenants/${mieterId}/nk`);
  revalidatePath(`/tenants/${mieterId}/edit`);
  return { ok: true, anzahl: u.anzahl };
}

/**
 * Gebuchte umlagefähige Kosten des Objekts als Positionen übernehmen (Paket C, 06.10.2026) —
 * für eine EINZELNE Mietpartei. Vorher tippte der Vermieter Grundsteuer, Müll & Co. hier ein
 * zweites Mal. Bei mehreren Mietparteien verteilt der Verteiler (dort derselbe Vorschlag).
 * Schon vorhandene Positionen gleichen Namens im Jahr bleiben unberührt (kein Duplikat).
 * Unterjährige Mietzeit → Aufteilung „zeit“ (Jahreskosten nach Belegungstagen).
 */
export async function uebernehmeGebuchteKosten(
  mieterId: string,
  jahr: number,
): Promise<{ ok: true; anzahl: number } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  if (!Number.isInteger(jahr) || jahr < 2001 || jahr > 2100) return { error: "Ungültiges Jahr." };

  const { data: m, error: mErr } = await supabase
    .from("mieter").select("prop_id,mietbeginn,mietende").eq("id", mieterId).eq("user_id", user.id).maybeSingle();
  if (mErr || !m) return { error: "Mieter nicht gefunden." };
  if (!m.prop_id) return { error: "Der Mieter ist keinem Objekt zugeordnet." };

  const [pRes, nRes, kRes, posRes] = await Promise.all([
    supabase.from("properties").select("typ,einheiten_anzahl").eq("id", m.prop_id).eq("user_id", user.id).maybeSingle(),
    supabase.from("mieter").select("id", { count: "exact", head: true }).eq("prop_id", m.prop_id).eq("user_id", user.id),
    supabase.from("kosten").select("prop_id,buchungsdatum,kategorie,betrag").eq("prop_id", m.prop_id).eq("user_id", user.id)
      .gte("buchungsdatum", `${jahr}-01-01`).lt("buchungsdatum", `${jahr + 1}-01-01`),
    supabase.from("mieter_positionen").select("bezeichnung").eq("mieter_id", mieterId).eq("user_id", user.id).eq("jahr", jahr),
  ]);
  // Jede Lücke hier hieße „nichts vorhanden“ → doppelte Positionen. Also abbrechen.
  if (pRes.error || nRes.error || kRes.error || posRes.error) return { error: "Daten konnten nicht gelesen werden — nichts übernommen." };
  if (zeigeVerteiler({ typ: pRes.data?.typ, einheiten_anzahl: pRes.data?.einheiten_anzahl ?? null, mieterAnzahl: nRes.count ?? 0 })) {
    return { error: "Mehrere Mietparteien: bitte über „Nebenkosten verteilen“ am Objekt — dort stehen dieselben Buchungen zur Übernahme." };
  }

  const { vorschlaege } = nkAusBuchungen(kRes.data ?? [], m.prop_id, jahr);
  const vorhanden = new Set(((posRes.data ?? []) as { bezeichnung: string }[]).map((p) => p.bezeichnung.trim().toLowerCase()));
  const neu = vorschlaege.filter((v) => !vorhanden.has(v.bezeichnung.toLowerCase()));
  if (neu.length === 0) return { ok: true, anzahl: 0 };

  const b = belegung(jahr, m.mietbeginn, m.mietende);
  const ganzesJahr = b.tage >= jahresTage(jahr);
  const { error } = await supabase.from("mieter_positionen").insert(
    neu.map((v) => ({
      user_id: user.id,
      mieter_id: mieterId,
      bezeichnung: v.bezeichnung,
      betrag: v.betrag,
      jahr,
      umlagefaehig: true,
      umlageschluessel: ganzesJahr ? "Alleinnutzung" : "Belegungstage",
      aufteilung: ganzesJahr ? "voll" : "zeit",
      quelle: "buchungen",
    })),
  );
  if (error) return { error: "Die Positionen konnten nicht übernommen werden." };

  revalidatePath(`/tenants/${mieterId}/nk`);
  revalidatePath(`/tenants/${mieterId}/edit`);
  return { ok: true, anzahl: neu.length };
}
