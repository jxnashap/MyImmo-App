// ÖFFENTLICHE Angebotsanfrage für Handwerksfirmen (02.10.2026, kein Login): Der Vermieter
// schickt diesen Link an Firmen aus seinem Verzeichnis; die Firma liest, was gemacht werden
// soll, und antwortet mit Betrag, frühestem Termin und Text. Token-Prüfung in der Datenbank
// (`angebot_public_info`). Name und Kontakt des Mieters stehen hier bewusst NICHT.
import type { Metadata } from "next";
import { FileSignature, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import OeffentlicheFusszeile from "@/components/OeffentlicheFusszeile";
import AngebotFormular from "@/components/AngebotFormular";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Angebotsanfrage – MyImmo",
  robots: { index: false, follow: false },
};

type Info = {
  titel: string;
  beschreibung: string | null;
  objekt: string | null;
  absender: string | null;
  gueltig_bis: string;
  schon_abgegeben: boolean;
};

const deDate = (s: string) =>
  new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Berlin" });

function Kopf() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "2px solid var(--gold)", paddingBottom: 14, marginBottom: 24 }}>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 26 }}>My<em style={{ color: "var(--gold)" }}>Immo</em></span>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--muted)" }}>PRIVATES IMMOBILIEN-MANAGEMENT</div>
      </div>
      <span className="badge badge-gold">Angebotsanfrage</span>
    </div>
  );
}

export default async function AngebotPublicSeite(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const supabase = await createClient();
  let info: Info | null = null;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const { data } = await supabase.rpc("angebot_public_info", { p_token: token });
    info = (data as Info | null) ?? null;
  }

  if (!info) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: 24 }}>
        <Kopf />
        <div className="section">
          <div className="section-body" style={{ textAlign: "center", padding: "40px 20px" }}>
            <Lock size={36} color="var(--faint)" style={{ margin: "0 auto" }} />
            <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>Link nicht mehr gültig</p>
            <p style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
              Diese Anfrage wurde vergeben, zurückgezogen — oder der Link ist abgelaufen
              (Angebotsanfragen gelten 30 Tage). Bitte wenden Sie sich an den Auftraggeber.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px 60px" }}>
      <Kopf />
      <div className="section" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <h3><FileSignature size={15} style={{ verticalAlign: "-2px" }} /> {info.titel}</h3>
        </div>
        <div className="section-body" style={{ fontSize: 13, display: "grid", gap: 8 }}>
          {info.objekt && <div><span style={{ color: "var(--muted)" }}>Objekt:</span> <strong>{info.objekt}</strong></div>}
          {info.beschreibung && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{info.beschreibung}</p>}
          {info.absender && <div style={{ fontSize: 12, color: "var(--muted)" }}>Auftraggeber: {info.absender}</div>}
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Antwort möglich bis {deDate(info.gueltig_bis)}.</div>
        </div>
      </div>

      <AngebotFormular token={token} schonAbgegeben={info.schon_abgegeben} />

      <OeffentlicheFusszeile
        verantwortlicher={info.absender}
        kontakt={null}
        zweck="Ihre Angaben gehen ausschließlich an den Auftraggeber dieser Anfrage. MyImmo vermittelt keine Aufträge und erstellt keine Kostenvoranschläge."
      />
    </div>
  );
}
