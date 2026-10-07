import Link from "next/link";
import { notFound } from "next/navigation";
import TenantForm from "@/components/TenantForm";
import { decryptNullable } from "@/lib/crypto/secure";
import PositionsManager, { type Position } from "@/components/PositionsManager";
import NkOcrUpload from "@/components/NkOcrUpload";
import { createClient } from "@/lib/supabase/server";
import { nkAmObjekt } from "@/lib/nkPositionen";
import { updateTenant, deleteTenant } from "@/lib/actions/tenants";
import DeleteButton from "@/components/DeleteButton";
import type { Tenant } from "@/lib/types";
import { ReceiptText, Trash2 } from "lucide-react";

export default async function EditTenantPage(props0: { params: Promise<{ id: string }>; searchParams: Promise<{ jahr?: string }> }) {
  const params = await props0.params;
  // Stufe 0 (07.10.2026): Die NK-Seite verlinkt hierher mit ihrem Jahr (?jahr=…#positionen) — neue
  // Positionen und der Abrechnungs-Import landen dann in genau dem Jahr, das man gerade abrechnet.
  const jahrParam = Number((await props0.searchParams).jahr);
  const nkJahr = Number.isInteger(jahrParam) && jahrParam >= 2000 && jahrParam <= 2100 ? jahrParam : new Date().getFullYear() - 1;
  const supabase = await createClient();
  const [{ data }, { data: props }, { data: positions }, { data: zugang }] = await Promise.all([
    supabase.from("mieter").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase
      .from("mieter_positionen")
      .select("id,bezeichnung,betrag,umlageschluessel,umlagefaehig,jahr,aufteilung,verbrauch_mieter,verbrauch_gesamt,grundkosten_prozent,flaeche_gesamt")
      .eq("mieter_id", params.id)
      .order("created_at"),
    // S4: Hängt ein Portal-Konto an diesem Mieter? Dann fragt das Formular bei Namens-/Beginn-Änderung nach.
    supabase.from("mieter_zugaenge").select("email").eq("mieter_id", params.id).limit(1),
  ]);
  if (!data) notFound();
  const tenant = data as Tenant;
  // Stufe 1 (07.10.2026): Beim Mehrfamilienhaus stehen die Nebenkosten am Objekt — hier nur noch
  // der Weg dorthin; die alten Positionen bleiben als Altbestand aufklappbar.
  const amObjekt = await nkAmObjekt(supabase, tenant.prop_id);
  const anzahlAlt = (positions ?? []).length;

  const update = updateTenant.bind(null, tenant.id);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/tenants/${tenant.id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>← Zurück</Link>
          <div><div className="topbar-title">{[tenant.vorname, tenant.nachname].filter(Boolean).join(" ") || "Mieter"}</div><div className="topbar-sub">Mieter bearbeiten</div></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/tenants/${tenant.id}/nk`} className="btn btn-ghost" style={{ fontSize: 12 }}><ReceiptText size={14} style={{ verticalAlign: "-2px" }} /> NK-Abrechnung</Link>
          <DeleteButton action={deleteTenant.bind(null, tenant.id)} className="btn btn-ghost" label={<><Trash2 size={14} style={{ verticalAlign: "-2px" }} /> Löschen</>} confirmText={`„${[tenant.vorname, tenant.nachname].filter(Boolean).join(" ")}" wirklich löschen?`} />
        </div>
      </div>

      <TenantForm
        action={update}
        tenant={{ ...tenant, iban: decryptNullable(tenant.iban) }}
        properties={props ?? []}
        submitLabel="Speichern"
        portalKonto={zugang?.[0] ? ((zugang[0] as { email: string | null }).email ?? "verbunden (Adresse unbekannt)") : null}
      />

      {amObjekt && (
        <div className="section" style={{ marginTop: 24 }}>
          <div className="section-header">
            <div>
              <h3>Nebenkosten</h3>
              <div className="section-sub">Die Kosten dieses Hauses stehen einmal am Objekt und werden auf alle Mieter verteilt.</div>
            </div>
            <Link href={`/properties/${tenant.prop_id}/nebenkosten?jahr=${nkJahr}`} className="btn btn-gold" style={{ fontSize: 12 }}>Nebenkosten {nkJahr} öffnen</Link>
          </div>
          {anzahlAlt > 0 && (
            <details className="section-body">
              <summary style={{ fontSize: 12.5, cursor: "pointer", color: "var(--muted)" }}>
                Ältere Positionen bei diesem Mieter ({anzahlAlt}) — gelten nur für Jahre ohne Kosten am Objekt
              </summary>
              <div style={{ marginTop: 12 }}>
                <PositionsManager mieterId={tenant.id} positions={(positions ?? []) as Position[]} startJahr={nkJahr} />
              </div>
            </details>
          )}
        </div>
      )}

      {!amObjekt && <div style={{ marginTop: 24 }}>
        <PositionsManager mieterId={tenant.id} positions={(positions ?? []) as Position[]} startJahr={nkJahr} />
        {/* Vorjahr wie der Default der NK-Seite — der alte Upload speicherte
            ins laufende Kalenderjahr, wo die Abrechnung nie hinschaut. */}
        <NkOcrUpload
          mieterId={tenant.id}
          jahr={nkJahr}
          bestehend={(positions ?? [])
            .filter((p) => (p.jahr == null || p.jahr === nkJahr) && p.umlagefaehig === true)
            .map((p) => ({ id: p.id, bezeichnung: p.bezeichnung, betrag: p.betrag, aufteilung: p.aufteilung ?? null }))}
        />
      </div>}
    </div>
  );
}
