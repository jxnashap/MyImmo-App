// Mieterportal: Wohnung + Vertragsdaten, Anliegen (mit Anhängen) und
// Dokument-Anfragen — umgeschaltet über die Glass-Toolbar oben in der
// Mitte (Businessplan Kap. 14 "Das Mieterportal").
import Link from "next/link";
import { Home, MessageSquareText, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";
import AnliegenPortal, { type AnliegenRow, type DateiRef } from "@/components/AnliegenPortal";
import DokumenteAnfrage from "@/components/DokumenteAnfrage";
import type { Tenant, Property } from "@/lib/types";

const TABS = [
  { key: "wohnung", label: "Wohnung", icon: Home },
  { key: "anliegen", label: "Anliegen", icon: MessageSquareText },
  { key: "dokumente", label: "Dokumente", icon: FileText },
] as const;

export default async function PortalPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = TABS.some((t) => t.key === searchParams.tab) ? (searchParams.tab as string) : "wohnung";

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

  const { data: anliegenRows } = await supabase
    .from("anliegen")
    .select("id,typ,titel,beschreibung,status,antwort,created_at")
    .eq("mieter_user_id", user!.id)
    .order("created_at", { ascending: false });
  const anliegen = (anliegenRows ?? []) as AnliegenRow[];
  const dokumentAnfragen = anliegen.filter((a) => a.typ === "dokument");

  // Vom Vermieter freigegebene Archiv-Dokumente (RLS: nur mieter_freigabe)
  const { data: freigegebeneDocs } = mieterIds.length
    ? await supabase
        .from("notizen")
        .select("id,titel,kategorie,datei_name,created_at")
        .in("mieter_id", mieterIds)
        .eq("mieter_freigabe", true)
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; titel: string | null; kategorie: string | null; datei_name: string | null; created_at: string | null }[] };

  const { data: dateiRows } = anliegen.length
    ? await supabase
        .from("anliegen_dateien")
        .select("id,name,anliegen_id")
        .in("anliegen_id", anliegen.map((a) => a.id))
    : { data: [] as DateiRef[] };
  const dateien = (dateiRows ?? []) as DateiRef[];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Portal-Topbar mit dem MyImmo-Schriftzug wie in der Vermieter-Sidebar */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 22px", borderBottom: "1px solid var(--line)", background: "var(--bg2)",
        }}
      >
        <div className="sidebar-logo" style={{ padding: 0, borderBottom: "none" }}>
          <h1>My<span>Immo</span></h1>
          <p>Mieterportal</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle variant="icon" />
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost" style={{ fontSize: 12 }}>Abmelden</button>
          </form>
        </div>
      </div>

      {/* Glass-Toolbar oben in der Mitte: Bereiche umschalten */}
      <div className="portal-toolbar">
        <nav className="glass-bar" aria-label="Portal-Bereiche">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.key} href={`/portal?tab=${t.key}`} className={`glass-item ${tab === t.key ? "active" : ""}`}>
                <Icon size={14} /> {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="fade-up" style={{ maxWidth: 760, margin: "0 auto", padding: "8px 20px 40px" }}>
        {tab === "wohnung" && (
          <>
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
          </>
        )}

        {tab === "anliegen" && (
          <>
            <div className="topbar" style={{ marginBottom: 20 }}>
              <div>
                <div className="topbar-title">Anliegen</div>
                <div className="topbar-sub">Schäden melden, Fragen stellen — mit Fotos/PDF als Anhang</div>
              </div>
            </div>
            {wohnungen.length === 0 ? (
              <div className="section"><div className="section-body" style={{ fontSize: 12, color: "var(--muted)" }}>
                Erst mit verknüpfter Wohnung möglich — frage deinen Vermieter nach einem Einladungscode.
              </div></div>
            ) : (
              <AnliegenPortal anliegen={anliegen} dateien={dateien} />
            )}
          </>
        )}

        {tab === "dokumente" && (
          <>
            <div className="topbar" style={{ marginBottom: 20 }}>
              <div>
                <div className="topbar-title">Dokumente</div>
                <div className="topbar-sub">Bescheinigungen &amp; Unterlagen beim Vermieter anfordern</div>
              </div>
            </div>
            {wohnungen.length === 0 ? (
              <div className="section"><div className="section-body" style={{ fontSize: 12, color: "var(--muted)" }}>
                Erst mit verknüpfter Wohnung möglich — frage deinen Vermieter nach einem Einladungscode.
              </div></div>
            ) : (
              <>
                <div className="section">
                  <div className="section-header"><h3>Bereitgestellte Dokumente</h3></div>
                  <div className="section-body">
                    {(freigegebeneDocs ?? []).length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--faint)" }}>
                        Noch keine Dokumente freigegeben — dein Vermieter kann dir hier z. B.
                        Mietvertrag, NK-Abrechnung oder den Energieausweis bereitstellen.
                      </p>
                    ) : (
                      (freigegebeneDocs ?? []).map((d) => (
                        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                          <FileText size={14} color="var(--gold)" />
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>{d.titel || d.datei_name || "Dokument"}</span>
                          {d.kategorie && <span className="badge badge-teal">{d.kategorie}</span>}
                          <span style={{ color: "var(--muted)", marginLeft: "auto" }}>{d.created_at ? datum(d.created_at) : ""}</span>
                          <a href={`/archiv/${d.id}/datei`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Ansehen</a>
                          <a href={`/archiv/${d.id}/datei?download=1`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Herunterladen</a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <DokumenteAnfrage anfragen={dokumentAnfragen} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
