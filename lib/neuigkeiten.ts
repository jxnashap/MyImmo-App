import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ymPlus, zuJahrMonat } from "@/lib/mietkonto";
import { heuteBerlin } from "@/lib/zeitraum";
import { wartetAufVermieter } from "@/lib/zaehler";

// Zähler für die Navigation: was seit dem letzten Hinsehen liegen geblieben
// ist. Bewusst dieselbe Definition wie auf den Zielseiten, damit die Zahl am
// Reiter und die Liste dahinter nie auseinanderlaufen.

export type Neuigkeiten = {
  /** Mieterportal: offene Anliegen + neue Bewerbungen + wartende Auftrags-Freigaben. */
  mieterportal: number;
  /** Ein- & Ausgaben: noch nicht bestätigte Mieteingänge des laufenden Monats. */
  cashflow: number;
};


export async function ladeNeuigkeiten(): Promise<Neuigkeiten> {
  const supabase = await createClient();

  // Berliner Monat (vorher Server-Ortszeit = UTC: am 1. bis 2 Uhr galt noch der Vormonat).
  const monat = heuteBerlin().slice(0, 7);
  const naechster = ymPlus(monat, 1);

  // B08 (11.10.2026): Nur die Mietbuchungen DIESES Monats werden gebraucht — gezielt geladen statt
  // „alle“ (die bei über 1.000 still abgeschnitten wurden und bezahlte Monate offen erscheinen ließen).
  const [{ data: anliegen }, { data: bewerbungen }, { data: auftraege }, { data: mieter }, { data: mitMonat, error: e1 }, { data: ohneMonat, error: e2 }] =
    await Promise.all([
      supabase.from("anliegen").select("status"),
      supabase.from("bewerbungen").select("status"),
      supabase.from("auftraege").select("status"),
      supabase.from("mieter").select("id,kaltmiete,nk_vorauszahlung,stellplatz_miete,mietbeginn,mietende"),
      supabase.from("einnahmen").select("mieter_id,buchungsdatum,soll_monat").eq("kategorie", "Miete").eq("soll_monat", monat),
      supabase.from("einnahmen").select("mieter_id,buchungsdatum,soll_monat").eq("kategorie", "Miete").is("soll_monat", null)
        .gte("buchungsdatum", `${monat}-01`).lt("buchungsdatum", `${naechster}-01`),
    ]);
  // Ein Lesefehler ist kein „alles offen“ — dann zeigt der Reiter keine Zahl.
  const mieten = e1 || e2 ? null : [...(mitMonat ?? []), ...(ohneMonat ?? [])];

  const offeneAnliegen = (anliegen ?? []).filter((a) => a.status !== "erledigt").length;
  const neueBewerbungen = (bewerbungen ?? []).filter((b) => b.status === "neu").length;
  const wartendeFreigaben = wartetAufVermieter(auftraege ?? []);

  // Offene Mieteingänge des laufenden Monats: Mietverhältnis aktiv, Soll > 0,
  // aber für diesen Monat noch keine Miet-Einnahme gebucht.
  const gebucht = new Set(
    (mieten ?? [])
      .map((e) => `${e.mieter_id}|${e.soll_monat ?? zuJahrMonat(e.buchungsdatum)}`)
      .filter((k) => !k.endsWith("|null")),
  );
  const monatsStart = `${monat}-01`;
  const offeneMieten = mieten === null ? 0 : (mieter ?? []).filter((m) => {
    const soll = (m.kaltmiete ?? 0) + (m.nk_vorauszahlung ?? 0) + (m.stellplatz_miete ?? 0);
    if (soll <= 0 || !m.mietbeginn) return false;
    if (m.mietbeginn > `${monat}-31`) return false; // beginnt erst später
    if (m.mietende && m.mietende < monatsStart) return false; // schon beendet
    return !gebucht.has(`${m.id}|${monat}`);
  }).length;

  return {
    mieterportal: offeneAnliegen + neueBewerbungen + wartendeFreigaben,
    cashflow: offeneMieten,
  };
}
