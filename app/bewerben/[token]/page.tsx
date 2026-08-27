// ÖFFENTLICHE Bewerbungs-Seite für Mietinteressenten (kein Login):
// Objekt-Steckbrief (Anzeige-Eckdaten des Vermieters) + Selbstauskunft-Formular
// mit optionalen Dokument-Uploads. Datenzugriff ausschließlich über
// SECURITY-DEFINER-RPCs (Token-Prüfung in der DB).
import type { Metadata } from "next";
import { BadgeEuro, Home, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BewerbungForm from "@/components/BewerbungForm";
import OeffentlicheFusszeile from "@/components/OeffentlicheFusszeile";
import type { LinkAnzeige } from "@/lib/bewerbungsDokumente";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wohnungsbewerbung – MyImmo",
  robots: { index: false, follow: false },
};

type Info = {
  titel: string | null;
  objekt: string;
  adresse: string | null;
  flaeche: number | null;
  zimmer: number | null;
  anzeige: LinkAnzeige | null;
  dokumente_gewuenscht: string[] | null;
  // Verantwortlicher nach Art. 13 DSGVO = der Vermieter (siehe RPC).
  verantwortlicher: string | null;
  verantwortlicher_email: string | null;
  verantwortlicher_telefon: string | null;
};

function Kopf() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "2px solid var(--gold)", paddingBottom: 14, marginBottom: 24 }}>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 26 }}>My<em style={{ color: "var(--gold)" }}>Immo</em></span>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--muted)" }}>PRIVATES IMMOBILIEN-MANAGEMENT</div>
      </div>
      <span className="badge badge-gold">Wohnungsbewerbung</span>
    </div>
  );
}

const euroText = (n: number | null | undefined) =>
  n == null ? null : `${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })} €`;
const datumText = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-DE");
};

/** Objekt-Steckbrief — die Eckdaten der Anzeige, wie sie der Vermieter am Link gepflegt hat. */
function Steckbrief({ info }: { info: Info }) {
  const a = info.anzeige ?? {};
  const kosten: [string, string | null][] = [
    ["Kaltmiete", euroText(a.kaltmiete)],
    ["Nebenkosten", a.nebenkosten != null ? `+ ${euroText(a.nebenkosten)}${a.heizkosten_enthalten ? " (inkl. Heizkosten)" : ""}` : null],
    ["Warmmiete", euroText(a.warmmiete ?? (a.kaltmiete != null && a.nebenkosten != null ? a.kaltmiete + a.nebenkosten : null))],
    ["Kaution", euroText(a.kaution)],
  ];
  const fakten: [string, string | null][] = [
    ["Zimmer", (a.zimmer ?? info.zimmer)?.toString() ?? null],
    ["Wohnfläche", (a.flaeche ?? info.flaeche) != null ? `${a.flaeche ?? info.flaeche} m²` : null],
    ["Schlafzimmer", a.schlafzimmer?.toString() ?? null],
    ["Badezimmer", a.badezimmer?.toString() ?? null],
    ["Etage", a.etage ?? null],
    ["Bezugsfrei ab", datumText(a.bezugsfrei_ab)],
    ["Heizungsart", a.heizungsart ?? null],
    ["Energieausweis", a.energieausweis ?? null],
  ];
  const kostenDa = kosten.some(([, v]) => v);
  const faktenDa = fakten.some(([, v]) => v);
  const ausstattung = a.ausstattung ?? [];

  return (
    <div className="section" style={{ marginBottom: 16 }}>
      <div className="section-header">
        <h3><Home size={15} style={{ verticalAlign: "-2px" }} /> {info.titel || info.objekt}</h3>
      </div>
      <div className="section-body" style={{ display: "grid", gap: 14 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", flexWrap: "wrap", gap: "6px 22px" }}>
          {info.adresse && <span>{info.adresse}</span>}
        </div>

        {kostenDa && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
            {kosten.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>{k}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
                  {k === "Kaltmiete" && <BadgeEuro size={13} color="var(--gold)" style={{ verticalAlign: "-2px", marginRight: 4 }} />}
                  {v}
                </div>
              </div>
            ))}
          </div>
        )}

        {faktenDa && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "6px 18px", fontSize: 12.5 }}>
            {fakten.filter(([, v]) => v).map(([k, v]) => (
              <span key={k}><span style={{ color: "var(--muted)" }}>{k}:</span> <strong>{v}</strong></span>
            ))}
          </div>
        )}

        {ausstattung.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ausstattung.map((t) => <span key={t} className="badge badge-gold">{t}</span>)}
          </div>
        )}

        {a.beschreibung && (
          <p style={{ fontSize: 12.5, color: "var(--text)", whiteSpace: "pre-wrap", margin: 0 }}>{a.beschreibung}</p>
        )}
        {a.lage && (
          <p style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "pre-wrap", margin: 0 }}>
            <strong style={{ color: "var(--text)" }}>Lage:</strong> {a.lage}
          </p>
        )}
      </div>
    </div>
  );
}

export default async function BewerbenSeite({ params }: { params: { token: string } }) {
  const supabase = createClient();
  let info: Info | null = null;
  if (/^[0-9a-f-]{36}$/i.test(params.token)) {
    const { data } = await supabase.rpc("bewerber_link_info", { p_token: params.token });
    info = (data as Info | null) ?? null;
  }

  if (!info) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: 24 }}>
        <Kopf />
        <div className="section">
          <div className="section-body" style={{ textAlign: "center", padding: "40px 20px" }}>
            <Lock size={36} color="var(--faint)" />
            <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>Link nicht mehr gültig</p>
            <p style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
              Dieser Bewerbungs-Link wurde deaktiviert oder existiert nicht.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 20px 60px" }}>
      <Kopf />
      <Steckbrief info={info} />
      <BewerbungForm token={params.token} gewuenschteSlots={info.dokumente_gewuenscht ?? []} />
      <OeffentlicheFusszeile
        verantwortlicher={info.verantwortlicher}
        kontakt={info.verantwortlicher_email ?? info.verantwortlicher_telefon}
        zweck="Ihre Angaben werden zur Prüfung Ihrer Mietanfrage für dieses Objekt verarbeitet."
      />
    </div>
  );
}
