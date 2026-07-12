// Service-Portal (Rolle "service"): schlanke Shell wie das Mieterportal —
// erhaltene Aufträge der verknüpften Vermieter abarbeiten.
import { Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import AuftraegePortal, { type PortalAuftragRow, type PortalFirmaRow, type AuftraggeberRow } from "@/components/AuftraegePortal";
import { datum } from "@/lib/format";

export default async function ServicePortalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: zugaenge }, { data: auftragRows }, { data: firmenRows }] = await Promise.all([
    supabase.from("service_zugaenge").select("vermieter_id,firma,created_at").eq("user_id", user!.id),
    supabase
      .from("auftraege")
      .select("id,titel,beschreibung,termin,status,antwort,created_at,objekt_name,vermieter_name,erstellt_von,firma_id,mieter_id,public_token")
      .eq("service_user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("firmen").select("id,name,gewerk,telefon,email,website,notiz").order("name"),
  ]);
  const auftraege = (auftragRows ?? []) as PortalAuftragRow[];
  const firmen = (firmenRows ?? []) as PortalFirmaRow[];
  // Anzeigename je Auftraggeber: bester Kandidat ist der denormalisierte
  // Vermietername aus einem bestehenden Auftrag (Service hat keinen
  // RLS-Zugriff auf vermieter_profil).
  const auftraggeber: AuftraggeberRow[] = (zugaenge ?? []).map((z, i) => ({
    vermieter_id: z.vermieter_id,
    label:
      auftraege.find((a) => a.vermieter_name)?.vermieter_name ??
      `Auftraggeber ${i + 1} (seit ${datum(z.created_at)})`,
  }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 22px", borderBottom: "1px solid var(--line)", background: "var(--bg2)",
        }}
      >
        <div className="sidebar-logo" style={{ padding: 0, borderBottom: "none" }}>
          <h1>My<span>Immo</span></h1>
          <p>Service-Portal</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle variant="icon" />
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost" style={{ fontSize: 12 }}>Abmelden</button>
          </form>
        </div>
      </div>

      <main className="fade-up" style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 40px" }}>
        <div className="topbar" style={{ marginBottom: 20 }}>
          <div>
            <div className="topbar-title">Aufträge</div>
            <div className="topbar-sub">{user?.email}</div>
          </div>
        </div>

        {(zugaenge ?? []).length === 0 ? (
          <div className="section">
            <div className="section-body" style={{ textAlign: "center", padding: "36px 20px" }}>
              <Wrench size={36} color="var(--faint)" />
              <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>Noch kein Vermieter verknüpft</p>
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                Bitte frage den Vermieter nach einem Service-Einladungscode — die Verknüpfung
                passiert automatisch bei der Registrierung mit dem Code.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
              Verknüpft mit {(zugaenge ?? []).length === 1
                ? `1 Auftraggeber (seit ${datum((zugaenge ?? [])[0].created_at)})`
                : `${(zugaenge ?? []).length} Auftraggebern`} — neue Aufträge erscheinen automatisch.
            </p>
            <AuftraegePortal auftraege={auftraege} firmen={firmen} auftraggeber={auftraggeber} />
          </>
        )}
      </main>
    </div>
  );
}
