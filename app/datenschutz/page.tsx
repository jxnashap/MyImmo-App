import Link from "next/link";

export const metadata = { title: "Datenschutzerklärung — MyImmo" };

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 8 }}>{children}</h2>
);

// Entwurf einer Datenschutzerklärung. Inhalte in [eckigen Klammern] ausfüllen.
// Vor Produktivgang anwaltlich/DSB prüfen lassen.
export default function DatenschutzPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", lineHeight: 1.6 }}>
      <Link href="/login" style={{ color: "var(--gold)", fontSize: 14 }}>← Zurück</Link>
      <h1 style={{ fontSize: 28, margin: "16px 0 8px" }}>Datenschutzerklärung</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Stand: [Datum]. Diese Erklärung beschreibt die Verarbeitung personenbezogener Daten
        bei Nutzung der Anwendung MyImmo.
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
        Hinweis für den Betreiber: Dies ist ein Entwurf. Bitte [Platzhalter] ausfüllen und vor
        dem Launch rechtlich prüfen lassen.
      </div>

      <H2>1. Verantwortlicher</H2>
      <p>
        Verantwortlich im Sinne der DSGVO ist:<br />
        [Name / Firma], [Anschrift], [E-Mail]. Siehe auch{" "}
        <Link href="/impressum" style={{ color: "var(--gold)" }}>Impressum</Link>.
      </p>

      <H2>2. Welche Daten wir verarbeiten</H2>
      <p>Bei der Nutzung von MyImmo werden insbesondere verarbeitet:</p>
      <ul style={{ paddingLeft: 20 }}>
        <li><strong>Kontodaten:</strong> E-Mail-Adresse, Passwort (verschlüsselt), ggf. Google-Konto-Kennung bei Login mit Google.</li>
        <li><strong>Vermieter-/Anbieterdaten:</strong> Name/Firma, Anschrift, E-Mail, Telefon, Bankverbindung (IBAN).</li>
        <li><strong>Objekt- und Finanzdaten:</strong> Immobilien, Einnahmen, Kosten, Kredite, Verbrauchswerte, Termine.</li>
        <li><strong>Mieterdaten (Daten Dritter):</strong> Name, Kontaktdaten, Anschrift, Mietverhältnis, Miet- und Kautionsdaten, von Ihnen erfasste Notizen.</li>
        <li><strong>Dokumente:</strong> hochgeladene Belege und erzeugte Dokumente.</li>
      </ul>

      <H2>3. Zwecke und Rechtsgrundlagen</H2>
      <p>
        Die Verarbeitung erfolgt zur Bereitstellung der Funktionen (Vertrag bzw.
        vorvertragliche Maßnahmen, Art. 6 Abs. 1 lit. b DSGVO) sowie zur Erfüllung Ihrer
        eigenen rechtlichen Pflichten als Vermieter (Art. 6 Abs. 1 lit. c und f DSGVO).
      </p>

      <H2>4. Auftragsverarbeitung / eingesetzte Dienste</H2>
      <p>Zur Bereitstellung setzen wir folgende Dienstleister ein (Auftragsverarbeiter):</p>
      <ul style={{ paddingLeft: 20 }}>
        <li><strong>Supabase</strong> (Datenbank/Authentifizierung, Hosting in der EU, Region eu-central-1).</li>
        <li><strong>Vercel</strong> (Hosting/Auslieferung der Anwendung).</li>
        <li><strong>Anthropic</strong> (KI-gestützte Texterkennung beim optionalen Beleg-/Objekt-Import).</li>
        <li><strong>Google</strong> (nur bei optionalem „Login mit Google").</li>
      </ul>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        [Mit jedem Auftragsverarbeiter ist ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO
        abzuschließen.]
      </p>

      <H2>5. Verantwortung für Mieterdaten</H2>
      <p>
        Soweit Sie als Nutzer personenbezogene Daten Ihrer Mieter erfassen, sind Sie
        datenschutzrechtlich verantwortlich. MyImmo verarbeitet diese Daten in Ihrem Auftrag.
        Erfassen Sie keine besonderen Kategorien personenbezogener Daten (Art. 9 DSGVO).
      </p>

      <H2>6. Speicherdauer</H2>
      <p>
        Daten werden gespeichert, solange Ihr Konto besteht. Bei Löschung des Kontos werden
        alle zugehörigen Daten unwiderruflich entfernt. Gesetzliche Aufbewahrungspflichten
        bleiben unberührt.
      </p>

      <H2>7. Ihre Rechte</H2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung,
        Datenübertragbarkeit und Widerspruch. Einen Datenexport und die vollständige Löschung
        Ihres Kontos können Sie jederzeit selbst unter „Einstellungen" auslösen. Zudem besteht
        ein Beschwerderecht bei einer Aufsichtsbehörde.
      </p>

      <H2>8. Datensicherheit</H2>
      <p>
        Die Daten werden bei unserem Hosting-Anbieter verschlüsselt gespeichert
        (Verschlüsselung at rest) und ausschließlich über verschlüsselte Verbindungen (TLS)
        übertragen. Der Zugriff ist durch Zeilen-Sicherheit (RLS) je Konto getrennt.
      </p>

      <H2>9. Kontakt</H2>
      <p>Bei Fragen zum Datenschutz: [E-Mail-Adresse des Verantwortlichen].</p>
    </div>
  );
}
