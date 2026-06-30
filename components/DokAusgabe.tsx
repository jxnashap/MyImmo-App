"use client";

import { Mail, FileDown } from "lucide-react";

/**
 * Zentrale Ausgabe-Auswahl für Mieter-Dokumente (NK-Abrechnung, Briefe …).
 * Bietet einheitlich zwei Wege an:
 *   • „Per Mail versenden" → mailto-Entwurf (Empfänger, Betreff, Standardtext).
 *   • „Als PDF speichern"  → bestehende PDF-/Druck-Logik.
 *
 * Hinweis: mailto kann technisch KEINE Datei anhängen — das PDF muss der Nutzer
 * selbst anhängen (echter Versand mit Anhang ist als späterer Schritt geplant).
 *
 * "use client": window.open/mailto laufen nur im Browser (kein SSR-Crash, da
 * window erst im onClick-Handler angefasst wird).
 */
export default function DokAusgabe({
  betreff,
  mailTo,
  body,
  pdfHref,
  onSavePdf,
  pdfLabel = "Als PDF speichern",
}: {
  /** Betreff der Mail = Dokumenttyp + Bezug, z. B. "Nebenkostenabrechnung 2025 – Whg. 4". */
  betreff: string;
  /** Empfänger-Adresse (Mieter-E-Mail); leer/unbekannt → Entwurf ohne Empfänger. */
  mailTo?: string | null;
  /** Optionaler Mailtext; sonst Standardtext. */
  body?: string;
  /** PDF per GET öffnen (z. B. NK-Route). Alternativ onSavePdf nutzen. */
  pdfHref?: string;
  /** Eigene PDF-Aktion (z. B. ein Formular absenden). Vorrang vor pdfHref. */
  onSavePdf?: () => void;
  pdfLabel?: string;
}) {
  const standardBody =
    body ??
    `Guten Tag,\n\nim Anhang sende ich Ihnen: ${betreff}.\n\nMit freundlichen Grüßen`;

  // Empfänger-Adresse roh lassen, nur Betreff/Body kodieren.
  const mailtoHref =
    `mailto:${mailTo ?? ""}` +
    `?subject=${encodeURIComponent(betreff)}` +
    `&body=${encodeURIComponent(standardBody)}`;

  function savePdf() {
    if (onSavePdf) onSavePdf();
    else if (pdfHref) window.open(pdfHref, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href={mailtoHref}
          className="btn-gold"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Mail size={15} /> Per Mail versenden
        </a>
        <button
          type="button"
          onClick={savePdf}
          className="btn btn-outline"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <FileDown size={15} /> {pdfLabel}
        </button>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, textAlign: "right" }}>
        Mail: PDF bitte selbst anhängen (vorher „{pdfLabel}").
      </p>
    </div>
  );
}
