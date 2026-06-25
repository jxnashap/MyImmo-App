import Link from "next/link";
import BackLink from "@/components/BackLink";

export const metadata = { title: "Auftragsverarbeitungsvertrag (AVV) — MyImmo" };

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 8 }}>{children}</h2>
);

// Entwurf eines AVV nach Art. 28 DSGVO zwischen dem Nutzer (Vermieter = Verantwortlicher)
// und dem Betreiber von MyImmo (Auftragsverarbeiter). Vor Produktivgang anwaltlich prüfen.
export default function AvvPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", lineHeight: 1.6 }}>
      <BackLink />
      <h1 style={{ fontSize: 28, margin: "16px 0 8px" }}>Auftragsverarbeitungsvertrag (AVV)</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Vereinbarung nach Art. 28 DSGVO zwischen Ihnen als Verantwortlichem und dem Betreiber
        von MyImmo als Auftragsverarbeiter.
      </p>

      <div
        style={{
          background: "var(--bg3)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "12px 16px",
          fontSize: 13,
          color: "var(--muted)",
          marginBottom: 24,
        }}
      >
        Hinweis für den Betreiber: Entwurf. Bitte [Platzhalter] ausfüllen und anwaltlich prüfen
        lassen, bevor er produktiv akzeptiert wird.
      </div>

      <H2>1. Gegenstand & Rollen</H2>
      <p>
        Sie (der „Verantwortliche") nutzen MyImmo, um personenbezogene Daten Ihrer Mieter zu
        verarbeiten. Der Betreiber [Name/Firma] („Auftragsverarbeiter") verarbeitet diese Daten
        ausschließlich in Ihrem Auftrag und nach Ihren Weisungen.
      </p>

      <H2>2. Art, Umfang & Zweck</H2>
      <p>
        Verarbeitet werden Stammdaten, Kontaktdaten, Mietverhältnis- und Abrechnungsdaten Ihrer
        Mieter zum Zweck der Immobilien- und Nebenkostenverwaltung über die MyImmo-Anwendung.
      </p>

      <H2>3. Pflichten des Auftragsverarbeiters</H2>
      <ul style={{ paddingLeft: 20 }}>
        <li>Verarbeitung nur auf dokumentierte Weisung des Verantwortlichen.</li>
        <li>Vertraulichkeit der mit der Verarbeitung befassten Personen.</li>
        <li>Technische und organisatorische Maßnahmen nach Art. 32 (siehe Datenschutzerklärung).</li>
        <li>Unterstützung bei Betroffenenrechten und Meldepflichten (Art. 33/34).</li>
        <li>Löschung oder Rückgabe der Daten nach Beendigung.</li>
        <li>Nachweis der Einhaltung / Ermöglichung von Überprüfungen.</li>
      </ul>

      <H2>4. Unterauftragsverarbeiter</H2>
      <p>
        Der Verantwortliche genehmigt den Einsatz folgender Unterauftragsverarbeiter:
        Supabase (Hosting/DB, EU), Vercel (Hosting), Anthropic (optionale KI-Texterkennung),
        Google (optionaler Login). Über Änderungen wird der Verantwortliche informiert.
      </p>

      <H2>5. Ort der Verarbeitung</H2>
      <p>
        Die Datenhaltung erfolgt in der EU (Supabase-Region Frankfurt). Bei optionalen Diensten
        mit Verarbeitung außerhalb der EU werden geeignete Garantien (z. B. SCC) zugrunde gelegt.
      </p>

      <H2>6. Technische & organisatorische Maßnahmen</H2>
      <p>
        Verschlüsselung in transit (TLS) und at rest, mandantengetrennte Zugriffskontrolle
        (Row Level Security), Authentifizierung und Backups. Details siehe{" "}
        <Link href="/datenschutz" style={{ color: "var(--gold)" }}>Datenschutzerklärung</Link>.
      </p>

      <H2>7. Dauer & Beendigung</H2>
      <p>
        Dieser Vertrag gilt für die Dauer der Nutzung von MyImmo. Bei Kontolöschung werden alle
        Daten gemäß Löschkonzept entfernt.
      </p>

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 40 }}>
        Mit der Registrierung und Zustimmung beim Onboarding akzeptieren Sie diesen AVV.
      </p>
    </div>
  );
}
