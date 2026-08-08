"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const AUFTEILUNGEN = ["voll", "zeit", "verbrauch", "gradtag", "hkvo"];
const aufteilungOk = (v: unknown): string =>
  AUFTEILUNGEN.includes(String(v)) ? String(v) : "voll";

const numOderNull = (v: FormDataEntryValue | null): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export async function addPosition(mieterId: string, formData: FormData) {
  const supabase = createClient();
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
  const supabase = createClient();
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
        aufteilung: alsFlaeche ? "flaeche" : null,
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
  const supabase = createClient();
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

export async function deletePosition(id: string, mieterId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("mieter_positionen").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/tenants/${mieterId}/edit`);
}
