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

/** Objekt-Steckbrief — die Eckdaten der Anzeige, geordnet wie im Inserat:
    große Kennzahlen-Kacheln (Kaltmiete mit €/m², Zimmer, Fläche, Warmmiete),
    darunter die Blöcke „Kosten" und „Objektdaten", Ausstattung, Beschreibung. */
function Steckbrief({ info }: { info: Info }) {
  const a = info.anzeige ?? {};
  const zimmer = a.zimmer ?? info.zimmer;
  const flaeche = a.flaeche ?? info.flaeche;
  const warm = a.warmmiete ?? (a.kaltmiete != null && a.nebenkosten != null ? a.kaltmiete + a.nebenkosten : null);
  const proQm = a.kaltmiete != null && flaeche ? a.kaltmiete / flaeche : null;

  const kacheln: { label: string; wert: string | null; sub?: string | null }[] = [
    { label: "Kaltmiete", wert: euroText(a.kaltmiete), sub: proQm != null ? `${proQm.toLocaleString("de-DE", { maximumFractionDigits: 2 })} €/m²` : null },
    { label: "Zimmer", wert: zimmer != null ? String(zimmer) : null },
    { label: "Wohnfläche", wert: flaeche != null ? `${flaeche} m²` : null },
    { label: "Warmmiete", wert: euroText(warm), sub: a.heizkosten_enthalten ? "inkl. Heizkosten" : null },
  ];

  const kosten: [string, string | null][] = [
    ["Nebenkosten", a.nebenkosten != null ? `+ ${euroText(a.nebenkosten)}` : null],
    ["Heizkosten", a.nebenkosten != null ? (a.heizkosten_enthalten ? "in Nebenkosten enthalten" : "nicht enthalten") : null],
    ["Kaution", euroText(a.kaution)],
  ];
  const objekt: [string, string | null][] = [
    ["Schlafzimmer", a.schlafzimmer != null ? String(a.schlafzimmer) : null],
    ["Badezimmer", a.badezimmer != null ? String(a.badezimmer) : null],
    ["Etage", a.etage ?? null],
    ["Bezugsfrei ab", datumText(a.bezugsfrei_ab)],
    ["Heizungsart", a.heizungsart ?? null],
    ["Energieausweis", a.energieausweis ?? null],
  ];
  const ausstattung = a.ausstattung ?? [];

  const Block = ({ titel, zeilen }: { titel: string; zeilen: [string, string | null][] }) => {
    const da = zeilen.filter(([, v]) => v);
    if (da.length === 0) return null;
    return (
      <div style={{ flex: "1 1 240px", minWidth: 220 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gold)", fontWeight: 600, marginBottom: 6 }}>{titel}</div>
        <div style={{ display: "grid", gap: 0 }}>
          {da.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: "1px solid var(--line)", fontSize: 12.5 }}>
              <span style={{ color: "var(--muted)" }}>{k}</span>
              <span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="section" style={{ marginBottom: 16 }}>
      <div className="section-header" style={{ display: "block" }}>
        <h3><Home size={15} style={{ verticalAlign: "-2px" }} /> {info.titel || info.objekt}</h3>
        {info.adresse && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{info.adresse}</div>}
      </div>
      <div className="section-body" style={{ display: "grid", gap: 16 }}>
        {kacheln.some((k) => k.wert) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {kacheln.filter((k) => k.wert).map((k) => (
              <div key={k.label} style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 3, letterSpacing: "-0.01em" }}>
                  {k.label === "Kaltmiete" && <BadgeEuro size={14} color="var(--gold)" style={{ verticalAlign: "-2px", marginRight: 5 }} />}
                  {k.wert}
                </div>
                {k.sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{k.sub}</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 32px" }}>
          <Block titel="Kosten" zeilen={kosten} />
          <Block titel="Objektdaten" zeilen={objekt} />
        </div>

        {ausstattung.length > 0 && (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gold)", fontWeight: 600, marginBottom: 6 }}>Ausstattung</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ausstattung.map((t) => <span key={t} className="badge badge-gold">{t}</span>)}
            </div>
          </div>
        )}

        {a.beschreibung && (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gold)", fontWeight: 600, marginBottom: 6 }}>Objektbeschreibung</div>
            <p style={{ fontSize: 12.5, color: "var(--text)", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{a.beschreibung}</p>
          </div>
        )}
        {a.lage && (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gold)", fontWeight: 600, marginBottom: 6 }}>Lage</div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{a.lage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function BewerbenSeite(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
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
