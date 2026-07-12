// Vermieter: Bewerber-Links (öffentliche Selbstauskunft) und eingegangene
// Bewerbungen je Objekt verwalten.
import { createClient } from "@/lib/supabase/server";
import BewerbungenManager, { type BewerberLinkRow, type BewerbungRow } from "@/components/BewerbungenManager";

export default async function BewerbungenPage() {
  const supabase = createClient();
  const [{ data: linkRows }, { data: bewerbungRows }, { data: props }] = await Promise.all([
    supabase.from("bewerber_links").select("*").order("created_at", { ascending: false }),
    supabase.from("bewerbungen").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
  ]);

  const objektName = (id: string | null) =>
    (props ?? []).find((p) => p.id === id)?.bezeichnung ?? "–";

  const links: BewerberLinkRow[] = ((linkRows ?? []) as any[]).map((l) => ({
    id: l.id, token: l.token, titel: l.titel, aktiv: l.aktiv, created_at: l.created_at,
    objektName: objektName(l.prop_id),
  }));
  const bewerbungen: BewerbungRow[] = ((bewerbungRows ?? []) as any[]).map((b) => ({
    id: b.id, name: b.name, email: b.email, telefon: b.telefon, einzug_ab: b.einzug_ab,
    personen: b.personen, beruf: b.beruf, arbeitgeber: b.arbeitgeber,
    netto_einkommen: b.netto_einkommen == null ? null : Number(b.netto_einkommen),
    raucher: b.raucher, haustiere: b.haustiere, schufa: b.schufa, nachricht: b.nachricht,
    unterschrift_data: b.unterschrift_data, status: b.status, created_at: b.created_at,
    objektName: objektName(b.prop_id),
  }));

  const neue = bewerbungen.filter((b) => b.status === "neu").length;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Bewerbungen</div>
          <div className="topbar-sub">
            Selbstauskunft-Link fürs Inserat teilen — Bewerbungen laufen hier ein
            {bewerbungen.length > 0 ? ` · ${neue} neu von ${bewerbungen.length}` : ""}
          </div>
        </div>
      </div>
      <BewerbungenManager links={links} bewerbungen={bewerbungen} properties={props ?? []} />
    </div>
  );
}
