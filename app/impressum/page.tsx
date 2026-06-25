import BackLink from "@/components/BackLink";

export const metadata = { title: "Impressum — MyImmo" };

// Hinweis: Inhalte in [eckigen Klammern] müssen vom Betreiber ausgefüllt werden
// (Gewerbeanmeldung / Anbieterkennzeichnung nach § 5 DDG).
export default function ImpressumPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", lineHeight: 1.6 }}>
      <BackLink />
      <h1 style={{ fontSize: 28, margin: "16px 0 24px" }}>Impressum</h1>

      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).
      </p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Anbieter</h2>
      <p>
        [Vor- und Nachname / Firma]<br />
        [Straße und Hausnummer]<br />
        [PLZ und Ort]<br />
        [Land]
      </p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Kontakt</h2>
      <p>
        Telefon: [Telefonnummer]<br />
        E-Mail: [E-Mail-Adresse]
      </p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Umsatzsteuer-ID</h2>
      <p>[USt-IdNr. nach § 27a UStG, falls vorhanden]</p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Verantwortlich für den Inhalt</h2>
      <p>[Name, Anschrift wie oben]</p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 40 }}>
        Hinweis für den Betreiber: Bitte alle [Platzhalter] mit den Daten aus deiner
        Gewerbeanmeldung ausfüllen, bevor die App produktiv geht.
      </p>
    </div>
  );
}
