import { notFound } from "next/navigation";
import PropertyForm from "@/components/PropertyForm";
import { createClient } from "@/lib/supabase/server";
import { updateProperty, deleteProperty } from "@/lib/actions/properties";
import type { Property } from "@/lib/types";

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("properties").select("*").eq("id", params.id).single();
  if (!data) notFound();
  const property = data as Property;

  const update = updateProperty.bind(null, property.id);
  const remove = deleteProperty.bind(null, property.id);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{property.bezeichnung}</h1>
        <form action={remove}>
          <button className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10">
            Löschen
          </button>
        </form>
      </div>
      <PropertyForm action={update} property={property} submitLabel="Speichern" />
    </div>
  );
}
