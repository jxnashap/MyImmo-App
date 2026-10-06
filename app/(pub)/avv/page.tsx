import Link from "next/link";
import BackLink from "@/components/BackLink";
import { AVV_BLOECKE, AVV_HINWEIS, AVV_STAND, type AvvBlock } from "@/lib/avvInhalt";

export const metadata = {
  title: "Auftragsverarbeitungsvertrag (AVV) — MyImmo",
  robots: { index: false, follow: false },
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 8 }}>{children}</h2>
);

const KLEIN = { fontSize: 13.5, color: "var(--muted)" } as const;

/** `**fett**` → <strong>. Mehr Auszeichnung kennt der Vertragstext nicht. */
function Text({ s }: { s: string }) {
  return (
    <>
      {s.split(/\*\*(.+?)\*\*/g).map((teil, i) => (i % 2 ? <strong key={i}>{teil}</strong> : teil))}
    </>
  );
}

function Block({ b }: { b: AvvBlock }) {
  if ("h" in b) return <H2>{b.h}</H2>;
  if ("p" in b) return <p><Text s={b.p} /></p>;
  if ("b" in b) return <p><strong>{b.b}</strong></p>;
  if ("note" in b) return <p style={KLEIN}><Text s={b.note} /></p>;
  if ("kv" in b)
    return (
      <p>
        {b.kv.map(([k, v], i) => (
          <span key={k}>
            {i > 0 && <br />}
            <strong>{k}</strong> {v}
          </span>
        ))}
      </p>
    );
  if ("ul" in b)
    return (
      <ul style={{ paddingLeft: 20 }}>
        {b.ul.map((t) => (
          <li key={t}><Text s={t} /></li>
        ))}
      </ul>
    );
  return null; // Unterschriftsfelder gibt es nur im PDF.
}

// AVV nach Art. 28 Abs. 3 DSGVO zwischen Nutzer (Vermieter = Verantwortlicher) und Betreiber
// (Auftragsverarbeiter). Der Text steht in lib/avvInhalt.ts — EINE Quelle für diese Seite und
// das PDF (scripts/gen-avv-pdf.mjs). Anwaltlich prüfen lassen.
export default function AvvPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", lineHeight: 1.65 }}>
      <BackLink />
      <h1 style={{ fontSize: 28, margin: "16px 0 8px" }}>Auftragsverarbeitungsvertrag (AVV)</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Stand: {AVV_STAND} · Vereinbarung nach Art. 28 Abs. 3 DSGVO zwischen Ihnen als
        Verantwortlichem und dem Betreiber von MyImmo als Auftragsverarbeiter. Sie wird mit
        der Registrierung bzw. der weiteren Nutzung der App Vertragsbestandteil.
      </p>

      <div style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>
        {AVV_HINWEIS}
      </div>

      {AVV_BLOECKE.map((b, i) => (
        <Block key={i} b={b} />
      ))}

      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 24 }}>
        Ergänzend gilt die{" "}
        <Link href="/datenschutz" style={{ color: "var(--gold)" }}>Datenschutzerklärung</Link>.
      </p>
    </div>
  );
}
