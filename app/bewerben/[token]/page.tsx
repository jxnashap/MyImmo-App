// ÖFFENTLICHE Bewerbungs-Seite für Mietinteressenten (kein Login):
// Objekt-Infos + Selbstauskunft-Formular. Datenzugriff ausschließlich
// über SECURITY-DEFINER-RPCs (Token-Prüfung in der DB).
import type { Metadata } from "next";
import { Home, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BewerbungForm from "@/components/BewerbungForm";

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
      <div className="section" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <h3><Home size={15} style={{ verticalAlign: "-2px" }} /> {info.titel || info.objekt}</h3>
        </div>
        <div className="section-body" style={{ fontSize: 12, color: "var(--muted)", display: "flex", flexWrap: "wrap", gap: "6px 22px" }}>
          {info.adresse && <span>{info.adresse}</span>}
          {info.zimmer != null && <span>{info.zimmer} Zimmer</span>}
          {info.flaeche != null && <span>{info.flaeche} m²</span>}
        </div>
      </div>
      <BewerbungForm token={params.token} />
    </div>
  );
}
