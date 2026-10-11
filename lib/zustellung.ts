// Zustellung ins Mieterportal — an eine PERSON, nicht an eine Mieter-Zeile (02.10.2026).
//
// Hintergrund: docs/zukunft/MIETERPORTAL-AUSBAU.md (S1, Abschnitt 9). Jede Zustellung ist
// eine Zeile in `zustellungen` mit dem Konto und der Adresse, die der Vermieter im Dialog
// gesehen hat. Ein späterer Mieterwechsel in derselben Zeile, ein umgehängtes Dokument oder
// ein neu verknüpftes Konto verschiebt keine bereits erfolgte Zustellung.
//
// EINE Stelle für Lage und Zustellen — benutzt von der NK-Seite (Anzeige), `speichereNk`
// und `stelleDokumentZu` (Schranke). Kein "use server": Das sind Helfer, keine Actions.
import type { createClient } from "@/lib/supabase/server";
import { pruefeZustellung, type ZustellPruefung } from "@/lib/mieterZugang";
import { heuteBerlin } from "@/lib/zeitraum";
import { benachrichtige, type Ergebnis } from "@/lib/benachrichtigung";

type Db = Awaited<ReturnType<typeof createClient>>;

export type Empfaenger = { userId: string; email: string | null };
export type ZustellLageErgebnis = ZustellPruefung & { empfaenger: Empfaenger[] };

/** Titel, unter dem eine NK-Abrechnung zugestellt wird — Grundlage der Doppelt-Warnung. */
export const nkTitel = (jahr: number) => `Nebenkostenabrechnung ${jahr}`;

/**
 * Wer bekäme die Zustellung, und darf sie sein? Alles aus der Datenbank, nie vom Browser.
 * Fehler bei einer Abfrage = keine Zustellung (fail-closed): Ein leeres Ergebnis sähe
 * sonst aus wie „kein Hindernis“ bzw. „noch nicht zugestellt“.
 *
 * `jahr` bei der NK-Abrechnung (prüft Mietzeit und warnt vor einer zweiten Abrechnung
 * desselben Jahres), `notizId` bei einem vorhandenen Archiv-Dokument (Konten, die es schon
 * haben, fallen heraus).
 */
export async function ladeZustellLage(
  supabase: Db,
  userId: string,
  mieterId: string,
  opts: { jahr: number | null; notizId?: string },
): Promise<ZustellLageErgebnis | { error: string }> {
  let schonQ = supabase
    .from("zustellungen")
    .select("empfaenger_user_id")
    .eq("vermieter_id", userId)
    .eq("mieter_id", mieterId)
    .is("zurueckgezogen_am", null);
  if (opts.notizId) schonQ = schonQ.eq("notiz_id", opts.notizId);
  else if (opts.jahr !== null) schonQ = schonQ.eq("titel", nkTitel(opts.jahr));

  const [m, z, s] = await Promise.all([
    supabase.from("mieter").select("mietbeginn,mietende").eq("id", mieterId).eq("user_id", userId).maybeSingle(),
    supabase.from("mieter_zugaenge").select("user_id,email").eq("mieter_id", mieterId).eq("vermieter_id", userId),
    opts.notizId || opts.jahr !== null ? schonQ : Promise.resolve({ data: [], error: null }),
  ]);
  if (m.error || z.error || s.error || !m.data) {
    return { error: "Zustellung konnte nicht geprüft werden — nichts zugestellt. Bitte erneut versuchen." };
  }
  const mieter = m.data as { mietbeginn: string | null; mietende: string | null };
  const konten = ((z.data ?? []) as { user_id: string; email: string | null }[]).map((k) => ({
    userId: k.user_id,
    email: k.email ?? null,
  }));
  const schon = new Set(((s.data ?? []) as { empfaenger_user_id: string }[]).map((x) => x.empfaenger_user_id));

  // Ein vorhandenes Dokument geht nur an Konten, die es noch nicht haben.
  const empfaenger = opts.notizId ? konten.filter((k) => !schon.has(k.userId)) : konten;
  const pruefung = pruefeZustellung({
    verbunden: konten.length > 0,
    email: konten.length > 0 && konten.every((k) => k.email) ? konten.map((k) => k.email).join(", ") : null,
    mietbeginn: mieter.mietbeginn ?? null,
    mietende: mieter.mietende ?? null,
    jahr: opts.jahr,
    schonZugestellt: !opts.notizId && schon.size > 0,
    heute: heuteBerlin(),
  });
  if (!pruefung.sperre && opts.notizId && konten.length > 0 && empfaenger.length === 0) {
    return { sperre: "Dieses Dokument ist bereits zugestellt.", warnungen: [], empfaenger: [] };
  }
  if (!pruefung.sperre && konten.length > 1) {
    pruefung.warnungen.push(`Mit diesem Mieter sind ${konten.length} Portal-Konten verbunden — jedes erhält das Dokument.`);
  }
  return { ...pruefung, empfaenger };
}

/**
 * Stellt ein Archiv-Dokument an die übergebenen Konten zu. Die Datenbank prüft erneut,
 * dass jedes Konto JETZT mit dem eigenen Mieter verknüpft ist, das Dokument dem Vermieter
 * gehört und der Zeitpunkt „jetzt“ ist (Policy `zust_insert_vermieter`).
 */
export async function zustelle(
  supabase: Db,
  opts: {
    userId: string;
    mieterId: string;
    notizId: string;
    titel: string | null;
    empfaenger: Empfaenger[];
    bestaetigung?: boolean;
  },
): Promise<{ ok: true; an: string[]; hinweisMail: Ergebnis[] } | { ok: false; error: string }> {
  if (opts.empfaenger.length === 0) return { ok: false, error: "Kein Empfänger — nichts zugestellt." };
  // Ablauf F: Je Dokument und Empfänger höchstens EINE aktive Zustellung (Index zustellungen_einmal_aktiv).
  // Ein zweites Absenden (Zeitüberlauf, Doppelklick) stellt nicht noch einmal zu — wer sie schon hat,
  // fällt heraus; ein gleichzeitiger Lauf, der schneller war, ergibt 23505 und wird nachgelesen.
  const schonDa = async (): Promise<Set<string> | null> => {
    const { data, error } = await supabase.from("zustellungen").select("empfaenger_user_id")
      .eq("notiz_id", opts.notizId).is("zurueckgezogen_am", null);
    return error ? null : new Set(((data ?? []) as { empfaenger_user_id: string }[]).map((z) => z.empfaenger_user_id));
  };
  const vorher = await schonDa();
  if (!vorher) return { ok: false, error: "Zustellung fehlgeschlagen — das Dokument ist im Mieterportal NICHT sichtbar." };
  const offen = opts.empfaenger.filter((e) => !vorher.has(e.userId));
  const zeilen = offen.map((e) => ({
    vermieter_id: opts.userId,
    zugestellt_von: opts.userId,
    art: "dokument",
    notiz_id: opts.notizId,
    titel: opts.titel,
    mieter_id: opts.mieterId,
    empfaenger_user_id: e.userId,
    empfaenger_email: e.email,
    bestaetigung_noetig: !!opts.bestaetigung,
  }));
  if (zeilen.length > 0) {
    const { data, error } = await supabase.from("zustellungen").insert(zeilen).select("id");
    const fehlschlag = !!error || !data || (data as unknown[]).length !== zeilen.length;
    if (fehlschlag) {
      // Schneller gleichzeitiger Lauf? Dann stehen jetzt alle Empfänger da — das ist kein Fehler.
      const nachher = error?.code === "23505" ? await schonDa() : null;
      if (!nachher || !opts.empfaenger.every((e) => nachher.has(e.userId))) {
        return { ok: false, error: "Zustellung fehlgeschlagen — das Dokument ist im Mieterportal NICHT sichtbar." };
      }
    }
  }
  // Hinweis-Mail „es liegt etwas bereit“ — beste Mühe, die Zustellung steht schon. Das Ergebnis
  // geht seit P4 (B43) an die Oberfläche: Ohne eingerichteten Versand geht nichts hinaus, und der
  // Vermieter soll nicht annehmen, der Mieter wisse Bescheid.
  const hinweisMail: Ergebnis[] = [];
  for (const e of opts.empfaenger) hinweisMail.push(await benachrichtige(e.userId, "dokument", opts.notizId, opts.userId));
  return { ok: true, an: opts.empfaenger.map((e) => e.email ?? "Portal-Konto"), hinweisMail };
}
