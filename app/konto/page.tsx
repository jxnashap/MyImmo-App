import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import KontoVerwaltung from "@/components/KontoVerwaltung";

// Konto-Einstellungen für MIETER und SERVICE.
//
// `/einstellungen` ist für diese Rollen gesperrt (Vermieter-Umfang), sie hatten
// deshalb gar keine — kein Passwort ändern, kein Datenexport, keine
// Kontolöschung. Diese Seite schließt genau diese Lücke; Vermieter und
// Hausverwaltung werden auf ihre vollen Einstellungen umgeleitet.

export const dynamic = "force-dynamic";

export default async function KontoSeite() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rolleRow } = await supabase
    .from("nutzer_rollen")
    .select("rolle")
    .eq("user_id", user.id)
    .maybeSingle();
  const rolle = (rolleRow?.rolle ?? "vermieter") as string;

  if (rolle !== "mieter" && rolle !== "service") redirect("/einstellungen");

  const heim = rolle === "mieter" ? "/portal" : "/service";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <Link href={heim} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>
          <ArrowLeft size={13} style={{ verticalAlign: "-2px" }} /> Zurück
        </Link>
        <div>
          <div className="topbar-kicker">Konto</div>
          <div className="topbar-title" style={{ fontSize: 22 }}>Meine Einstellungen</div>
        </div>
      </div>

      <KontoVerwaltung email={user.email ?? "—"} rolle={rolle as "mieter" | "service"} />
    </div>
  );
}
