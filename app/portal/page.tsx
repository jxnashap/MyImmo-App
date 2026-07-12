// Mieterportal (Etappe 1): Der verknüpfte Mieter sieht seine Wohnung und
// Vertragsdaten. Anliegen/Schadensmeldungen und Dokumente folgen in Etappe 2
// (Businessplan Kap. 14 "Das Mieterportal").
import { Home, KeyRound, Wrench, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import BrandMark from "@/components/BrandMark";
import ThemeToggle from "@/components/ThemeToggle";
import type { Tenant, Property } from "@/lib/types";

export default async function PortalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: zugaenge } = await supabase
    .from("mieter_zugaenge")
    .select("mieter_id,prop_id")
    .eq("user_id", user!.id);

  const mieterIds = (zugaenge ?? []).map((z) => z.mieter_id);
  const { data: mieterRows } = mieterIds.length
    ? await supabase.from("mieter").select("*").in("id", mieterIds)
    : { data: [] as Tenant[] };
  const propIds = Array.from(
    new Set((zugaenge ?? []).map((z) => z.prop_id).filter(Boolean))
  ) as string[];
  const { data: propRows } = propIds.length
    ? await supabase.from("properties").select("id,bezeichnung,adresse").in("id", propIds)
    : { data: [] as Pick<Property, "id" | "bezeichnung" | "adresse">[] };
  const propVon = (id: string | null) =>
    (propRows ?? []).find((p) => p.id === id) ?? null;

  const wohnungen = ((mieterRows ?? []) as Tenant[]).map((m) => ({
    m,
    p: propVon(m.prop_id),
  }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Schlanke Portal-Topbar */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 22px", borderBottom: "1px solid var(--line)", background: "var(--bg2)",
        }}
      >
        <BrandMark size="sm" />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="badge"
            style={{ background: "var(--gold-pale)", color: "var(--gold)", border: "1px solid var(--gold-dim)" }}
          >
            Mieterportal
          </span>
          <ThemeToggle variant="icon" />
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost" style={{ fontSize: 12 }}>Abmelden</button>
          </form>
        </div>
      </div>

      <main className="fade-up" style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px" }}>
        <div className="topbar" style={{ marginBottom: 20 }}>
          <div>
            <div className="topbar-title">Meine Wohnung</div>
            <div className="topbar-sub">{user?.email}</div>
          </div>
        </div>

        {wohnungen.length === 0 ? (
          <div className="section">
            <div className="section-body" style={{ textAlign: "center", padding: "36px 20px" }}>
              <Home size={36} color="var(--faint)" />
              <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>Noch keine Wohnung verknüpft</p>
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                Bitte frage deinen Vermieter nach einem Einladungscode — die Verknüpfung
                passiert automatisch bei der Registrierung mit dem Code.
              </p>
            </div>
          </div>
        ) : (
          wohnungen.map(({ m, p }) => (
            <div key={m.id} className="section">
              <div className="section-header">
                <h3><Home size={15} style={{ verticalAlign: "-2px" }} /> {p?.bezeichnung ?? "Wohnung"}{m.einheit ? ` · ${m.einheit}` : ""}</h3>
                {p?.adresse && <span style={{ fontSize: 12, color: "var(--muted)" }}>{p.adresse}</span>}
              </div>
              <div className="section-body">
                <div className="grid-3" style={{ gap: 12 }}>
                  <div className="stat-box">
                    <div className="stat-lbl">Kaltmiete</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{euro(m.kaltmiete)}</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-lbl">NK-Vorauszahlung</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{euro(m.nk_vorauszahlung)}</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-lbl">Warmmiete</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: "var(--gold)" }}>
                      {euro((m.kaltmiete ?? 0) + (m.nk_vorauszahlung ?? 0) + (m.stellplatz_miete ?? 0))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
                  {m.mietbeginn && <span>Mietbeginn: <strong style={{ color: "var(--text)" }}>{datum(m.mietbeginn)}</strong></span>}
                  {m.flaeche != null && <span>Fläche: <strong style={{ color: "var(--text)" }}>{m.flaeche} m²</strong></span>}
                  {(m.kaution ?? 0) > 0 && <span>Kaution: <strong style={{ color: "var(--text)" }}>{euro(m.kaution)}</strong></span>}
                  {m.stellplatz && <span>Stellplatz: <strong style={{ color: "var(--text)" }}>{m.stellplatz}</strong></span>}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Ausblick Etappe 2 */}
        <div className="section">
          <div className="section-header"><h3>Bald verfügbar</h3></div>
          <div className="section-body" style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--muted)" }}>
            <span><Wrench size={14} style={{ verticalAlign: "-2px" }} /> Anliegen &amp; Schadensmeldungen direkt an deinen Vermieter</span>
            <span><FileText size={14} style={{ verticalAlign: "-2px" }} /> Dokumente anfordern (z. B. Mietbescheinigung, NK-Abrechnung)</span>
            <span><KeyRound size={14} style={{ verticalAlign: "-2px" }} /> Nachrichten &amp; Status deiner Anfragen</span>
          </div>
        </div>
      </main>
    </div>
  );
}
