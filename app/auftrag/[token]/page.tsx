// ÖFFENTLICHE Auftragsseite für Handwerksfirmen (kein Login): der Hausmeister
// schickt diesen Link per E-Mail an die Firma — mit Auftragsdetails und dem
// Mieter-Kontakt zur direkten Terminabsprache (nur wenn der Vermieter den
// Mieter ausdrücklich am Auftrag ausgewählt hat). Token-Prüfung in der DB.
import type { Metadata } from "next";
import { Wrench, Lock, Phone, Mail, CalendarDays, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Auftragsanfrage – MyImmo",
  robots: { index: false, follow: false },
};

type Info = {
  titel: string;
  beschreibung: string | null;
  objekt: string | null;
  vermieter: string | null;
  termin: string | null;
  mieter_name: string | null;
  mieter_telefon: string | null;
  mieter_email: string | null;
};

const deDate = (s: string) =>
  new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

function Kopf() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "2px solid var(--gold)", paddingBottom: 14, marginBottom: 24 }}>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 26 }}>My<em style={{ color: "var(--gold)" }}>Immo</em></span>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--muted)" }}>PRIVATES IMMOBILIEN-MANAGEMENT</div>
      </div>
      <span className="badge badge-gold">Auftragsanfrage</span>
    </div>
  );
}

export default async function AuftragPublicSeite({ params }: { params: { token: string } }) {
  const supabase = createClient();
  let info: Info | null = null;
  if (/^[0-9a-f-]{36}$/i.test(params.token)) {
    const { data } = await supabase.rpc("auftrag_public_info", { p_token: params.token });
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
              Diese Auftragsanfrage wurde abgeschlossen oder zurückgezogen.
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
          <h3><Wrench size={15} style={{ verticalAlign: "-2px" }} /> {info.titel}</h3>
        </div>
        <div className="section-body" style={{ fontSize: 13, display: "grid", gap: 8 }}>
          {info.objekt && <div><span style={{ color: "var(--muted)" }}>Objekt:</span> <strong>{info.objekt}</strong></div>}
          {info.beschreibung && <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--text)" }}>{info.beschreibung}</p>}
          {info.termin && (
            <div style={{ color: "var(--muted)" }}>
              <CalendarDays size={13} style={{ verticalAlign: "-2px" }} /> Wunschtermin: <strong style={{ color: "var(--text)" }}>{deDate(info.termin)}</strong>
            </div>
          )}
          {info.vermieter && <div style={{ fontSize: 12, color: "var(--muted)" }}>Auftraggeber: {info.vermieter}</div>}
        </div>
      </div>

      {(info.mieter_name || info.mieter_telefon) && (
        <div className="section">
          <div className="section-header"><h3><UserRound size={15} style={{ verticalAlign: "-2px" }} /> Terminabsprache</h3></div>
          <div className="section-body" style={{ fontSize: 13, display: "grid", gap: 8 }}>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Bitte stimmen Sie den Termin direkt mit der Mieterin / dem Mieter ab:
            </p>
            {info.mieter_name && <div style={{ fontWeight: 600 }}>{info.mieter_name}</div>}
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {info.mieter_telefon && (
                <a href={`tel:${info.mieter_telefon.replace(/\s/g, "")}`} className="btn btn-gold" style={{ fontSize: 13, textDecoration: "none" }}>
                  <Phone size={13} style={{ verticalAlign: "-2px" }} /> {info.mieter_telefon}
                </a>
              )}
              {info.mieter_email && (
                <a href={`mailto:${info.mieter_email}`} className="btn btn-ghost" style={{ fontSize: 13, textDecoration: "none" }}>
                  <Mail size={13} style={{ verticalAlign: "-2px" }} /> {info.mieter_email}
                </a>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "var(--faint)" }}>
              Die Kontaktdaten wurden vom Vermieter ausschließlich zur Terminabsprache für
              diesen Auftrag freigegeben. Bitte nicht anderweitig verwenden (DSGVO).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
