// Der EINE Start-Knopf der öffentlichen Strecke (01.10.2026, Vorgabe des
// Betreibers: „auf die Kachel einfach Coming soon“).
//
// Solange die Registrierung geschlossen ist (`REGISTRIERUNG_OFFEN` in
// lib/preise.ts), gibt es keinen Anfrageweg mehr: Der Knopf ist eine nicht
// klickbare Fläche mit „Coming soon“ im Stil des Knopfs. Ein Knopf, der „bald“
// sagt und dann doch ein Registrierformular öffnet, wäre verwirrender als
// keiner. Wer einen Beta-Code hat, kommt über „Anmelden“ hinein.
//
// Bei offener Registrierung wird daraus wieder ein Link — derselbe Schalter
// stellt die ganze Strecke auf einmal um.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { REGISTRIERUNG_OFFEN, START_CTA } from "@/lib/preise";

export default function StartCta({
  className,
  style,
  href = "/anmelden",
  wunsch,
  children,
}: {
  className: string;
  style?: CSSProperties;
  /** Ziel bei offener Registrierung. Führt es NICHT zur Registrierung, bleibt es ein normaler Link. */
  href?: string;
  /** Beschriftung bei offener Registrierung (oder bei einem Ziel außerhalb der Registrierung). */
  wunsch?: string;
  /** Zusatz hinter der Beschriftung, z. B. ein Pfeil — nur am echten Link. */
  children?: ReactNode;
}) {
  if (REGISTRIERUNG_OFFEN || href !== "/anmelden") {
    return (
      <Link href={href} className={className} style={style}>
        {wunsch ?? START_CTA}{children}
      </Link>
    );
  }
  return (
    <span className={`${className} start-bald`} style={style} aria-disabled="true" title="MyImmo startet bald">
      {START_CTA}
    </span>
  );
}
