// Daten des Service-Portals — EIN Lader für zwei Blickwinkel (01.10.2026),
// nach dem Muster von lib/portalDaten.ts:
//
//   (1) der Service-Partner selbst unter /service (Quelle `service`; die RLS
//       filtert auf seine Zugänge, Aufträge und die Firmen seiner Vermieter),
//   (2) der Vermieter in der Ansicht unter /anliegen?tab=vorschau-service
//       (Quelle `vermieter`: eigene Tabellen, gefiltert auf EINEN Partner).
//
// Beim Vermieter stehen die Filter, die beim Partner die RLS setzt,
// ausdrücklich in der Abfrage — sonst zeigte die Ansicht Aufträge anderer
// Partner. tests/demoService.test.ts prüft sie.
import type { PortalAuftragRow, PortalFirmaRow, AuftraggeberRow } from "@/components/AuftraegePortal";
import { datum } from "@/lib/format";
import { heuteBerlin } from "@/lib/zeitraum";
import { seitFuerVergleich } from "@/lib/serviceNeu";
import { AUFTRAG_NOTIZ_SPALTEN, notizenJeAuftrag, type AuftragNotiz } from "@/lib/auftragNotizen";

export const SERVICE_AUFTRAG_SPALTEN =
  "id,titel,beschreibung,termin,status,antwort,created_at,objekt_name,vermieter_name,erstellt_von,firma_id,mieter_id,public_token,vermieter_id,vorgeschlagene_firma_id,taetigkeit,updated_at";
export const SERVICE_FIRMA_SPALTEN = "id,name,gewerk,telefon,email,website,notiz";

/** Rolle je Verknüpfung (Migration 20261005100000): Hausmeister betreut Objekte und stellt
 *  Anträge; Dienstleister sieht nur die Aufträge, die ihm gegeben werden. */
export type ServiceRolle = "hausmeister" | "dienstleister";
/** Ein zugewiesenes Objekt — nur die Spalten der Sicht `service_objekte_portal`. */
export type ServiceObjekt = { id: string; bezeichnung: string; adresse: string | null; vermieter_id: string };

export type ServicePortalDaten = {
  zugaenge: { vermieter_id: string; firma: string | null; created_at: string; rolle: ServiceRolle; zuletzt_gesehen_am?: string | null }[];
  /** Je Auftraggeber: ab wann etwas als „neu“ gilt (lib/serviceNeu.ts). */
  seitJe: Record<string, string>;
  objekte: ServiceObjekt[];
  auftraege: PortalAuftragRow[];
  firmen: PortalFirmaRow[];
  auftraggeber: AuftraggeberRow[];
};

export type ServiceQuelle =
  | { art: "service"; serviceUserId: string }
  | { art: "vermieter"; vermieterId: string; serviceUserId: string };

/** Eintrag der Partner-Auswahl in der Ansicht. */
export type VorschauPartner = { id: string; name: string; offen: number };

/** Adresse der Service-Ansicht — die EINE Stelle für Auswahl und Links. */
export function serviceVorschauUrl(serviceUserId: string): string {
  return `/anliegen?tab=vorschau-service&partner=${encodeURIComponent(serviceUserId)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (tabelle: string) => any };

export async function ladeServicePortalDaten(supabase: Db, quelle: ServiceQuelle): Promise<ServicePortalDaten> {
  const alsV = quelle.art === "vermieter" ? quelle.vermieterId : null;

  let zq = supabase.from("service_zugaenge").select("vermieter_id,firma,created_at,rolle,zuletzt_gesehen_am").eq("user_id", quelle.serviceUserId);
  if (alsV) zq = zq.eq("vermieter_id", alsV);

  let aq = supabase.from("auftraege").select(SERVICE_AUFTRAG_SPALTEN).eq("service_user_id", quelle.serviceUserId);
  if (alsV) aq = aq.eq("vermieter_id", alsV);

  // Firmen: der Partner sieht per RLS die Verzeichnisse der Vermieter, bei denen er HAUSMEISTER
  // ist (Migration 20261005101000); in der Ansicht nur das eigene. Ein Dienstleister sieht keine.
  let fq = supabase.from("firmen").select(SERVICE_FIRMA_SPALTEN);
  if (alsV) fq = fq.eq("user_id", alsV);

  // Objekte: der Partner liest NUR die Sicht (Bezeichnung, Adresse); der Vermieter seine eigenen
  // Zuordnungen für genau diesen Partner und die Namen aus `properties`.
  const oq = alsV
    ? supabase.from("service_objekte").select("prop_id").eq("vermieter_id", alsV).eq("service_user_id", quelle.serviceUserId)
    : supabase.from("service_objekte_portal").select("id,bezeichnung,adresse,vermieter_id").order("bezeichnung");

  const [{ data: zugaenge }, { data: auftragRows }, { data: firmenRows }, { data: objektRows }] = await Promise.all([
    zq,
    aq.order("created_at", { ascending: false }).limit(100),
    fq.order("name"),
    oq,
  ]);

  let objekte: ServiceObjekt[] = [];
  if (alsV) {
    const ids = ((objektRows ?? []) as { prop_id: string }[]).map((o) => o.prop_id);
    if (ids.length > 0) {
      const { data: props } = await supabase.from("properties").select("id,bezeichnung,adresse").eq("user_id", alsV).in("id", ids).order("bezeichnung");
      objekte = ((props ?? []) as Omit<ServiceObjekt, "vermieter_id">[]).map((p) => ({ ...p, vermieter_id: alsV }));
    }
  } else {
    objekte = (objektRows ?? []) as ServiceObjekt[];
  }

  const roh = (auftragRows ?? []) as (PortalAuftragRow & { vermieter_id?: string })[];
  // Verlauf (Notizen, Fotos) der geladenen Aufträge — ohne Bilddaten; die liefert die Route.
  let notizen: AuftragNotiz[] = [];
  if (roh.length > 0) {
    let nq = supabase.from("auftrag_notizen").select(AUFTRAG_NOTIZ_SPALTEN).in("auftrag_id", roh.map((a) => a.id));
    if (alsV) nq = nq.eq("vermieter_id", alsV);
    const { data: nRows } = await nq.order("created_at");
    notizen = (nRows ?? []) as AuftragNotiz[];
  }
  const jeAuftrag = notizenJeAuftrag(notizen);
  const auftraege = roh.map((a) => ({ ...a, notizen: jeAuftrag.get(a.id) ?? [] }));
  const z = (zugaenge ?? []) as ServicePortalDaten["zugaenge"];
  // Anzeigename je Auftraggeber: der denormalisierte Vermietername aus einem
  // Auftrag (der Partner hat keinen RLS-Zugriff auf vermieter_profil).
  const auftraggeber: AuftraggeberRow[] = z.map((zz, i) => ({
    vermieter_id: zz.vermieter_id,
    rolle: zz.rolle ?? "hausmeister",
    label:
      auftraege.find((a) => a.vermieter_id === zz.vermieter_id && a.vermieter_name)?.vermieter_name ??
      `Auftraggeber ${i + 1} (seit ${datum(zz.created_at)})`,
  }));

  // Firmen nur, wo er Hausmeister ist — die Ansicht des Vermieters spiegelt die RLS.
  const alsHausmeister = new Set(z.filter((zz) => zz.rolle !== "dienstleister").map((zz) => zz.vermieter_id));
  const firmen = alsV && !alsHausmeister.has(alsV) ? [] : ((firmenRows ?? []) as PortalFirmaRow[]);

  const heute = heuteBerlin();
  const seitJe = Object.fromEntries(z.map((zz) => [zz.vermieter_id, seitFuerVergleich(zz.zuletzt_gesehen_am, heute)]));

  return { zugaenge: z, objekte, auftraege, firmen, auftraggeber, seitJe };
}
