import Link from "next/link";
import BackLink from "@/components/BackLink";

export const metadata = {
  title: "Auftragsverarbeitungsvertrag (AVV) — MyImmo",
  robots: { index: false, follow: false },
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 8 }}>{children}</h2>
);

// AVV nach Art. 28 Abs. 3 DSGVO zwischen Nutzer (Vermieter = Verantwortlicher)
// und Betreiber (Auftragsverarbeiter). Deckt alle Pflichtinhalte ab:
// Gegenstand/Dauer, Art/Zweck, Datenarten, Betroffene, Weisungen, Vertraulichkeit,
// TOMs (Anlage), Subprozessoren, Betroffenenrechte, Meldepflichten, Löschung,
// Nachweise/Kontrollen. [Platzhalter] ausfüllen, anwaltlich prüfen lassen.
export default function AvvPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", lineHeight: 1.65 }}>
      <BackLink />
      <h1 style={{ fontSize: 28, margin: "16px 0 8px" }}>Auftragsverarbeitungsvertrag (AVV)</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Stand: 2. Juli 2026 · Vereinbarung nach Art. 28 Abs. 3 DSGVO zwischen Ihnen als
        Verantwortlichem und dem Betreiber von MyImmo als Auftragsverarbeiter. Sie wird mit
        der Registrierung bzw. der weiteren Nutzung der App Vertragsbestandteil.
      </p>

      <div style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>
        Hinweis für den Betreiber: [Platzhalter] ausfüllen und anwaltlich prüfen lassen,
        bevor der Vertrag produktiv akzeptiert wird. Keine Rechtsberatung.
      </div>

      <H2>1. Parteien, Gegenstand und Dauer</H2>
      <p>
        <strong>Verantwortlicher:</strong> die Nutzerin / der Nutzer des jeweiligen
        MyImmo-Kontos (Vermieter).<br />
        <strong>Auftragsverarbeiter:</strong> [Name / Firma], [Anschrift] („Betreiber").
      </p>
      <p>
        Gegenstand ist die Bereitstellung der Web-Anwendung MyImmo zur Immobilien- und
        Mietverwaltung, in der der Verantwortliche personenbezogene Daten Dritter
        (insbesondere seiner Mieter) speichert und verarbeitet. Die Vereinbarung gilt für
        die Dauer des Nutzungsverhältnisses und endet mit der Löschung des Kontos.
      </p>

      <H2>2. Art und Zweck der Verarbeitung</H2>
      <p>
        Hosting, Speicherung, Anzeige, Auswertung und Ausgabe (z. B. Abrechnungen, Briefe,
        Exporte) der vom Verantwortlichen erfassten Daten; auf Anstoß des Verantwortlichen
        zusätzlich KI-gestützte Dokumentauswertung und zeitlich begrenzte Freigaben an von
        ihm benannte Empfänger (z. B. Banken). Eine Verarbeitung zu eigenen Zwecken des
        Betreibers findet nicht statt.
      </p>

      <H2>3. Art der Daten und Kategorien betroffener Personen</H2>
      <ul style={{ paddingLeft: 20 }}>
        <li><strong>Datenarten:</strong> Stammdaten (Name, Anschrift, Kontaktdaten), Vertragsdaten des Mietverhältnisses (Mietbeginn/-ende, Miete, Kaution, Einheit), Abrechnungs- und Zahlungsdaten (inkl. Bankverbindung), Verbrauchsdaten, Dokumente und Belege, Notizen des Verantwortlichen.</li>
        <li><strong>Betroffene Personen:</strong> Mieter und ehemalige Mieter des Verantwortlichen, ggf. weitere im Mietverhältnis auftretende Personen (z. B. Bürgen, Ansprechpartner von Dienstleistern), Ansprechpartner von Banken bei Rückmeldungen.</li>
      </ul>

      <H2>4. Weisungsbindung (Art. 28 Abs. 3 lit. a)</H2>
      <p>
        Der Betreiber verarbeitet die Daten ausschließlich auf dokumentierte Weisung des
        Verantwortlichen; Weisungen werden über die Funktionen der App erteilt (Anlegen,
        Ändern, Freigeben, Löschen). Hält der Betreiber eine Weisung für rechtswidrig,
        informiert er den Verantwortlichen unverzüglich. Eine Verarbeitung nach dem Recht
        der Union oder eines Mitgliedstaats bleibt vorbehalten; in diesem Fall wird der
        Verantwortliche vorab informiert, soweit rechtlich zulässig.
      </p>

      <H2>5. Vertraulichkeit (lit. b)</H2>
      <p>
        Zum Zugriff befugte Personen sind zur Vertraulichkeit verpflichtet. Der Betreiber
        greift auf Inhaltsdaten nur zu, soweit dies für Betrieb, Fehlerbehebung oder auf
        Wunsch des Verantwortlichen erforderlich ist.
      </p>

      <H2>6. Sicherheit der Verarbeitung (lit. c, Art. 32)</H2>
      <p>
        Der Betreiber trifft die in der <strong>Anlage TOM</strong> (unten) beschriebenen
        technischen und organisatorischen Maßnahmen und entwickelt sie entsprechend dem
        Stand der Technik fort.
      </p>

      <H2>7. Subauftragsverarbeiter (lit. d)</H2>
      <p>
        Der Verantwortliche erteilt die <strong>allgemeine Genehmigung</strong> zum Einsatz
        folgender Subauftragsverarbeiter:
      </p>
      <ul style={{ paddingLeft: 20 }}>
        <li><strong>Supabase Inc.</strong> — Datenbank, Authentifizierung, Datei-Speicher; Datenhaltung Frankfurt (AWS eu-central-1); DPA mit EU-Standardvertragsklauseln.</li>
        <li><strong>Vercel Inc.</strong> (USA) — Hosting/Auslieferung; DPA mit EU-Standardvertragsklauseln.</li>
        <li><strong>Anthropic PBC</strong> (USA) — KI-Auswertung, nur bei aktiver Nutzung durch den Verantwortlichen; DPA mit EU-Standardvertragsklauseln; kein Modell-Training mit API-Daten.</li>
        <li><strong>Google Ireland Ltd.</strong> — nur „Login mit Google" und Schriftarten-Auslieferung.</li>
        <li><strong>Enable Banking Oy</strong> (Finnland/EU) — Kontoinformationsdienst (Open Banking, nur bei aktiver Konto-Anbindung durch den Verantwortlichen); lizenzierter AISP unter Aufsicht der FIN-FSA; Verarbeitung in der EU.</li>
      </ul>
      <p>
        Über beabsichtigte Änderungen (Hinzufügen/Ersetzen) informiert der Betreiber vorab
        in der App oder per E-Mail; der Verantwortliche kann innerhalb von 14 Tagen aus
        wichtigem Grund widersprechen. Bei Widerspruch steht beiden Parteien die
        Kündigung des Nutzungsverhältnisses offen. Der Betreiber verpflichtet
        Subauftragsverarbeiter auf mindestens gleichwertige Datenschutzpflichten und haftet
        für sie wie für eigenes Handeln. Übermittlungen in Drittländer erfolgen nur mit
        Garantien nach Kap. V DSGVO (Standardvertragsklauseln bzw. Angemessenheitsbeschluss).
      </p>

      <H2>8. Unterstützung bei Betroffenenrechten (lit. e)</H2>
      <p>
        Der Betreiber unterstützt den Verantwortlichen mit geeigneten Mitteln bei der
        Beantwortung von Anträgen betroffener Personen (Art. 12–23 DSGVO) — insbesondere
        durch die Auskunfts-, Export-, Berichtigungs- und Löschfunktionen der App. Anträge,
        die beim Betreiber eingehen, leitet er unverzüglich an den Verantwortlichen weiter.
      </p>

      <H2>9. Meldepflichten und weitere Unterstützung (lit. f)</H2>
      <p>
        Der Betreiber meldet dem Verantwortlichen Verletzungen des Schutzes
        personenbezogener Daten <strong>unverzüglich</strong> nach Bekanntwerden mit den
        Informationen nach Art. 33 Abs. 3 DSGVO und unterstützt ihn bei seinen Pflichten aus
        Art. 32–36 DSGVO (Sicherheit, Meldungen, ggf. Datenschutz-Folgenabschätzung) unter
        Berücksichtigung der verfügbaren Informationen.
      </p>

      <H2>10. Löschung und Rückgabe (lit. g)</H2>
      <p>
        Nach Ende des Nutzungsverhältnisses — insbesondere bei Kontolöschung durch den
        Verantwortlichen — werden sämtliche personenbezogenen Daten einschließlich der
        Dateien im Datei-Speicher unwiderruflich gelöscht, soweit keine gesetzliche
        Aufbewahrungspflicht des Betreibers entgegensteht. Der Verantwortliche kann seine
        Daten zuvor über die Export-Funktionen der App sichern. Restkopien in technischen
        Backups werden turnusmäßig überschrieben.
      </p>

      <H2>11. Nachweise und Kontrollen (lit. h)</H2>
      <p>
        Der Betreiber stellt dem Verantwortlichen alle zum Nachweis der Einhaltung dieses
        Vertrags erforderlichen Informationen zur Verfügung (insbesondere diese Vereinbarung,
        die Anlage TOM und die Zertifizierungen/DPAs der Subauftragsverarbeiter) und
        ermöglicht angemessene Überprüfungen. Kontrollen erfolgen in der Regel durch
        Auskünfte und Vorlage geeigneter Nachweise; Vor-Ort-Kontrollen nur bei konkretem
        Anlass und nach Ankündigung.
      </p>

      <H2>12. Schlussbestimmungen</H2>
      <p>
        Es gilt deutsches Recht. Die Haftung richtet sich nach Art. 82 DSGVO und den
        gesetzlichen Regeln. Sollten einzelne Bestimmungen unwirksam sein, bleibt der
        Vertrag im Übrigen wirksam. Bei Widersprüchen zu den allgemeinen Nutzungsbedingungen
        geht dieser AVV in Datenschutzfragen vor.
      </p>

      <H2>Anlage: Technische und organisatorische Maßnahmen (TOM)</H2>
      <ul style={{ paddingLeft: 20 }}>
        <li><strong>Zugangs-/Zugriffskontrolle:</strong> Anmeldung mit E-Mail/Passwort (bcrypt-Hash) oder Google-OAuth; strikte Mandantentrennung je Konto auf Datenbankebene (Row Level Security); private Datei-Speicher mit Zugriff nur über kurzlebige signierte Links bzw. eigentümergebundene Richtlinien.</li>
        <li><strong>Übertragungskontrolle:</strong> ausschließlich TLS-verschlüsselte Verbindungen; Content-Security-Policy und Sicherheits-Header.</li>
        <li><strong>Verschlüsselung:</strong> Speicherung bei Anbietern mit Verschlüsselung „at rest"; zusätzlich anwendungsseitige AES-256-GCM-Verschlüsselung von Bankverbindungsdaten mit Schlüssel außerhalb der Datenbank.</li>
        <li><strong>Verfügbarkeitskontrolle:</strong> Betrieb bei professionellen Cloud-Anbietern mit redundanter Infrastruktur und turnusmäßigen Backups.</li>
        <li><strong>Trennungsgebot:</strong> Row Level Security stellt sicher, dass jedes Konto ausschließlich eigene Datensätze lesen und schreiben kann; Bank-Freigaben liefern nur explizit ausgewählte Dokumente über ablaufende, widerrufbare Token aus.</li>
        <li><strong>Eingabekontrolle:</strong> Änderungen erfolgen kontogebunden über authentifizierte Sitzungen; destruktive Aktionen erfordern Bestätigung.</li>
        <li><strong>Organisatorisches:</strong> Zugriff auf Produktionssysteme nur durch den Betreiber; Geheimnisse (API-Schlüssel, Verschlüsselungsschlüssel) werden außerhalb des Quellcodes in der Hosting-Umgebung verwaltet.</li>
      </ul>

      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 24 }}>
        Ergänzend gilt die{" "}
        <Link href="/datenschutz" style={{ color: "var(--gold)" }}>Datenschutzerklärung</Link>.
      </p>
    </div>
  );
}
