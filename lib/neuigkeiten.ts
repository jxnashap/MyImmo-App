import "server-only";
import { createClient } from "@/lib/supabase/server";
import { zuJahrMonat } from "@/lib/mietkonto";
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
  const supabase = createClient();

  const monat = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const [{ data: anliegen }, { data: bewerbungen }, { data: auftraege }, { data: mieter }, { data: mieten }] =
    await Promise.all([
      supabase.from("anliegen").select("status"),
      supabase.from("bewerbungen").select("status"),
      supabase.from("auftraege").select("status"),
      supabase.from("mieter").select("id,kaltmiete,nk_vorauszahlung,stellplatz_miete,mietbeginn,mietende"),
      supabase.from("einnahmen").select("mieter_id,buchungsdatum,soll_monat").eq("kategorie", "Miete"),
    ]);

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
  const offeneMieten = (mieter ?? []).filter((m) => {
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
