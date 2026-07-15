import Link from "next/link";
import BackLink from "@/components/BackLink";

export const metadata = {
  title: "Datenschutzerklärung — MyImmo",
  robots: { index: false, follow: false },
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 8 }}>{children}</h2>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontSize: 15, marginTop: 18, marginBottom: 6 }}>{children}</h3>
);

// Datenschutzerklärung nach Art. 12–14 DSGVO + § 25 TDDDG, zugeschnitten auf die
// tatsächlichen Datenflüsse der App (Supabase eu-central-1, Vercel, Anthropic,
// Google-Login, Google Fonts). [Platzhalter] ausfüllen; vor Produktivbetrieb
// anwaltlich bzw. durch eine*n Datenschutzbeauftragte*n prüfen lassen.
export default function DatenschutzPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", lineHeight: 1.65 }}>
      <BackLink />
      <h1 style={{ fontSize: 28, margin: "16px 0 8px" }}>Datenschutzerklärung</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Stand: 2. Juli 2026 · Diese Erklärung informiert nach Art. 12–14 DSGVO über die
        Verarbeitung personenbezogener Daten bei Nutzung der Web-Anwendung MyImmo.
      </p>

      <div style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>
        Hinweis für den Betreiber: [Platzhalter] ausfüllen und vor dem Produktivbetrieb
        rechtlich prüfen lassen. Dieses Dokument ist keine Rechtsberatung.
      </div>

      <H2>1. Verantwortlicher</H2>
      <p>
        Verantwortlicher im Sinne der DSGVO für die Verarbeitung Ihrer Konto- und
        Nutzungsdaten ist:<br />
        <strong>[Name / Firma]</strong>, [Anschrift], E-Mail: [E-Mail].
        Weitere Angaben im <Link href="/impressum" style={{ color: "var(--gold)" }}>Impressum</Link>.
        Ein Datenschutzbeauftragter ist nicht benannt, da keine gesetzliche Pflicht besteht.
      </p>
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        Rollenhinweis: Für die Daten <em>Ihrer Mieter</em>, die Sie in MyImmo erfassen, sind{" "}
        <strong>Sie selbst</strong> Verantwortlicher; wir verarbeiten diese Daten als Ihr
        Auftragsverarbeiter auf Grundlage des{" "}
        <Link href="/avv" style={{ color: "var(--gold)" }}>Auftragsverarbeitungsvertrags (AVV)</Link>{" "}
        (siehe Ziffer 3c und 4).
      </p>

      <H2>2. Grundsätze</H2>
      <ul style={{ paddingLeft: 20 }}>
        <li>Kein Tracking, keine Analyse-Tools, keine Werbung, kein Verkauf von Daten.</li>
        <li>Es werden ausschließlich <strong>technisch notwendige</strong> Cookies und Speichereinträge verwendet (Ziffer 6) — deshalb gibt es kein Cookie-Banner (§ 25 Abs. 2 Nr. 2 TDDDG).</li>
        <li>Datenbank und Authentifizierung laufen in der EU (Frankfurt, AWS eu-central-1).</li>
        <li>Besonders sensible Bankdaten (IBAN, Kontoinhaber) werden zusätzlich anwendungsseitig verschlüsselt (AES-256-GCM); der Schlüssel liegt außerhalb der Datenbank.</li>
      </ul>

      <H2>3. Welche Daten wir verarbeiten, wofür und auf welcher Grundlage</H2>

      <H3>a) Konto und Login</H3>
      <p>
        E-Mail-Adresse, Passwort (nur als bcrypt-Hash gespeichert), Zeitpunkte von
        Registrierung/Anmeldung. Bei <strong>„Login mit Google"</strong> erhalten wir von Google Ihre
        E-Mail-Adresse und Konto-Kennung; die Anmeldung bei Google unterliegt deren
        Datenschutzerklärung. <em>Zweck:</em> Bereitstellung Ihres Kontos.{" "}
        <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag).
      </p>

      <H3>b) Von Ihnen erfasste Verwaltungsdaten</H3>
      <p>
        Immobilien-, Einnahmen-/Kosten-, Kredit-, Verbrauchs-, Termin- und Dokumentdaten
        sowie Ihr Vermieterprofil (Name, Anschrift, Bankverbindung).{" "}
        <em>Zweck:</em> die Kernfunktionen der App (Verwaltung, Auswertungen, Dokumente).{" "}
        <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <H3>c) Mieterdaten (Daten Dritter)</H3>
      <p>
        Namen, Kontaktdaten, Mietverhältnis-, Kautions- und Abrechnungsdaten Ihrer Mieter,
        die Sie erfassen. Hierfür sind Sie Verantwortlicher (Rechtsgrundlage in Ihrem
        Verhältnis zum Mieter regelmäßig Art. 6 Abs. 1 lit. b und c DSGVO — Mietvertrag,
        Betriebskostenabrechnung, steuerliche Pflichten); wir verarbeiten sie ausschließlich
        in Ihrem Auftrag (Art. 28 DSGVO, siehe AVV).
      </p>

      <H3>d) Server-Logs (Hosting)</H3>
      <p>
        Beim Aufruf der App verarbeitet unser Hoster technisch bedingt IP-Adresse,
        Datum/Uhrzeit, aufgerufene URL und Browserkennung. <em>Zweck:</em> Auslieferung,
        Stabilität und Sicherheit (z. B. Missbrauchsabwehr). <em>Rechtsgrundlage:</em> Art. 6
        Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb). Logs werden nach
        kurzer Zeit automatisch gelöscht.
      </p>

      <H3>e) KI-Funktionen (Beleg-/Dokumenterkennung)</H3>
      <p>
        Wenn Sie die optionalen KI-Funktionen nutzen (z. B. Nebenkostenabrechnung auslesen,
        Objekt aus Exposé-Text übernehmen), wird der von Ihnen hochgeladene Inhalt an die
        API von Anthropic (USA) übermittelt und dort zur Beantwortung Ihrer Anfrage
        verarbeitet. API-Eingaben werden von Anthropic standardmäßig{" "}
        <strong>nicht zum Training von KI-Modellen verwendet</strong>. <em>Zweck:</em> die von Ihnen
        angestoßene Auswertung. <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO; die
        Nutzung ist freiwillig. Bitte laden Sie nur Dokumente hoch, die für die Auswertung
        erforderlich sind.
      </p>

      <H3>f) Bank-Freigabelinks (Beleihungsordner)</H3>
      <p>
        Erstellen Sie einen Freigabelink für eine Bank, sind die von Ihnen ausgewählten
        Unterlagen für Inhaber des Links bis zum Ablauf bzw. Widerruf abrufbar. Auswahl,
        Laufzeit und Widerruf liegen bei Ihnen. Rückmeldungen der Bank (Name, Institut,
        Kontakt, Nachricht) werden Ihrem Konto zugeordnet gespeichert.
      </p>

      <H3>g) Konto-Anbindung (Open Banking, optional)</H3>
      <p>
        Verbinden Sie freiwillig ein Bankkonto, erfolgt der Zugriff ausschließlich lesend
        über den lizenzierten Kontoinformationsdienst <strong>Enable Banking Oy</strong>{" "}
        (Finnland/EU, beaufsichtigt durch die finnische Finanzaufsicht FIN-FSA). Die
        Freigabe erteilen Sie direkt bei Ihrer Bank; sie läuft nach PSD2 spätestens nach
        90 Tagen ab und ist jederzeit widerrufbar. Abgerufene Umsatzdaten (Datum, Betrag,
        Zahlungsbeteiligte, Verwendungszweck) werden in unserer Datenbank{" "}
        <strong>verschlüsselt</strong> gespeichert und nur zur Zuordnung zu Ihren Miet- und
        Kostenbuchungen verwendet — Buchungen entstehen ausschließlich nach Ihrer
        Bestätigung. <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <H2>4. Empfänger und Auftragsverarbeiter (Subprozessoren)</H2>
      <p>Wir setzen folgende Dienstleister mit Verträgen nach Art. 28 DSGVO ein:</p>
      <ul style={{ paddingLeft: 20 }}>
        <li><strong>Supabase Inc.</strong> (Datenbank, Authentifizierung, Datei-Speicher) — Datenhaltung in Frankfurt (AWS eu-central-1); DPA inkl. EU-Standardvertragsklauseln.</li>
        <li><strong>Vercel Inc.</strong>, USA (Hosting/Auslieferung der App) — DPA inkl. EU-Standardvertragsklauseln; technische Logs können in den USA verarbeitet werden.</li>
        <li><strong>Anthropic PBC</strong>, USA (KI-Auswertung, nur bei aktiver Nutzung) — DPA inkl. EU-Standardvertragsklauseln; kein Modell-Training mit API-Daten.</li>
        <li><strong>Google Ireland Ltd.</strong> — nur bei „Login mit Google" und für Schriftarten (Ziffer 7).</li>
        <li><strong>Enable Banking Oy</strong>, Finnland/EU (Kontoinformationsdienst, nur bei aktiver Konto-Anbindung) — lizenzierter AISP; Datenverarbeitung in der EU.</li>
      </ul>
      <p>
        Eine Übermittlung an sonstige Dritte findet nicht statt, außer Sie stoßen sie selbst
        an (z. B. Bank-Freigabelink) oder wir sind gesetzlich dazu verpflichtet.
      </p>

      <H2>5. Drittlandübermittlung</H2>
      <p>
        Soweit Daten in die USA übermittelt werden (Vercel, Anthropic, ggf. Google), erfolgt
        dies auf Grundlage der EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO)
        bzw. — soweit der Anbieter zertifiziert ist — des Angemessenheitsbeschlusses zum
        EU-US Data Privacy Framework (Art. 45 DSGVO).
      </p>

      <H2>6. Cookies und lokale Speicherung (§ 25 TDDDG)</H2>
      <p>
        MyImmo verwendet ausschließlich technisch notwendige Einträge: Sitzungs-Cookies der
        Anmeldung (Supabase Auth) und lokale Speichereinträge für Ihre Hell/Dunkel-Einstellung
        sowie Kalkulator-Zwischenstände. Diese sind für den von Ihnen gewünschten Dienst
        erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG) und bedürfen keiner Einwilligung. Es gibt
        keine Marketing- oder Statistik-Cookies.
      </p>

      <H2>7. Schriftarten</H2>
      <p>
        Die Schriftarten „Fraunces" und „Outfit" werden lokal von unseren eigenen Servern
        geladen (Self-Hosting). Es findet dabei <strong>keine</strong> Verbindung zu
        Google-Servern statt; Ihre IP-Adresse wird nicht an Google übermittelt.
      </p>

      <H2>8. Speicherdauer und Löschung</H2>
      <ul style={{ paddingLeft: 20 }}>
        <li>Konto- und Verwaltungsdaten speichern wir, solange Ihr Konto besteht.</li>
        <li>Sie können Ihr Konto jederzeit selbst löschen (Einstellungen → „Konto löschen"): Dabei werden alle Daten — Objekte, Mieter, Buchungen, Kredite, Dokumente, Belege im Datei-Speicher — unwiderruflich entfernt.</li>
        <li>Bank-Freigabelinks laufen automatisch ab (7–30 Tage) und sind jederzeit widerrufbar.</li>
        <li>Technische Backups des Datenbank-Anbieters werden turnusmäßig überschrieben.</li>
        <li>Gesetzliche Aufbewahrungspflichten (z. B. § 147 AO für Ihre Vermieterunterlagen) liegen in Ihrer Verantwortung — exportieren Sie benötigte Daten vor einer Löschung.</li>
      </ul>

      <H2>9. Ihre Rechte</H2>
      <p>
        Sie haben gegenüber dem Verantwortlichen das Recht auf Auskunft (Art. 15),
        Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung
        (Art. 18), Datenübertragbarkeit (Art. 20) sowie <strong>Widerspruch</strong> gegen
        Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21). Eine erteilte
        Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7
        Abs. 3). Zudem haben Sie ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde
        (Art. 77), z. B. der Behörde Ihres Wohnsitzes; zuständig für den Betreiber ist
        [zuständige Landesdatenschutzbehörde].
      </p>
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        Betrifft Ihr Anliegen Mieterdaten, die ein Vermieter in MyImmo erfasst hat, richten
        Sie es bitte an den jeweiligen Vermieter als Verantwortlichen; wir unterstützen ihn
        bei der Beantwortung.
      </p>

      <H2>10. Datensicherheit</H2>
      <p>
        Übertragung ausschließlich TLS-verschlüsselt; Zugriffstrennung je Konto auf
        Datenbankebene (Row Level Security); Passwörter nur als Hash; App-seitige
        Verschlüsselung von Bankdaten (AES-256-GCM) mit Schlüssel außerhalb der Datenbank;
        Content-Security-Policy und weitere Sicherheits-Header; private Datei-Speicher mit
        kurzlebigen, signierten Abruf-Links.
      </p>

      <H2>11. Keine automatisierte Entscheidungsfindung</H2>
      <p>
        Es findet keine automatisierte Entscheidungsfindung einschließlich Profiling im
        Sinne von Art. 22 DSGVO statt. Die KI-Funktionen werten nur von Ihnen angestoßene
        Dokumente aus und treffen keine Entscheidungen mit Rechtswirkung.
      </p>

      <H2>12. Pflicht zur Bereitstellung &amp; Änderungen</H2>
      <p>
        Für die Registrierung ist nur die E-Mail-Adresse erforderlich; alle weiteren Angaben
        sind freiwillig, ohne sie stehen ggf. einzelne Funktionen nicht zur Verfügung. Wir
        passen diese Erklärung an, wenn sich Funktionen oder Rechtslage ändern; es gilt die
        jeweils hier veröffentlichte Fassung.
      </p>
    </div>
  );
}
