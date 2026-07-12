// ÖFFENTLICHE Freigabe-Seite für die Bank (kein Login): Objekt-Kennblatt,
// Wunsch-Konditionen, freigegebene Dokumente + Rückmeldungs-Formular.
// Datenzugriff ausschließlich über die SECURITY-DEFINER-RPC (Token-Prüfung).
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import BankRueckmeldungForm from "@/components/BankRueckmeldungForm";
import { BELEIHUNG_CHECKLISTE } from "@/lib/beleihung";
import { Lock, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finanzierungsunterlagen – MyImmo",
  robots: { index: false, follow: false },
};

type Info = {
  objekt: {
    bezeichnung: string; adresse: string | null; typ: string | null; baujahr: number | null;
    flaeche: number | null; zimmer: number | null; energieklasse: string | null;
    kaufpreis: number | null; wert: number | null; miete: number | null;
  };
  miete_mo: number;
  restschuld: number;
  absender: string | null;
  angaben: Record<string, string> | null;
  ablauf: string;
  dokumente: { item_key: string; datei_name: string; datei_type: string | null; datei_size: number | null }[];
};

const euro = (n: number | null | undefined) =>
  n == null ? "–" : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n)} €`;

const ZWECK: Record<string, string> = {
  kauf: "Kauf", modernisierung: "Modernisierung", umschuldung: "Umschuldung", kapital: "Kapitalbeschaffung",
};

function Kopf() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "2px solid var(--gold)", paddingBottom: 14, marginBottom: 24 }}>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 26 }}>My<em style={{ color: "var(--gold)" }}>Immo</em></span>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--muted)" }}>PRIVATES IMMOBILIEN-MANAGEMENT</div>
      </div>
      <span className="badge badge-gold">Vertrauliche Finanzierungsunterlagen</span>
    </div>
  );
}

export default async function BankFreigabeSeite({ params }: { params: { token: string } }) {
  const supabase = createClient();
  let info: Info | null = null;
  if (/^[0-9a-f-]{36}$/i.test(params.token)) {
    const { data } = await supabase.rpc("beleihung_public_info", { p_token: params.token });
    info = (data as Info | null) ?? null;
  }

  if (!info) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: 24 }}>
        <Kopf />
        <div className="section" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ marginBottom: 10 }}><Lock size={30} color="var(--muted)" /></div>
          <h1 style={{ fontSize: 19, marginBottom: 8 }}>Link abgelaufen oder ungültig</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            Diese Freigabe wurde widerrufen oder ist abgelaufen. Bitte fordern Sie beim
            Eigentümer einen neuen Link an.
          </p>
        </div>
      </div>
    );
  }

  const o = info.objekt;
  const a = info.angaben ?? {};
  const labelVon = new Map(BELEIHUNG_CHECKLISTE.map((i) => [i.key, i.label]));
  const mieteJahr = info.miete_mo * 12;
  const rendite = o.kaufpreis ? ((mieteJahr / o.kaufpreis) * 100).toFixed(2).replace(".", ",") + " %" : "–";
  const auslauf = o.wert ? ((info.restschuld / o.wert) * 100).toFixed(1).replace(".", ",") + " %" : "–";

  const kv = (l: string, v: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <span style={{ color: "var(--muted)" }}>{l}</span><strong>{v}</strong>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "40px auto", padding: "0 20px 60px" }}>
      <Kopf />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Finanzierungsunterlagen – {o.bezeichnung}</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Bereitgestellt von {info.absender || "dem Eigentümer"} über MyImmo · Link gültig bis {new Date(info.ablauf).toLocaleDateString("de-DE")}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 18 }}>
        <div className="section" style={{ margin: 0 }}>
          <div className="section-header"><h3>Objekt</h3></div>
          <div style={{ padding: "8px 16px 14px" }}>
            {kv("Adresse", o.adresse || "–")}
            {kv("Typ", o.typ || "–")}
            {kv("Baujahr", o.baujahr ? String(o.baujahr) : "–")}
            {kv("Wohnfläche", o.flaeche ? `${o.flaeche} m²` : "–")}
            {kv("Zimmer", o.zimmer ? String(o.zimmer) : "–")}
            {kv("Energieklasse", o.energieklasse || "–")}
          </div>
        </div>
        <div className="section" style={{ margin: 0 }}>
          <div className="section-header"><h3>Kennzahlen</h3></div>
          <div style={{ padding: "8px 16px 14px" }}>
            {kv("Kaufpreis", euro(o.kaufpreis))}
            {kv("Aktueller Wert", euro(o.wert))}
            {kv("Kaltmiete / Monat", euro(info.miete_mo || o.miete))}
            {kv("Bruttorendite", rendite)}
            {kv("Restschuld", euro(info.restschuld))}
            {kv("Beleihungsauslauf", auslauf)}
          </div>
        </div>
      </div>

      {Object.values(a).some(Boolean) && (
        <div className="section" style={{ marginBottom: 18 }}>
          <div className="section-header"><h3>Finanzierungswunsch</h3></div>
          <div style={{ padding: "8px 16px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", columnGap: 28 }}>
            {a.darlehen && kv("Darlehenshöhe", euro(Number(a.darlehen) || null))}
            {a.zweck && kv("Verwendungszweck", ZWECK[a.zweck] || a.zweck)}
            {a.zinsbindung && kv("Zinsbindung", `${a.zinsbindung} Jahre`)}
            {a.tilgung && kv("Anfängliche Tilgung", `${a.tilgung} %`)}
            {a.wunschrate && kv("Wunschrate", `${euro(Number(a.wunschrate) || null)} / Monat`)}
            {a.eigenkapital && kv("Eigenkapital", euro(Number(a.eigenkapital) || null))}
            {a.sondertilgung && kv("Sondertilgung", a.sondertilgung)}
          </div>
        </div>
      )}

      <div className="section" style={{ marginBottom: 18 }}>
        <div className="section-header"><h3>Freigegebene Dokumente ({info.dokumente.length})</h3></div>
        {info.dokumente.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>Keine Dokumente freigegeben.</div>
        )}
        {info.dokumente.map((d) => (
          <div key={d.item_key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <FileText size={17} style={{ flexShrink: 0 }} />
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{labelVon.get(d.item_key) || d.item_key}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.datei_name}</div>
            </div>
            <a className="btn btn-ghost" style={{ fontSize: 11.5 }} href={`/beleihung/${params.token}/datei/${d.item_key}`} target="_blank" rel="noopener noreferrer">Ansehen</a>
            <a className="btn btn-ghost" style={{ fontSize: 11.5 }} href={`/beleihung/${params.token}/datei/${d.item_key}?download=1`}>Download</a>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-header"><h3>Rückmeldung an den Eigentümer</h3></div>
        <BankRueckmeldungForm token={params.token} />
      </div>

      <p style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 22, lineHeight: 1.6 }}>
        Diese Seite ist eine zeitlich begrenzte, private Freigabe. Die Inhalte sind vertraulich zu behandeln
        und nur für die Finanzierungsprüfung bestimmt. Erstellt mit MyImmo.
      </p>
    </div>
  );
}
