import Link from "next/link";
import BackLink from "@/components/BackLink";

export const metadata = {
  title: "AGB — MyImmo",
  robots: { index: false, follow: false },
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 8 }}>{children}</h2>
);

// AGB für das SaaS-Angebot MyImmo (Freemium, künftig Bezahltarife).
// Wichtigste Bausteine: Vertragsschluss, Leistungsumfang mit Freemium-Vorbehalt,
// KEINE Steuer-/Rechtsberatung (Anlage V/NK sind Berechnungshilfen!),
// Nutzerpflichten (Verantwortlicher für Mieterdaten, AVV), Verfügbarkeit,
// Preise/Widerruf (Verbraucher), Laufzeit/Kündigung, Haftung, Änderungen.
// [Platzhalter] ausfüllen; vor Produktivbetrieb anwaltlich prüfen lassen.
export default function AgbPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", lineHeight: 1.65 }}>
      <BackLink />
      <h1 style={{ fontSize: 28, margin: "16px 0 8px" }}>Allgemeine Geschäftsbedingungen (AGB)</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Stand: 2. Juli 2026 · für die Nutzung der Web-Anwendung MyImmo.
      </p>

      <div style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>
        Hinweis für den Betreiber: Entwurf — vor dem Produktivbetrieb (insbesondere
        vor Einführung von Bezahltarifen) anwaltlich prüfen lassen. Keine Rechtsberatung.
      </div>

      <H2>1. Anbieter und Geltungsbereich</H2>
      <p>
        Anbieter von MyImmo ist <strong>Jonas Scharp (MyImmo)</strong>,
        Ludwig-Jahn-Straße 42, 23611 Bad Schwartau, E-Mail: info@myimmoapp.de
        (siehe <Link href="/impressum" style={{ color: "var(--gold)" }}>Impressum</Link>).
        Diese AGB gelten für alle Verträge über die Nutzung der Web-Anwendung MyImmo
        („Dienst"). Abweichende Bedingungen des Nutzers finden keine Anwendung.
      </p>

      <H2>2. Leistungsbeschreibung</H2>
      <p>
        MyImmo ist eine Software zur Verwaltung vermieteter Immobilien (Objekte, Mieter,
        Einnahmen/Ausgaben, Kredite, Nebenkosten­abrechnung, steuerliche Auswertungen,
        Dokumente, Termine). Der Funktionsumfang ergibt sich aus der jeweils aktuellen
        Produktbeschreibung in der App. Der Anbieter entwickelt den Dienst laufend weiter
        und darf Funktionen ändern oder ergänzen, soweit der Vertragszweck gewahrt bleibt.
      </p>
      <p>
        <strong>Kostenloser Basisumfang und künftige Bezahltarife:</strong> Der Dienst wird
        derzeit kostenlos angeboten. Der Anbieter behält sich vor, künftig Teile des
        Funktionsumfangs kostenpflichtigen Tarifen vorzubehalten. Bestehende Daten bleiben
        auch bei Nutzung des kostenlosen Umfangs zugänglich bzw. exportierbar.
      </p>

      <H2>3. Keine Steuer- oder Rechtsberatung</H2>
      <p>
        Berechnungen und Auswertungen in MyImmo (insbesondere Nebenkosten­abrechnung,
        Anlage V, AfA, Kalkulatoren, automatische Fristen) sind <strong>Rechen- und
        Organisationshilfen ohne Gewähr</strong>. Sie ersetzen keine Steuer- oder
        Rechtsberatung. Für die Richtigkeit von Abrechnungen und Steuererklärungen
        gegenüber Mietern und Finanzbehörden bleibt der Nutzer selbst verantwortlich;
        im Zweifel ist fachkundiger Rat (Steuerberater, Rechtsanwalt) einzuholen.
      </p>

      <H2>4. Registrierung und Vertragsschluss</H2>
      <p>
        Der Vertrag kommt mit Abschluss der Registrierung (E-Mail/Passwort oder Google-
        Login) und Zustimmung zu diesen AGB, der{" "}
        <Link href="/datenschutz" style={{ color: "var(--gold)" }}>Datenschutzerklärung</Link>{" "}
        und dem <Link href="/avv" style={{ color: "var(--gold)" }}>AVV</Link> zustande.
        Nutzer müssen volljährig sein. Zugangsdaten sind geheim zu halten; für Handlungen
        unter dem eigenen Konto ist der Nutzer verantwortlich.
      </p>

      <H2>5. Pflichten des Nutzers</H2>
      <ul style={{ paddingLeft: 20 }}>
        <li>Der Nutzer erfasst Daten Dritter (insbesondere Mieterdaten) in eigener Verantwortung als datenschutzrechtlich Verantwortlicher; Grundlage der Verarbeitung durch den Anbieter ist der <Link href="/avv" style={{ color: "var(--gold)" }}>AVV</Link>. Der Nutzer stellt sicher, dass er zur Verarbeitung dieser Daten berechtigt ist.</li>
        <li>Keine rechtswidrigen, beleidigenden oder schadhaften Inhalte (insbesondere Malware) hochladen; keine Umgehung von Zugriffskontrollen; keine missbräuchliche oder exzessive automatisierte Nutzung.</li>
        <li>Bank-Freigabelinks nur an berechtigte Empfänger weitergeben; für die Auswahl der freigegebenen Dokumente ist der Nutzer verantwortlich.</li>
        <li>Regelmäßige eigene Datensicherung über die Export-Funktion wird empfohlen, insbesondere vor Kontolöschung (gesetzliche Aufbewahrungspflichten, z. B. § 147 AO, liegen beim Nutzer).</li>
      </ul>

      <H2>6. Verfügbarkeit</H2>
      <p>
        Der Anbieter bemüht sich um eine hohe Verfügbarkeit, schuldet jedoch — insbesondere
        im kostenlosen Umfang — keine bestimmte Verfügbarkeitsquote. Wartungsarbeiten,
        Weiterentwicklung und Störungen bei eingesetzten Dienstleistern können zu
        vorübergehenden Unterbrechungen führen.
      </p>

      <H2>7. Preise, Zahlung, Widerrufsrecht (künftige Bezahltarife)</H2>
      <p>
        Sofern kostenpflichtige Tarife angeboten werden, gelten die bei Bestellung
        ausgewiesenen Preise (Brutto, inkl. gesetzlicher USt., soweit anfallend [bzw.
        Hinweis nach § 19 UStG bei Kleinunternehmerregelung]). Abrechnung wahlweise
        monatlich oder jährlich über den angegebenen Zahlungsdienstleister bzw. den
        Apple App Store.
      </p>
      <p>
        <strong>Widerrufsrecht für Verbraucher:</strong> Verbrauchern steht bei
        entgeltlichen Verträgen ein 14-tägiges Widerrufsrecht zu. Die vollständige
        Widerrufsbelehrung nebst Muster-Widerrufsformular wird im Bestellprozess
        bereitgestellt. Das Widerrufsrecht erlischt bei digitalen Leistungen vorzeitig,
        wenn der Nutzer ausdrücklich zustimmt, dass vor Ablauf der Frist mit der
        Ausführung begonnen wird, und seine Kenntnis vom Erlöschen bestätigt
        (§ 356 Abs. 5 BGB).
      </p>

      <H2>8. Laufzeit und Kündigung</H2>
      <p>
        Der Nutzungsvertrag läuft auf unbestimmte Zeit. Der Nutzer kann jederzeit ohne
        Frist kündigen — durch Löschung des Kontos in den Einstellungen („Konto löschen")
        oder über den Kündigungsweg des jeweiligen Bezahlkanals; bei Bezahltarifen endet
        der Zugang zum Bezahltarif zum Ende des bereits bezahlten Zeitraums. Der Anbieter
        kann den kostenlosen Dienst mit einer Frist von 4 Wochen kündigen; das Recht zur
        außerordentlichen Kündigung aus wichtigem Grund (z. B. bei Missbrauch) bleibt
        unberührt. Nach Vertragsende werden die Daten gemäß{" "}
        <Link href="/datenschutz" style={{ color: "var(--gold)" }}>Datenschutzerklärung</Link>{" "}
        und AVV gelöscht.
      </p>

      <H2>9. Nutzungsrechte</H2>
      <p>
        Der Nutzer erhält für die Vertragsdauer ein einfaches, nicht übertragbares Recht
        zur Nutzung des Dienstes für eigene Verwaltungszwecke. Die vom Nutzer erfassten
        Inhalte bleiben seine; der Anbieter verarbeitet sie nur zur Leistungserbringung
        (siehe AVV).
      </p>

      <H2>10. Haftung</H2>
      <p>
        Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei
        Verletzung von Leben, Körper oder Gesundheit. Bei einfacher Fahrlässigkeit haftet
        er nur für die Verletzung wesentlicher Vertragspflichten (Kardinalpflichten),
        begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Im Übrigen ist die
        Haftung ausgeschlossen; die Haftung nach dem Produkthaftungsgesetz bleibt
        unberührt. Für die inhaltliche Richtigkeit der vom Nutzer erfassten Daten und der
        daraus erzeugten Berechnungen (Ziffer 3) übernimmt der Anbieter keine Haftung.
      </p>

      <H2>11. Änderungen der AGB</H2>
      <p>
        Der Anbieter kann diese AGB mit Wirkung für die Zukunft anpassen, soweit dies aus
        triftigen Gründen (Rechtsänderung, Funktionsänderungen, neue Tarife) erforderlich
        ist und den Nutzer nicht unangemessen benachteiligt. Änderungen werden mindestens
        4 Wochen vor Wirksamwerden in der App oder per E-Mail angekündigt; widerspricht
        der Nutzer nicht bis zum Wirksamwerden, gelten sie als angenommen — hierauf wird
        in der Ankündigung gesondert hingewiesen. Bei Widerspruch kann jede Partei den
        Vertrag zum Wirksamwerden der Änderung beenden.
      </p>

      <H2>12. Schlussbestimmungen</H2>
      <p>
        Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts; gegenüber Verbrauchern
        bleiben zwingende Verbraucherschutzvorschriften ihres Aufenthaltsstaats unberührt.
        Die EU-Plattform zur Online-Streitbeilegung ist unter{" "}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>ec.europa.eu/consumers/odr</a>{" "}
        erreichbar; zur Teilnahme an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle ist der Anbieter nicht verpflichtet und nicht
        bereit. Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im
        Übrigen wirksam.
      </p>
    </div>
  );
}
