"use server";

// Belegeingang (Ablauf B, Prüfstand 11.10.2026): hochladen, buchen (neu oder an vorhandene Kosten
// hängen), verwerfen. Regeln und Prüfliste: lib/belegEingang.ts. Der KI-Vorschlag läuft getrennt
// über /api/beleg-vorschlag (kostet Geld, eigene Bremse, eigener Auftrag mit Versuchen).
//
// Reihenfolge überall: erst das, worauf sich etwas verlässt, dann der Zustand.
//   · Hochladen: Datei → Zeile; scheitert die Zeile, wird die Datei entfernt.
//   · Buchen: Kosten (eindeutig je Beleg, `upsert … ignoreDuplicates`) → Eingang „gebucht“. Bricht
//     der zweite Schritt ab, findet die Wiederholung die Buchung über `beleg_eingang_id` und holt nur
//     den Zustand nach — es entsteht keine zweite Buchung.
//   · Verwerfen: Zeile → Datei (wie deleteKosten).

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erkenneEingangTyp, bereinigeDateiname } from "@/lib/freigabeEingang";
import { zahlDe } from "@/lib/zahl";
import { dbFehlerText } from "@/lib/demoFehler";
import { alleZeilen, nurKonto } from "@/lib/db/auswertung";
import {
  BELEG_MAX_BYTES, buchbar, endungFuer, pruefeBeleg,
  type EingangZeile, type KostenZeile, type Pruefpunkt,
} from "@/lib/belegEingang";

type Db = Awaited<ReturnType<typeof createClient>>;

export type HochladenErgebnis = { ok: true; id: string } | { ok: false; error: string };

/** Einen Beleg in den Eingang legen. Typ aus dem Dateikopf (PDF, JPEG, PNG, WebP), nie aus dem Namen. */
export async function ladeBelegHoch(fd: FormData): Promise<HochladenErgebnis> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const f = fd.get("datei");
  if (!f || typeof f === "string") return { ok: false, error: "Keine Datei gewählt." };
  const datei = f as File;
  if (datei.size === 0) return { ok: false, error: "Die Datei ist leer." };
  if (datei.size > BELEG_MAX_BYTES) return { ok: false, error: "Beleg zu groß (max. 15 MB)." };
  const bytes = new Uint8Array(await datei.arrayBuffer());
  const mime = erkenneEingangTyp(bytes);
  if (!mime) return { ok: false, error: "Nur PDF, JPEG, PNG oder WebP." };

  const id = randomUUID();
  // Flach unter `<uid>/` — die Kontolöschung leert genau diesen Ordner (ohne Unterordner).
  const pfad = `${user.id}/eingang-${id}.${endungFuer(mime)}`;
  const { error: upFehler } = await supabase.storage.from("belege").upload(pfad, bytes, { contentType: mime, upsert: false });
  if (upFehler) return { ok: false, error: "Hochladen fehlgeschlagen. Bitte erneut versuchen." };
  const { error } = await supabase.from("beleg_eingang").insert({
    id,
    user_id: user.id,
    datei_pfad: pfad,
    datei_name: bereinigeDateiname(datei.name || "Beleg"),
    datei_mime: mime,
    datei_groesse: datei.size,
    datei_hash: createHash("sha256").update(bytes).digest("hex"),
    status: "neu",
    versuche: 0,
  });
  if (error) {
    await supabase.storage.from("belege").remove([pfad]);
    return { ok: false, error: dbFehlerText(error, "Beleg konnte nicht abgelegt werden.") };
  }
  revalidatePath("/kosten/belege");
  return { ok: true, id };
}

export type BuchenEingabe = {
  prop_id: string | null;
  /** Ausdrücklich ohne Objekt (z. B. Kontogebühr). */
  ohne_objekt?: boolean;
  kategorie: string;
  umlagefaehig: string;
  betrag: string;
  buchungsdatum: string;
  beschreibung?: string | null;
  /** Gebuchte Kosten ohne Beleg, an die der Beleg gehängt wird — statt einer neuen Buchung. */
  anhaengen_an?: string | null;
  /** Mögliche Dublette gesehen und trotzdem buchen. */
  dublette_ok?: boolean;
};

export type BuchenErgebnis =
  | { ok: true; kosten_id: string; schonGebucht?: boolean; angehaengt?: boolean }
  | { ok: false; error: string; punkte?: Pruefpunkt[] };

const UMLAGE = new Set(["ja", "nein", "unklar"]);

async function kontext(supabase: Db, userId: string): Promise<{ kosten: KostenZeile[]; eingaenge: EingangZeile[] } | null> {
  // Vollständig (über die 1.000-Zeilen-Grenze hinaus) — ohne vollständige Daten keine
  // Dublettenprüfung und dann auch keine Buchung (fail-closed, B08).
  try {
    const eigen = nurKonto(userId);
    const [kosten, eingaenge] = await Promise.all([
      alleZeilen<KostenZeile>(supabase, "kosten", "id,prop_id,buchungsdatum,betrag,kategorie,beschreibung,rechnung_path,beleg_eingang_id", eigen),
      alleZeilen<EingangZeile>(supabase, "beleg_eingang", "id,datei_hash,status", eigen),
    ]);
    return { kosten, eingaenge };
  } catch {
    return null;
  }
}

/**
 * Bucht einen Beleg aus dem Eingang — GENAU EINMAL, nach erneuter Prüfung mit frischen Daten.
 * Entweder als neue Kosten (mit dem Beleg als Anhang) oder angehängt an vorhandene Kosten ohne Beleg.
 */
export async function bucheBeleg(id: string, eingabe: BuchenEingabe): Promise<BuchenErgebnis> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: eintrag, error: leseFehler } = await supabase
    .from("beleg_eingang")
    .select("id,status,datei_pfad,datei_name,datei_mime,datei_groesse,datei_hash,vorschlag,kosten_id")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (leseFehler) return { ok: false, error: "Beleg konnte nicht geladen werden. Bitte erneut versuchen." };
  if (!eintrag) return { ok: false, error: "Beleg nicht gefunden." };
  if (eintrag.status === "gebucht" && eintrag.kosten_id) return { ok: true, kosten_id: eintrag.kosten_id, schonGebucht: true };

  // Wiederholung nach Abbruch: Gibt es die Buchung schon, nur den Zustand nachholen.
  const { data: vorhanden, error: vFehler } = await supabase
    .from("kosten").select("id").eq("user_id", user.id).eq("beleg_eingang_id", id).maybeSingle();
  if (vFehler) return { ok: false, error: "Bestehende Buchungen konnten nicht geprüft werden — es wurde nichts gebucht." };
  if (vorhanden) return abschliessen(supabase, user.id, id, vorhanden.id, true);

  const betrag = zahlDe(eingabe.betrag);
  const propId = eingabe.ohne_objekt ? null : (eingabe.prop_id || null);
  if (propId) {
    const { data: obj, error } = await supabase.from("properties").select("id").eq("id", propId).eq("user_id", user.id).maybeSingle();
    if (error || !obj) return { ok: false, error: "Objekt nicht gefunden." };
  }
  if (!UMLAGE.has(eingabe.umlagefaehig)) return { ok: false, error: "Bitte die Umlagefähigkeit wählen (ja, nein oder unklar)." };

  const ktx = await kontext(supabase, user.id);
  if (!ktx) return { ok: false, error: "Bestehende Buchungen konnten nicht geprüft werden — es wurde nichts gebucht." };
  const rechnungsnummer = (eintrag.vorschlag as { rechnungsnummer?: string | null } | null)?.rechnungsnummer ?? null;
  const { punkte, anhaengbar } = pruefeBeleg(
    {
      eintragId: id, datei_hash: eintrag.datei_hash, prop_id: propId, ohneObjekt: !!eingabe.ohne_objekt,
      kategorie: eingabe.kategorie, umlagefaehig: eingabe.umlagefaehig, betrag, datum: eingabe.buchungsdatum, rechnungsnummer,
    },
    ktx,
  );
  if (!buchbar(punkte, !!eingabe.dublette_ok)) {
    const offen = punkte.filter((p) => p.sperrt);
    return { ok: false, error: offen.map((p) => p.text).join(" "), punkte };
  }

  if (eingabe.anhaengen_an) {
    // Nur an eine der passenden Kosten (gleicher Betrag, ±45 Tage, ohne Beleg) — nie an beliebige.
    if (!anhaengbar.some((k) => k.id === eingabe.anhaengen_an)) {
      return { ok: false, error: "Diese Buchung passt nicht (mehr) zum Beleg — bitte die Liste neu laden." };
    }
    const { data: gesetzt, error } = await supabase
      .from("kosten")
      .update({
        rechnung_path: eintrag.datei_pfad, rechnung_name: eintrag.datei_name, rechnung_type: eintrag.datei_mime,
        rechnung_size: groesse(eintrag.datei_groesse), rechnung_data: null,
        beleg_eingang_id: id, umlagefaehig: eingabe.umlagefaehig,
      })
      .eq("id", eingabe.anhaengen_an).eq("user_id", user.id).is("rechnung_path", null).is("beleg_eingang_id", null)
      .select("id").maybeSingle();
    if (error) return { ok: false, error: dbFehlerText(error, "Beleg konnte nicht angehängt werden.") };
    if (!gesetzt) return { ok: false, error: "Die Buchung hat inzwischen einen Beleg — bitte die Liste neu laden." };
    return abschliessen(supabase, user.id, id, gesetzt.id, false, true);
  }

  const { data: neu, error } = await supabase
    .from("kosten")
    .upsert(
      {
        user_id: user.id,
        prop_id: propId,
        buchungsdatum: eingabe.buchungsdatum,
        kategorie: eingabe.kategorie,
        umlagefaehig: eingabe.umlagefaehig,
        betrag,
        beschreibung: (eingabe.beschreibung ?? "").trim().slice(0, 200) || null,
        rechnung_path: eintrag.datei_pfad,
        rechnung_name: eintrag.datei_name,
        rechnung_type: eintrag.datei_mime,
        rechnung_size: groesse(eintrag.datei_groesse),
        beleg_eingang_id: id,
      },
      { onConflict: "beleg_eingang_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { ok: false, error: dbFehlerText(error, "Buchen fehlgeschlagen.") };
  let kostenId = ((neu ?? []) as { id: string }[])[0]?.id;
  let schon = false;
  if (!kostenId) {
    // Gleichzeitiger Aufruf war schneller — dessen Buchung gilt.
    const { data: andere } = await supabase.from("kosten").select("id").eq("user_id", user.id).eq("beleg_eingang_id", id).maybeSingle();
    if (!andere) return { ok: false, error: "Buchen fehlgeschlagen. Bitte erneut versuchen." };
    kostenId = andere.id;
    schon = true;
  }
  return abschliessen(supabase, user.id, id, kostenId!, schon);
}

async function abschliessen(supabase: Db, userId: string, id: string, kostenId: string, schon: boolean, angehaengt = false): Promise<BuchenErgebnis> {
  const { error } = await supabase
    .from("beleg_eingang")
    .update({ status: "gebucht", kosten_id: kostenId, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", userId).neq("status", "gebucht");
  // Die Buchung steht; scheitert nur der Zustand, holt ihn der nächste Aufruf nach (siehe oben).
  if (error) return { ok: false, error: "Gebucht, aber der Eingang ist noch nicht abgeschlossen — bitte erneut auf „Buchen“ tippen (es entsteht keine zweite Buchung)." };
  revalidatePath("/kosten");
  revalidatePath("/kosten/belege");
  return { ok: true, kosten_id: kostenId, ...(schon ? { schonGebucht: true } : {}), ...(angehaengt ? { angehaengt: true } : {}) };
}

/** Beleg verwerfen: erst die Zeile (nur wenn nicht gebucht), dann die Datei. */
export async function verwirfBeleg(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const { data: weg, error } = await supabase
    .from("beleg_eingang").delete().eq("id", id).eq("user_id", user.id).neq("status", "gebucht")
    .select("datei_pfad").maybeSingle();
  if (error) return { ok: false, error: dbFehlerText(error, "Verwerfen fehlgeschlagen.") };
  if (!weg) return { ok: false, error: "Beleg nicht gefunden oder schon gebucht." };
  const pfad = (weg as { datei_pfad: string }).datei_pfad;
  // Hängt die Datei doch an einer Buchung (sollte nicht vorkommen), bleibt sie liegen.
  const { data: benutzt, error: bFehler } = await supabase.from("kosten").select("id").eq("user_id", user.id).eq("rechnung_path", pfad).limit(1);
  if (!bFehler && (benutzt ?? []).length === 0) await supabase.storage.from("belege").remove([pfad]);
  revalidatePath("/kosten/belege");
  return { ok: true };
}

function groesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
