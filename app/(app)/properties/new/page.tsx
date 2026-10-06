import Link from "next/link";
import PropertyForm from "@/components/PropertyForm";
import { createProperty } from "@/lib/actions/properties";

export default function NewPropertyPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/properties" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Neues Objekt</div></div>
        </div>
        {/* Paket D: Tour und Start-Checkliste empfehlen den KI-Import — die Seite selbst hatte keinen Weg dorthin. */}
        <Link href="/properties/import" className="btn btn-ghost" style={{ fontSize: 12 }}>Aus Exposé importieren</Link>
      </div>
      <PropertyForm action={createProperty} submitLabel="Anlegen" />
    </div>
  );
}
