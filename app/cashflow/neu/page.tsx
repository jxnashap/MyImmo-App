// Neue Buchung (Einnahme ODER Ausgabe) — gemeinsames Formular mit Umschalter.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BuchungForm from "@/components/BuchungForm";
import type { Property, Tenant } from "@/lib/types";

export default async function NeueBuchungPage({
  searchParams,
}: {
  searchParams: { typ?: string; prop?: string };
}) {
  const supabase = createClient();
  const [{ data: props }, { data: miet }] = await Promise.all([
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/cashflow" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Neue Buchung</div></div>
        </div>
      </div>

      <BuchungForm
        properties={(props ?? []) as Pick<Property, "id" | "bezeichnung">[]}
        tenants={(miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[]}
        back="/cashflow"
        typInitial={searchParams.typ === "ausgabe" ? "ausgabe" : "einnahme"}
        propInitial={searchParams.prop ?? ""}
      />
    </div>
  );
}
