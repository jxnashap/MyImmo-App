import Link from "next/link";
import { notFound } from "next/navigation";
import TenantForm from "@/components/TenantForm";
import { decryptNullable } from "@/lib/crypto/secure";
import PositionsManager, { type Position } from "@/components/PositionsManager";
import NkOcrUpload from "@/components/NkOcrUpload";
import { createClient } from "@/lib/supabase/server";
import { updateTenant, deleteTenant } from "@/lib/actions/tenants";
import DeleteButton from "@/components/DeleteButton";
import type { Tenant } from "@/lib/types";
import { ReceiptText, Trash2 } from "lucide-react";

export default async function EditTenantPage(props0: { params: Promise<{ id: string }> }) {
  const params = await props0.params;
  const supabase = await createClient();
  const [{ data }, { data: props }, { data: positions }] = await Promise.all([
    supabase.from("mieter").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase
      .from("mieter_positionen")
      .select("id,bezeichnung,betrag,umlageschluessel,umlagefaehig,jahr,aufteilung,verbrauch_mieter,verbrauch_gesamt,grundkosten_prozent,flaeche_gesamt")
      .eq("mieter_id", params.id)
      .order("created_at"),
  ]);
  if (!data) notFound();
  const tenant = data as Tenant;

  const update = updateTenant.bind(null, tenant.id);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/tenants/${tenant.id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">{[tenant.vorname, tenant.nachname].filter(Boolean).join(" ") || "Mieter"}</div><div className="topbar-sub">Mieter bearbeiten</div></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/tenants/${tenant.id}/nk`} className="btn btn-ghost" style={{ fontSize: 12 }}><ReceiptText size={14} style={{ verticalAlign: "-2px" }} /> NK-Abrechnung</Link>
          <DeleteButton action={deleteTenant.bind(null, tenant.id)} className="btn btn-ghost" label={<><Trash2 size={14} style={{ verticalAlign: "-2px" }} /> Löschen</>} confirmText={`„${[tenant.vorname, tenant.nachname].filter(Boolean).join(" ")}" wirklich löschen?`} />
        </div>
      </div>

      <TenantForm action={update} tenant={{ ...tenant, iban: decryptNullable(tenant.iban) }} properties={props ?? []} submitLabel="Speichern" />

      <div style={{ marginTop: 24 }}>
        <PositionsManager mieterId={tenant.id} positions={(positions ?? []) as Position[]} />
        {/* Vorjahr wie der Default der NK-Seite — der alte Upload speicherte
            ins laufende Kalenderjahr, wo die Abrechnung nie hinschaut. */}
        <NkOcrUpload
          mieterId={tenant.id}
          jahr={new Date().getFullYear() - 1}
          bestehend={(positions ?? [])
            .filter((p) => (p.jahr == null || p.jahr === new Date().getFullYear() - 1) && p.umlagefaehig === true)
            .map((p) => ({ id: p.id, bezeichnung: p.bezeichnung, betrag: p.betrag, aufteilung: p.aufteilung ?? null }))}
        />
      </div>
    </div>
  );
}
