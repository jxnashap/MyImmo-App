import "server-only";
import { createClient } from "@/lib/supabase/server";

// Was genau verschwindet beim Löschen eines Objekts oder Mieters?
//
// Beide Löschknöpfe fragten bisher nur „«Haus Bergstraße» wirklich löschen?".
// Über ON DELETE CASCADE hängen an einem Objekt aber sämtliche `einnahmen`,
// `kosten`, `kredite`, `notizen` (das Archiv INKLUSIVE hochgeladener Dateien)
// und `verbrauch`. Wer ein verkauftes Objekt „aufräumen" will, vernichtet damit
// unwiederbringlich seine steuerrelevanten Buchungen und Belege — ohne Warnung,
// ohne Rückgängig, ohne vorherigen Export.
//
// Beim Mieter hängen `miet_zeitraeume`, `mieter_positionen` (die Grundlage
// JEDER NK-Abrechnung), `zaehlerstand_meldungen` und `mieter_zugaenge` daran;
// die Mieteinnahmen bleiben zwar erhalten, verlieren aber ihre Zuordnung
// (`on delete set null`) — eine NK-Abrechnung fürs Auszugsjahr ist danach nicht
// mehr erstellbar.
//
// Diese Zahlen gehören VOR den Klick, nicht danach.

export type ObjektUmfang = {
  einnahmen: number;
  kosten: number;
  kredite: number;
  dokumente: number;
  verbrauch: number;
  mieter: number;
};


// `objektUmfaenge()` (Löschumfang für ALLE Objekte, sechs Tabellen-Abfragen) ist am 03.10.2026
// entfallen: Die Objektliste hat keinen Löschknopf mehr, gelöscht wird nur noch auf der
// Objektseite — und die zählt den Umfang ihres EINEN Objekts selbst.

/** Ein Satz, der die Folgen benennt — leer, wenn nichts dranhängt. */
export function objektFolgenText(u: ObjektUmfang | undefined): string {
  if (!u) return "";
  const teile: string[] = [];
  if (u.einnahmen) teile.push(`${u.einnahmen} Einnahme${u.einnahmen === 1 ? "" : "n"}`);
  if (u.kosten) teile.push(`${u.kosten} Ausgabe${u.kosten === 1 ? "" : "n"}`);
  if (u.kredite) teile.push(`${u.kredite} Darlehen`);
  if (u.dokumente) teile.push(`${u.dokumente} Dokument${u.dokumente === 1 ? "" : "e"}`);
  if (u.verbrauch) teile.push(`${u.verbrauch} Zählerstand${u.verbrauch === 1 ? "" : "-Einträge"}`);
  if (teile.length === 0) return "";
  return `Damit werden auch ${teile.join(", ")} unwiderruflich gelöscht.`;
}

export type MieterUmfang = { zeitraeume: number; positionen: number; einnahmen: number };

/** Löschumfang je Mieter. */
export async function mieterUmfaenge(): Promise<Map<string, MieterUmfang>> {
  const supabase = await createClient();
  const [zr, pos, einn] = await Promise.all([
    supabase.from("miet_zeitraeume").select("mieter_id"),
    supabase.from("mieter_positionen").select("mieter_id"),
    supabase.from("einnahmen").select("mieter_id").eq("kategorie", "Miete"),
  ]);

  const map = new Map<string, MieterUmfang>();
  const zaehle = (rows: { mieter_id: string | null }[] | null, feld: keyof MieterUmfang) => {
    for (const r of rows ?? []) {
      if (!r.mieter_id) continue;
      const u = map.get(r.mieter_id) ?? { zeitraeume: 0, positionen: 0, einnahmen: 0 };
      u[feld] += 1;
      map.set(r.mieter_id, u);
    }
  };
  zaehle(zr.data, "zeitraeume");
  zaehle(pos.data, "positionen");
  zaehle(einn.data, "einnahmen");
  return map;
}

export function mieterFolgenText(u: MieterUmfang | undefined): string {
  if (!u) return "";
  const teile: string[] = [];
  if (u.positionen) teile.push(`${u.positionen} Nebenkosten-Position${u.positionen === 1 ? "" : "en"}`);
  if (u.zeitraeume) teile.push(`${u.zeitraeume} Miet-Zeitraum${u.zeitraeume === 1 ? "" : "-Einträge"}`);
  const satz = teile.length ? `Damit gehen auch ${teile.join(" und ")} verloren — eine NK-Abrechnung ist danach nicht mehr erstellbar.` : "";
  const mieten = u.einnahmen
    ? ` ${u.einnahmen} gebuchte Miete${u.einnahmen === 1 ? "" : "n"} bleiben erhalten, verlieren aber die Zuordnung.`
    : "";
  return (satz + mieten).trim();
}
