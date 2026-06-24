import Link from "next/link";
import ImportWizard from "@/components/ImportWizard";
import { createProperty } from "@/lib/actions/properties";

export default function ImportPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/properties" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Immobilie importieren</div><div className="topbar-sub">KI-Anzeigenimport oder Schnellformular</div></div>
        </div>
      </div>
      <ImportWizard action={createProperty} />
    </div>
  );
}
