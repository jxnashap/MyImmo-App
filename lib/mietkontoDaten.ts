import "server-only";
import { createClient } from "@/lib/supabase/server";
import { gezahltImMonat, sollFuerMonat, zuJahrMonat, zuletztGezahltAm } from "@/lib/mietkonto";
import { laeuftAm } from "@/lib/sollMiete";
import { ladeAlle } from "@/lib/db/ladeAlle";
import { TEILZAHLUNG_TOLERANZ } from "@/lib/mietStatus";
import { heuteBerlin } from "@/lib/zeitraum";
import type { MietkontoZeile, NacherfassungMieter } from "@/components/MietkontoBestaetigung";
import type { Tenant, MietZeitraum, Property } from "@/lib/types";
import { createHash } from "node:crypto";
import { decryptNullable } from "@/lib/crypto/secure";
import { normIban } from "@/lib/kontoauszug";

/**
 * SHA-256 der normalisierten Mieter-IBAN für den Kontoauszug-Abgleich (lib/kontoauszug.ts): Der
 * Browser vergleicht Prüfsummen und bekommt die IBAN selbst nicht. Kein Geheimnisschutz (IBANs
 * sind ratbar), sondern: keine Klartext-IBAN im ausgelieferten HTML. Entschlüsseln scheitert →
 * null (ohne IBAN-Treffer, nicht ohne Seite).
 */
function ibanHash(verschluesselt: string | null | undefined): string | null {
  try {
    const iban = normIban(decryptNullable(verschluesselt));
    return iban ? createHash("sha256").update(iban).digest("hex") : null;
  } catch {
    return null;
  }
}

// Datenbeschaffung für das Mietkonto — von /mietkonto UND von der Karte in
// „Ein- & Ausgaben" genutzt, damit beide Ansichten garantiert dieselben
// Soll-Beträge und denselben Bestätigt-Stand zeigen.

export type MietkontoDaten = {
  zeilen: MietkontoZeile[];
  nacherfassung: NacherfassungMieter[];
  /**
   * Laufende Mieter OHNE Mietbeginn. `sollFuerMonat` liefert für sie nie eine
   * Soll-Miete — sie fehlen im Mietkonto still (30.09.2026: 3 echte Mieter).
   * Die Seite nennt sie, statt sie wegzulassen.
   */
  ohneMietbeginn: { id: string; name: string }[];
};

export async function ladeMietkonto(monat: string): Promise<MietkontoDaten> {
  const supabase = await createClient();
  // B08 (11.10.2026): vollständig und mit Fehlerprüfung — vorher kamen höchstens 1.000 Zeilen je
  // Tabelle, und eine gescheiterte Abfrage sah aus wie „keine Mieteingänge“ (alle Monate offen).
  // Scheitert eine Abfrage, wirft `ladeAlle` — die Seite zeigt einen Fehler statt falscher Zahlen.
  const [mieterRows, zrRows, einnRows, propRows] = await Promise.all([
    ladeAlle("mieter", (v, b) => supabase.from("mieter").select("*").order("nachname").order("id").range(v, b)),
    ladeAlle("miet_zeitraeume", (v, b) => supabase.from("miet_zeitraeume").select("*").order("id").range(v, b)),
    ladeAlle("einnahmen", (v, b) =>
      supabase.from("einnahmen").select("id,mieter_id,buchungsdatum,kategorie,soll_monat,betrag")
        .eq("kategorie", "Miete").order("id").range(v, b)),
    ladeAlle("properties", (v, b) => supabase.from("properties").select("id,bezeichnung").order("id").range(v, b)),
  ]);

  const mieter = (mieterRows ?? []) as Tenant[];
  const zeitraeume = (zrRows ?? []) as MietZeitraum[];
  const einnahmen = einnRows ?? [];
  const propName = new Map(
    ((propRows ?? []) as Pick<Property, "id" | "bezeichnung">[]).map((p) => [p.id, p.bezeichnung]),
  );

  // Gebuchte Monate je Mieter (YYYY-MM) — eine Quelle für beide Modi. Gezählt wird, was nach
  // Rückbuchungen (Rücklastschrift, Ablauf A) übrig bleibt: Ein Monat mit +800 und −800 ist wieder
  // offen und erscheint erneut zum Bestätigen.
  const summeProMieter = new Map<string, Map<string, number>>();
  const zahlungenProMieter = new Map<string, NacherfassungMieter["zahlungen"]>();
  for (const e of einnahmen) {
    const ym = e.soll_monat ?? zuJahrMonat(e.buchungsdatum);
    if (!ym || !e.mieter_id) continue;
    if (!summeProMieter.has(e.mieter_id)) summeProMieter.set(e.mieter_id, new Map());
    const s = summeProMieter.get(e.mieter_id)!;
    s.set(ym, (s.get(ym) ?? 0) + (Number(e.betrag) || 0));
    if (!zahlungenProMieter.has(e.mieter_id)) zahlungenProMieter.set(e.mieter_id, []);
    zahlungenProMieter.get(e.mieter_id)!.push({ jahrMonat: ym, betrag: Number(e.betrag) || 0, datum: String(e.buchungsdatum).slice(0, 10) });
  }
  const gebuchtProMieter = new Map<string, Set<string>>();
  for (const [id, s] of summeProMieter) {
    gebuchtProMieter.set(id, new Set(Array.from(s).filter(([, summe]) => summe > TEILZAHLUNG_TOLERANZ).map(([ym]) => ym)));
  }

  const zeilen: MietkontoZeile[] = [];
  const nacherfassung: NacherfassungMieter[] = [];

  for (const m of mieter) {
    const zr = zeitraeume.filter((z) => z.mieter_id === m.id);
    const name = [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter";
    const objekt =
      [m.prop_id ? propName.get(m.prop_id) : null, m.einheit].filter(Boolean).join(" · ") || "—";

    const soll = sollFuerMonat(m, zr, monat);
    if (soll && soll.gesamt > 0) {
      zeilen.push({
        mieterId: m.id,
        propId: m.prop_id,
        name,
        objekt,
        kaltmiete: soll.kaltmiete,
        nk: soll.nk,
        stellplatz: soll.stellplatz,
        gesamt: soll.gesamt,
        anteilig: soll.anteilig,
        minderung: soll.minderung,
        schonGebucht: gebuchtProMieter.get(m.id)?.has(monat) ?? false,
        gezahlt: gezahltImMonat(einnahmen.filter((e) => e.mieter_id === m.id), monat),
        gezahltAm: zuletztGezahltAm(einnahmen.filter((e) => e.mieter_id === m.id), monat),
      });
    }

    if (m.mietbeginn && ((m.kaltmiete ?? 0) + (m.nk_vorauszahlung ?? 0) > 0 || zr.length > 0)) {
      nacherfassung.push({
        mieterId: m.id,
        propId: m.prop_id,
        name,
        nachname: m.nachname ?? null,
        ibanHash: ibanHash(m.iban),
        objekt,
        mieter: {
          kaltmiete: m.kaltmiete,
          nk_vorauszahlung: m.nk_vorauszahlung,
          stellplatz_miete: m.stellplatz_miete ?? null,
          mietbeginn: m.mietbeginn,
          mietende: m.mietende,
          minderungen: m.minderungen ?? [],
        },
        zeitraeume: zr.map((z) => ({
          von: z.von,
          bis: z.bis,
          kaltmiete: z.kaltmiete,
          nk_vorauszahlung: z.nk_vorauszahlung,
          stellplatz_miete: z.stellplatz_miete,
        })),
        gebuchteMonate: Array.from(gebuchtProMieter.get(m.id) ?? []),
        // Der Kontoauszug rechnet daraus Rest, Überzahlung und Rückbuchungen (lib/kontoauszug.ts).
        zahlungen: zahlungenProMieter.get(m.id) ?? [],
      });
    }
  }

  const heute = heuteBerlin();
  const ohneMietbeginn = mieter
    .filter((m) => !m.mietbeginn && laeuftAm(m, heute))
    .map((m) => ({ id: m.id, name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter" }));

  return { zeilen, nacherfassung, ohneMietbeginn };
}
