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

export const SERVICE_AUFTRAG_SPALTEN =
  "id,titel,beschreibung,termin,status,antwort,created_at,objekt_name,vermieter_name,erstellt_von,firma_id,mieter_id,public_token,vermieter_id";
export const SERVICE_FIRMA_SPALTEN = "id,name,gewerk,telefon,email,website,notiz";

export type ServicePortalDaten = {
  zugaenge: { vermieter_id: string; firma: string | null; created_at: string }[];
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

  let zq = supabase.from("service_zugaenge").select("vermieter_id,firma,created_at").eq("user_id", quelle.serviceUserId);
  if (alsV) zq = zq.eq("vermieter_id", alsV);

  let aq = supabase.from("auftraege").select(SERVICE_AUFTRAG_SPALTEN).eq("service_user_id", quelle.serviceUserId);
  if (alsV) aq = aq.eq("vermieter_id", alsV);

  // Firmen: der Partner sieht per RLS die Verzeichnisse aller verknüpften
  // Vermieter; in der Ansicht nur das eigene — genau das, was er von DIR sieht.
  let fq = supabase.from("firmen").select(SERVICE_FIRMA_SPALTEN);
  if (alsV) fq = fq.eq("user_id", alsV);

  const [{ data: zugaenge }, { data: auftragRows }, { data: firmenRows }] = await Promise.all([
    zq,
    aq.order("created_at", { ascending: false }).limit(100),
    fq.order("name"),
  ]);

  const auftraege = (auftragRows ?? []) as (PortalAuftragRow & { vermieter_id?: string })[];
  const z = (zugaenge ?? []) as ServicePortalDaten["zugaenge"];
  // Anzeigename je Auftraggeber: der denormalisierte Vermietername aus einem
  // Auftrag (der Partner hat keinen RLS-Zugriff auf vermieter_profil).
  const auftraggeber: AuftraggeberRow[] = z.map((zz, i) => ({
    vermieter_id: zz.vermieter_id,
    label:
      auftraege.find((a) => a.vermieter_id === zz.vermieter_id && a.vermieter_name)?.vermieter_name ??
      `Auftraggeber ${i + 1} (seit ${datum(zz.created_at)})`,
  }));

  return { zugaenge: z, auftraege, firmen: (firmenRows ?? []) as PortalFirmaRow[], auftraggeber };
}
