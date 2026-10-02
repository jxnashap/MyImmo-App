// Die Mieterportal-Oberfläche — EINE Darstellung für zwei Orte (01.10.2026):
// /portal (der Mieter selbst) und /anliegen?tab=vorschau (der Vermieter sieht,
// was sein Mieter sieht). Server-Komponente; die Formulare stecken in den
// Client-Bausteinen (AnliegenPortal & Co.), die in der Vorschau mit `nurLesen`
// laufen — der Vermieter darf aus der Vorschau heraus nichts im Namen des
// Mieters absenden.
import Link from "next/link";
import type { ReactNode } from "react";
import { Home, MessageSquareText, FileText, Gauge, Banknote, Receipt } from "lucide-react";
import { euro, datum } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";
import AnliegenPortal from "@/components/AnliegenPortal";
import DokumenteAnfrage from "@/components/DokumenteAnfrage";
import ZaehlerPortal from "@/components/ZaehlerPortal";
import AnfragenVomVermieter from "@/components/AnfragenVomVermieter";
import type { PortalDaten } from "@/lib/portalDaten";
import WischReiter from "@/components/WischReiter";
import ZustellungBestaetigen from "@/components/ZustellungBestaetigen";
import MieterAufgabenListe from "@/components/MieterAufgabenListe";
import MieterKontoTabelle from "@/components/MieterKontoTabelle";
import MitteilungenListe from "@/components/MitteilungenListe";
import HausInfosKarte from "@/components/HausInfosKarte";
import { NotfallKasten } from "@/components/NotfallHinweis";
import { baueMieterAufgaben } from "@/lib/mieterAufgaben";
import { heuteBerlin } from "@/lib/zeitraum";
import GlassLeiste from "@/components/GlassLeiste";

export const PORTAL_TABS = [
  { key: "wohnung", label: "Wohnung", icon: Home },
  { key: "anliegen", label: "Anliegen", icon: MessageSquareText },
  { key: "zahlungen", label: "Zahlungen", icon: Banknote },
  { key: "dokumente", label: "Dokumente", icon: FileText },
  { key: "zaehler", label: "Zähler", icon: Gauge },
] as const;
export type PortalTab = (typeof PORTAL_TABS)[number]["key"];

export function portalTab(wert: string | undefined): PortalTab {
  return PORTAL_TABS.some((t) => t.key === wert) ? (wert as PortalTab) : "wohnung";
}

export default function PortalAnsicht({
  daten,
  tab,
  hrefFuer,
  kopfzeile,
  vorschau = false,
}: {
  daten: PortalDaten;
  tab: PortalTab;
  /** Ziel eines Reiters — /portal?tab=… oder die Vorschau-URL des Vermieters. */
  hrefFuer: (tab: PortalTab) => string;
  /** Zeile unter „Meine Wohnung": die E-Mail des Mieters, in der Vorschau sein Name. */
  kopfzeile: string | null | undefined;
  vorschau?: boolean;
}) {
  const { wohnungen, anliegen, dokumentAnfragen, verlauf, dateien, freigegebeneDocs, vermieterAnfragen, zaehlerMeldungen, zahlungen, jahr, summeJahr, belege } = daten;
  const keineWohnung = (
    <div className="section"><div className="section-body" style={{ fontSize: 12, color: "var(--muted)" }}>
      Erst mit verknüpfter Wohnung möglich — frage deinen Vermieter nach einem Einladungscode.
    </div></div>
  );

  // „Was muss ich erledigen?“ — aus den ohnehin geladenen Daten (lib/mieterAufgaben.ts).
  const aufgaben = baueMieterAufgaben(daten, heuteBerlin());
  const notdienste = Array.from(new Set(
    Object.values(daten.hausInfos).map((h) => (h.notdienst ?? "").trim()).filter(Boolean),
  ));

  // Jeder Reiter bringt seinen Inhalt mit — der Wisch-Bereich zeigt den
  // aktiven und lässt den Nachbarn hereingleiten (WischReiter).
  const inhalte: Record<PortalTab, ReactNode> = {
    wohnung: (
      <>
        <div className="topbar" style={{ marginBottom: 20 }}>
          <div>
            <div className="topbar-title">Meine Wohnung</div>
            <div className="topbar-sub" style={{ overflowWrap: "anywhere" }}>{kopfzeile}</div>
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
          <>
          <MieterAufgabenListe aufgaben={aufgaben} hrefFuer={hrefFuer} />
          <NotfallKasten notdienste={notdienste} />
          <MitteilungenListe mitteilungen={daten.mitteilungen} nurLesen={vorschau} />
          {wohnungen.map(({ m, p }) => (
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
          ))}
          {wohnungen.map(({ m, p }) => p?.id ? (
            <HausInfosKarte key={`haus-${m.id}`} info={daten.hausInfos[p.id]} titel={wohnungen.length > 1 ? p.bezeichnung ?? "" : ""} />
          ) : null)}
          </>
        )}
      </>
    ),

    anliegen: (
      <>
        <div className="topbar" style={{ marginBottom: 20 }}>
          <div>
            <div className="topbar-title">Anliegen</div>
            <div className="topbar-sub">Schäden melden (geführt, mit Fotos), Fragen stellen — mit Verlauf</div>
          </div>
        </div>
        {wohnungen.length === 0 ? keineWohnung : (
          <>
            <NotfallKasten notdienste={notdienste} />
            <AnfragenVomVermieter anfragen={vermieterAnfragen} nurLesen={vorschau} />
            <AnliegenPortal anliegen={anliegen} dateien={dateien} verlauf={verlauf} nurLesen={vorschau} />
          </>
        )}
      </>
    ),

    zahlungen: (
      <>
        <div className="topbar" style={{ marginBottom: 20 }}>
          <div>
            <div className="topbar-title">Zahlungen</div>
            <div className="topbar-sub">Vom Vermieter bestätigte Miet- &amp; Nebenkostenzahlungen (§ 368 BGB)</div>
          </div>
        </div>
        {wohnungen.length === 0 ? keineWohnung : (
          <>
          {wohnungen.map(({ m, p }) => (
            <MieterKontoTabelle
              key={m.id}
              titel={wohnungen.length > 1 ? `${p?.bezeichnung ?? "Wohnung"}${m.einheit ? ` · ${m.einheit}` : ""}` : ""}
              monate={daten.konto[m.id] ?? []}
              anliegenHref={hrefFuer("anliegen")}
            />
          ))}
          <div className="section">
            <div className="section-header">
              <h3><Banknote size={15} style={{ verticalAlign: "-2px" }} /> Zahlungsübersicht</h3>
              {zahlungen.length > 0 && (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {jahr}: <strong style={{ color: "var(--gold)" }}>{euro(summeJahr)}</strong>
                </span>
              )}
            </div>
            <div className="section-body">
              {zahlungen.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--faint)" }}>
                  Noch keine bestätigten Zahlungen — sobald dein Vermieter deine Miete im
                  Mietkonto verbucht, erscheint sie hier als Nachweis.
                </p>
              ) : (
                <>
                  {zahlungen.map((z) => (
                    <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--muted)", minWidth: 74 }}>{z.buchungsdatum ? datum(z.buchungsdatum) : "–"}</span>
                      <span className={`badge ${z.kategorie === "Miete" ? "badge-green" : "badge-teal"}`}>{z.kategorie ?? "Zahlung"}</span>
                      {z.beschreibung && <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.beschreibung}</span>}
                      <span style={{ fontWeight: 600, color: "var(--green)", marginLeft: "auto" }}>{euro(z.betrag)}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>
                    Diese Übersicht zeigt alle Zahlungen, die dein Vermieter verbucht hat.
                    Eine förmliche Mietquittung (§ 368 BGB) kannst du unter „Dokumente“ anfordern.
                  </p>
                </>
              )}
            </div>
          </div>
          </>
        )}
      </>
    ),

    dokumente: (
      <>
        <div className="topbar" style={{ marginBottom: 20 }}>
          <div>
            <div className="topbar-title">Dokumente</div>
            <div className="topbar-sub">Bescheinigungen &amp; Unterlagen beim Vermieter anfordern</div>
          </div>
        </div>
        {wohnungen.length === 0 ? keineWohnung : (
          <>
            <div className="section">
              <div className="section-header"><h3>Bereitgestellte Dokumente</h3></div>
              <div className="section-body">
                {freigegebeneDocs.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--faint)" }}>
                    Noch keine Dokumente zugestellt — dein Vermieter kann dir hier z. B.
                    Mietvertrag, NK-Abrechnung oder den Energieausweis bereitstellen.
                  </p>
                ) : (
                  freigegebeneDocs.map((d) => (
                    <div key={d.zustellung.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                      <FileText size={14} color="var(--gold)" />
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{d.titel || d.datei_name || "Dokument"}</span>
                      {d.kategorie && <span className="badge badge-teal">{d.kategorie}</span>}
                      <span style={{ color: "var(--muted)", marginLeft: "auto" }} title="Zeitpunkt der Zustellung an dich">
                        {datum(d.zustellung.zugestellt_am)}
                      </span>
                      {d.zustellung.bestaetigung_noetig && (d.zustellung.bestaetigt_am
                        ? <span className="badge badge-green" title="Von dir bestätigt">bestätigt {datum(d.zustellung.bestaetigt_am)}</span>
                        : <ZustellungBestaetigen zustellungId={d.zustellung.id} nurLesen={vorschau} />)}
                      <a href={`/archiv/${d.id}/datei`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Ansehen</a>
                      <a href={`/archiv/${d.id}/datei?download=1`} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Herunterladen</a>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="section">
              <div className="section-header">
                <h3><Receipt size={15} style={{ verticalAlign: "-2px" }} /> Belege (Belegeinsicht)</h3>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>§ 556 Abs. 4 BGB</span>
              </div>
              <div className="section-body">
                {belege.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--faint)" }}>
                    Noch keine Belege freigegeben — dein Vermieter kann dir hier Rechnungen
                    zur Nebenkostenabrechnung zur Einsicht bereitstellen.
                  </p>
                ) : (
                  belege.map((b) => (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                      <Receipt size={14} color="var(--gold)" />
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{b.beschreibung || b.kategorie || b.rechnung_name || "Beleg"}</span>
                      {b.kategorie && <span className="badge badge-teal">{b.kategorie}</span>}
                      <span style={{ color: "var(--muted)" }}>{b.buchungsdatum ? datum(b.buchungsdatum) : ""}</span>
                      <span style={{ fontWeight: 600, marginLeft: "auto" }}>{euro(b.betrag)}</span>
                      {b.rechnung_name && (
                        <a href={`/kosten/${b.id}/rechnung`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Ansehen</a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <DokumenteAnfrage anfragen={dokumentAnfragen} verlauf={verlauf} nurLesen={vorschau} />
          </>
        )}
      </>
    ),
    zaehler: (
      <>
        <div className="topbar" style={{ marginBottom: 20 }}>
          <div>
            <div className="topbar-title">Zählerstände</div>
            <div className="topbar-sub">Strom, Gas, Wasser &amp; Co. direkt an den Vermieter melden</div>
          </div>
        </div>
        {wohnungen.length === 0 ? keineWohnung : (
          <ZaehlerPortal meldungen={zaehlerMeldungen} nurLesen={vorschau} />
        )}
      </>
    ),
  };

  return (
    <div style={{ minHeight: vorschau ? undefined : "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Portal-Topbar mit dem MyImmo-Schriftzug wie in der Vermieter-Sidebar */}
      {/* `flexWrap` ist hier nicht kosmetisch: Ohne Umbruch quetscht die Zeile
          auf schmalen Handys den rechten Block (Theme, Konto, Abmelden)
          zusammen, bis „Abmelden" abgeschnitten ist — die Schaltflaeche, mit
          der ein Mieter seine Sitzung beendet. */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10,
          padding: "12px 22px", borderBottom: "1px solid var(--line)", background: "var(--bg2)",
        }}
      >
        <div className="sidebar-logo" style={{ padding: 0, borderBottom: "none" }}>
          <h1>My<span>Immo</span></h1>
          <p>Mieterportal</p>
        </div>
        {vorschau ? (
          // Attrappen: In der Vorschau wäre „Abmelden" das Konto des VERMIETERS.
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} aria-hidden="true">
            <span className="btn btn-ghost" style={{ fontSize: 12, opacity: .6, pointerEvents: "none" }}>Konto</span>
            <span className="btn btn-ghost" style={{ fontSize: 12, opacity: .6, pointerEvents: "none" }}>Abmelden</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThemeToggle variant="icon" />
            <Link href="/konto" className="btn btn-ghost" style={{ fontSize: 12 }} title="Passwort, Datenexport, Konto löschen">
              Konto
            </Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn btn-ghost" style={{ fontSize: 12 }} data-demo-erlaubt="">Abmelden</button>
            </form>
          </div>
        )}
      </div>

      {/* Glass-Toolbar oben in der Mitte: Bereiche umschalten. In der Vorschau
          nicht sticky — sie säße sonst über der Vermieter-Topbar. */}
      <div className="portal-toolbar" style={vorschau ? { position: "static" } : undefined}>
        <GlassLeiste aktiv={tab} label="Portal-Bereiche">
          {PORTAL_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.key} href={hrefFuer(t.key)} className={`glass-item ${tab === t.key ? "active" : ""}`}>
                <Icon size={14} /> {t.label}
              </Link>
            );
          })}
        </GlassLeiste>
      </div>

      {/* Wischen über den Inhalt wechselt den Reiter (01.10.2026). */}
      <main className={vorschau ? undefined : "fade-up"} style={{ maxWidth: 760, margin: "0 auto", padding: "8px 20px 40px" }}>
        <WischReiter
          aktuell={PORTAL_TABS.findIndex((t) => t.key === tab)}
          reiter={PORTAL_TABS.map((t) => ({ href: hrefFuer(t.key), label: t.label, inhalt: inhalte[t.key] }))}
        />
      </main>
    </div>
  );
}
