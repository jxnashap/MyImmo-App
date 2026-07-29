import Link from "next/link";

// Fußzeile für die ÖFFENTLICHEN Seiten (/bewerben, /beleihung, /auftrag).
//
// Diese Seiten erreichen Menschen ohne Konto — Mietinteressenten, Bankberater,
// Handwerksbetriebe. Sie geben dort teils sehr persönliche Angaben ein
// (Nettoeinkommen, Arbeitgeber, SCHUFA, Unterschrift), fanden bisher aber
// weder Impressum noch Datenschutzerklärung und erfuhren nicht, wer die Daten
// erhebt. Art. 13 DSGVO verlangt beides zum Zeitpunkt der Erhebung.
//
// `verantwortlicher` ist der VERMIETER — er ist der Verantwortliche im Sinne
// der DSGVO, MyImmo ist Auftragsverarbeiter (siehe /avv).

export default function OeffentlicheFusszeile({
  verantwortlicher,
  kontakt,
  zweck,
}: {
  /** Name des Vermieters. Fehlt er, wird das ehrlich benannt statt verschwiegen. */
  verantwortlicher?: string | null;
  /** E-Mail oder Telefon des Vermieters, soweit hinterlegt. */
  kontakt?: string | null;
  /** Ein Satz, wofür die Daten verarbeitet werden. */
  zweck: string;
}) {
  return (
    <footer
      style={{
        marginTop: 32,
        paddingTop: 18,
        borderTop: "1px solid var(--line)",
        fontSize: 11.5,
        color: "var(--muted)",
        lineHeight: 1.7,
      }}
    >
      <p style={{ margin: "0 0 8px" }}>
        <strong style={{ color: "var(--text)" }}>Verantwortlich für diese Datenverarbeitung</strong>
        <br />
        {verantwortlicher ? (
          <>
            {verantwortlicher}
            {kontakt ? ` · ${kontakt}` : ""}
          </>
        ) : (
          <>
            der Vermieter, der Ihnen diesen Link geschickt hat. Er hat seinen Namen in MyImmo noch
            nicht hinterlegt — bitte fragen Sie ihn direkt nach seinen Kontaktdaten.
          </>
        )}
      </p>
      <p style={{ margin: "0 0 8px" }}>
        {zweck} Ihre Angaben werden ausschließlich an diesen Vermieter übermittelt. Sie haben das
        Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und
        Widerspruch (Art. 15–21 DSGVO) sowie auf Beschwerde bei einer Aufsichtsbehörde. Wenden Sie
        sich dafür an den oben genannten Verantwortlichen.
      </p>
      <p style={{ margin: 0 }}>
        Technisch bereitgestellt über MyImmo (Auftragsverarbeiter) ·{" "}
        <Link href="/datenschutz" style={{ color: "var(--gold)" }}>
          Datenschutz
        </Link>{" "}
        ·{" "}
        <Link href="/impressum" style={{ color: "var(--gold)" }}>
          Impressum
        </Link>{" "}
        ·{" "}
        <Link href="/avv" style={{ color: "var(--gold)" }}>
          Auftragsverarbeitung
        </Link>
      </p>
    </footer>
  );
}
