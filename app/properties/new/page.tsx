import PropertyForm from "@/components/PropertyForm";
import { createProperty } from "@/lib/actions/properties";

export default function NewPropertyPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Neues Objekt</h1>
      <PropertyForm action={createProperty} submitLabel="Anlegen" />
    </div>
  );
}
