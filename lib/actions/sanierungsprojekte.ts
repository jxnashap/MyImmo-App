"use server";

// Sanierungsprojekte und -vorlagen speichern (Stufe C, docs/zukunft/SANIERUNGS-GUIDE.md, Abschnitt 7).
// Tabelle `sanierungsprojekte` (Migration 20261006050000, im SQL-Editor ausgeführt).
//
// Was hineingeht, prüfen dieselben Funktionen wie beim Laden aus dem Browser (`entwurfAus`,
// `vorlageAus`) — ein Aufruf am Formular vorbei speichert nichts Fremdes. Die Datenbank prüft nur
// Form, Größe, Eigentum und die Grenze von 200 Zeilen je Konto.
//
// Zwei Geräte (Besichtigung am Handy, Auswertung am Rechner): Überschrieben wird nur der Stand, den
// das Gerät zuletzt gesehen hat (`stand` = updated_at). Hat ein anderes Gerät inzwischen gespeichert,
// meldet die Action `konflikt` statt still zu überschreiben — der Nutzer entscheidet.
//
// Fehler kommen als Rückgabe (`{ error }`), nie als Ausnahme (lib/actionErgebnis.ts).

import { createClient } from "@/lib/supabase/server";
import { istDemoKonto } from "@/lib/demo";
import { entwurfAus, type Entwurf } from "@/lib/sanierung/eingabe";
import { DATEN_GRENZE, datenGroesse, projektName, vorlageAus, type ProjektArt, type ProjektZeile, type Vorlage } from "@/lib/sanierung/projekte";

type Fehler = { error: string; konflikt?: boolean };
type DbFehler = { code?: string; message?: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO = "Im Demo-Konto wird nichts gespeichert — dein Entwurf bleibt in diesem Browser.";
const NICHT_EINGERICHTET = "Speichern ist noch nicht eingerichtet. Dein Entwurf bleibt in diesem Browser.";

/** Tabelle fehlt (SQL noch nicht ausgeführt): Postgres 42P01, PostgREST PGRST205. */
const fehltTabelle = (e: DbFehler) => e?.code === "42P01" || e?.code === "PGRST205";

function fehlerText(e: DbFehler, sonst: string): string {
  if (fehltTabelle(e)) return NICHT_EINGERICHTET;
  if (e?.code === "54000") return "Höchstens 200 Projekte und Vorlagen — lösche alte, bevor du neue speicherst.";
  if (e?.code === "42501") return DEMO;
  return sonst;
}

const istArt = (v: unknown): v is ProjektArt => v === "projekt" || v === "vorlage";

async function anmeldung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Projekt oder Vorlage speichern. Ohne `id` neu anlegen, mit `id` überschreiben — dann nur, wenn
 * `stand` noch der gespeicherte ist (sonst `konflikt`); `erzwingen` überschreibt trotzdem.
 */
export async function speichereSanierungsprojekt(eingabe: {
  id?: string | null;
  art: ProjektArt;
  name: string;
  daten: unknown;
  stand?: string | null;
  erzwingen?: boolean;
}): Promise<{ ok: true; id: string; stand: string } | Fehler> {
  const { supabase, user } = await anmeldung();
  if (!user) return { error: "Nicht angemeldet." };
  if (istDemoKonto(user.email)) return { error: DEMO };
  if (!istArt(eingabe.art)) return { error: "Unbekannte Art." };
  const name = projektName(eingabe.name);
  if (!name) return { error: "Gib einen Namen mit 1 bis 80 Zeichen an." };
  const daten: Entwurf | Vorlage | null = eingabe.art === "projekt" ? entwurfAus(eingabe.daten) : vorlageAus(eingabe.daten);
  if (!daten) return { error: eingabe.art === "projekt" ? "Das ist kein Sanierungsprojekt." : "Das ist keine Vorlage." };
  if (datenGroesse(daten) > DATEN_GRENZE) return { error: "Das Projekt ist zu groß zum Speichern (mehr als 200 KB)." };

  if (eingabe.id) {
    if (!UUID.test(eingabe.id)) return { error: "Unbekanntes Projekt." };
    if (!eingabe.erzwingen && !eingabe.stand) return { error: "Unbekannter Stand — lade das Projekt neu.", konflikt: true };
    // Überschrieben wird nur der Stand, den dieses Gerät kennt — außer ausdrücklich erzwungen.
    const filter: Record<string, string> = { id: eingabe.id, user_id: user.id, art: eingabe.art };
    if (!eingabe.erzwingen && eingabe.stand) filter.updated_at = eingabe.stand;
    const { data, error } = await supabase.from("sanierungsprojekte").update({ name, daten }).match(filter).select("id, updated_at").maybeSingle();
    if (error) return { error: fehlerText(error, "Speichern hat nicht geklappt.") };
    if (!data) {
      // Keine Zeile getroffen: anderswo gespeichert — oder inzwischen gelöscht.
      const { data: da, error: e2 } = await supabase.from("sanierungsprojekte").select("id").eq("id", eingabe.id).eq("user_id", user.id).maybeSingle();
      if (e2) return { error: fehlerText(e2, "Speichern hat nicht geklappt.") };
      if (!da) return { error: "Das Projekt gibt es nicht mehr — speichere es als neues." };
      return { error: "Auf einem anderen Gerät wurde inzwischen ein neuerer Stand gespeichert.", konflikt: true };
    }
    const z = data as { id: string; updated_at: string };
    return { ok: true, id: z.id, stand: z.updated_at };
  }

  const { data, error } = await supabase
    .from("sanierungsprojekte")
    .insert({ user_id: user.id, art: eingabe.art, name, daten })
    .select("id, updated_at")
    .single();
  if (error || !data) return { error: fehlerText(error, "Speichern hat nicht geklappt.") };
  const z = data as { id: string; updated_at: string };
  return { ok: true, id: z.id, stand: z.updated_at };
}

/** Eigene Projekte und Vorlagen, neueste zuerst. `eingerichtet: false` = Tabelle fehlt noch. */
export async function ladeSanierungsprojekte(): Promise<{ ok: true; liste: ProjektZeile[]; eingerichtet: boolean } | Fehler> {
  const { supabase, user } = await anmeldung();
  if (!user) return { error: "Nicht angemeldet." };
  if (istDemoKonto(user.email)) return { ok: true, liste: [], eingerichtet: true };
  const { data, error } = await supabase
    .from("sanierungsprojekte")
    .select("id, art, name, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (fehltTabelle(error)) return { ok: true, liste: [], eingerichtet: false };
  if (error) return { error: "Die gespeicherten Projekte ließen sich nicht laden." };
  const liste = ((data ?? []) as { id: string; art: unknown; name: string; updated_at: string }[])
    .filter((z) => istArt(z.art))
    .map((z) => ({ id: z.id, art: z.art as ProjektArt, name: z.name, aktualisiert: z.updated_at }));
  return { ok: true, liste, eingerichtet: true };
}

/** Ein Projekt oder eine Vorlage laden — geprüft wie ein Entwurf aus dem Browser. */
export async function ladeSanierungsprojekt(
  id: string,
): Promise<{ ok: true; id: string; name: string; stand: string } & ({ art: "projekt"; entwurf: Entwurf } | { art: "vorlage"; vorlage: Vorlage }) | Fehler> {
  const { supabase, user } = await anmeldung();
  if (!user) return { error: "Nicht angemeldet." };
  if (!UUID.test(id)) return { error: "Unbekanntes Projekt." };
  const { data, error } = await supabase
    .from("sanierungsprojekte")
    .select("id, art, name, daten, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { error: fehlerText(error, "Das Projekt ließ sich nicht laden.") };
  if (!data) return { error: "Das Projekt gibt es nicht mehr." };
  const z = data as { id: string; art: unknown; name: string; daten: unknown; updated_at: string };
  if (z.art === "projekt") {
    const entwurf = entwurfAus(z.daten);
    if (!entwurf) return { error: "Das gespeicherte Projekt ist beschädigt." };
    return { ok: true, id: z.id, name: z.name, stand: z.updated_at, art: "projekt", entwurf };
  }
  if (z.art === "vorlage") {
    const vorlage = vorlageAus(z.daten);
    if (!vorlage) return { error: "Die gespeicherte Vorlage ist beschädigt." };
    return { ok: true, id: z.id, name: z.name, stand: z.updated_at, art: "vorlage", vorlage };
  }
  return { error: "Unbekannte Art." };
}

/** Projekt oder Vorlage löschen. */
export async function loescheSanierungsprojekt(id: string): Promise<{ ok: true } | Fehler> {
  const { supabase, user } = await anmeldung();
  if (!user) return { error: "Nicht angemeldet." };
  if (istDemoKonto(user.email)) return { error: DEMO };
  if (!UUID.test(id)) return { error: "Unbekanntes Projekt." };
  const { data, error } = await supabase.from("sanierungsprojekte").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) return { error: fehlerText(error, "Löschen hat nicht geklappt.") };
  if (!data) return { error: "Das Projekt gibt es nicht mehr." };
  return { ok: true };
}
