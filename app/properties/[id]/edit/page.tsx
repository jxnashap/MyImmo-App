import Link from "next/link";
import { notFound } from "next/navigation";
import PropertyForm from "@/components/PropertyForm";
import { createClient } from "@/lib/supabase/server";
import { updateProperty, deleteProperty } from "@/lib/actions/properties";
import DeleteButton from "@/components/DeleteButton";
import type { Property } from "@/lib/types";

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("properties").select("*").eq("id", params.id).single();
  if (!data) notFound();
  const property = data as Property;

  const update = updateProperty.bind(null, property.id);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/properties/${property.id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">{property.bezeichnung}</div><div className="topbar-sub">Objekt bearbeiten</div></div>
        </div>
        <DeleteButton action={deleteProperty.bind(null, property.id)} className="btn btn-ghost" label="🗑 Löschen" confirmText={`„${property.bezeichnung}" wirklich löschen?`} />
      </div>
      <PropertyForm action={update} property={property} submitLabel="Speichern" />
    </div>
  );
}
