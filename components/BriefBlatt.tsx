import type { ReactNode } from "react";

// Gemeinsames DIN-A4-Brief-Blatt für alle Dokumente (NK-Abrechnung, Briefe).
// Reines Markup — Styles in globals.css (.brief-*). Das Blatt wird auf dem
// Bildschirm als weißes Papier gerendert und ist zugleich die Druckvorlage:
// window.print() druckt genau dieses Blatt (alles andere ist .no-print bzw.
// wird von der @media-print-CSS ausgeblendet).
//
// DIN 5008 Form B: Adressfeld (Fensterkuvert) absolut bei top:45mm/left:25mm,
// 85mm breit — Rücksendezeile klein darüber. Betreff beginnt darunter.

export default function BriefBlatt({
  absenderName,
  absenderZeile,
  ruecksende,
  vermerk,
  empfaenger,
  ortDatum,
  referenz,
  betreff,
  untertitel,
  children,
}: {
  absenderName: string;
  /** z. B. "Eigentümerweg 12 · 04109 Leipzig · max@beispiel.de" */
  absenderZeile?: string | null;
  /** kleine Rücksendezeile im Adressfeld (Absender einzeilig) */
  ruecksende?: string | null;
  /** z. B. "Vertrauliches Dokument" */
  vermerk?: string | null;
  /** Empfängername + Adresszeilen */
  empfaenger: string[];
  ortDatum: string;
  referenz?: string | null;
  betreff: string;
  untertitel?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="brief-sheet">
      <div className="brief-head-zone">
        <div className="brief-kopf">
          <div className="brief-logo">
            My<span>Immo</span>
          </div>
          <div className="brief-absender">
            <strong>{absenderName}</strong>
            {absenderZeile && <div>{absenderZeile}</div>}
          </div>
        </div>
        <div className="brief-goldline" />

        <div className="brief-adressfeld">
          {ruecksende && <div className="ruecksende">{ruecksende}</div>}
          {vermerk && <div className="brief-vermerk">{vermerk}</div>}
          {empfaenger.map((z, i) => (
            <div key={i}>{z}</div>
          ))}
        </div>

        <div className="brief-ortdatum">
          <div>{ortDatum}</div>
          {referenz && <div className="ref">{referenz}</div>}
        </div>
      </div>

      <div className="brief-betreff">
        <h2>{betreff}</h2>
        {untertitel && <div className="unter">{untertitel}</div>}
        <div className="brief-betreff-linie" />
      </div>

      <div className="brief-body">{children}</div>

      <div className="brief-fuss">
        <span>MyImmo</span>
        <span>{ortDatum}</span>
      </div>
    </div>
  );
}
