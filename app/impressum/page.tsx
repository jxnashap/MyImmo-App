import BackLink from "@/components/BackLink";

export const metadata = { title: "Impressum — MyImmo" };

// Anbieterkennzeichnung nach § 5 DDG. Daten aus der Gewerbeanmeldung
// (Einzelunternehmen). Vor Produktivbetrieb rechtlich prüfen lassen.
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
        Jonas Scharp<br />
        Geschäftsbezeichnung: MyImmo<br />
        Ludwig-Jahn-Straße 42<br />
        23611 Bad Schwartau<br />
        Deutschland
      </p>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Einzelunternehmen, nicht im Handelsregister eingetragen.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Kontakt</h2>
      <p>
        Telefon: +49 174 9443943<br />
        E-Mail: info@myimmoapp.de
      </p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Umsatzsteuer</h2>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        Eine Umsatzsteuer-Identifikationsnummer nach § 27a UStG ist derzeit nicht vorhanden.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Verantwortlich für den Inhalt</h2>
      <p>Jonas Scharp, Anschrift wie oben.</p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </div>
  );
}
