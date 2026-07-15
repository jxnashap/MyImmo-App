import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ImportAssistent from "@/components/ImportAssistent";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

// Daten-Import (C6): Umzug von vermietet.de, objego oder Excel per CSV mit
// Spalten-Zuordnung. Erst Objekte importieren, dann Mieter (Zuordnung per Name).
export default async function ImportPage() {
  const supabase = createClient();
  const { data: props } = await supabase.from("properties").select("bezeichnung").order("bezeichnung");
  const objektNamen = (props ?? []).map((p) => p.bezeichnung as string).filter(Boolean);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Daten importieren</div>
          <div className="topbar-sub">
            Umzug von vermietet.de, objego oder Excel — CSV hochladen, Spalten zuordnen, prüfen, importieren
          </div>
        </div>
        <Link href="/einstellungen" className="btn btn-ghost" style={{ fontSize: 12 }}>
          <ArrowLeft size={14} style={{ verticalAlign: "-2px" }} /> Einstellungen
        </Link>
      </div>
      <ImportAssistent objektNamen={objektNamen} />
    </div>
  );
}
