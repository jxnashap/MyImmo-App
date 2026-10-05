// Vorbereitete Mail für Freigabe-Links (Makler, Bank) — rein, im Browser nutzbar.
// MyImmo verschickt nichts: `mailto:` öffnet das Mailprogramm des Kunden mit Empfänger, Betreff,
// Link und Code. Die Adresse kommt nur hinein, wenn sie dem einfachen Muster entspricht — kein
// `?bcc=` durch die Hintertür (dieselbe Regel wie bei der Mahnung).
import { EMAIL } from "@/lib/mahnung";

export type ZugangsMail = {
  an: string | null;
  betreff: string;
  einleitung: string;
  link: string;
  code: string;
  ablauf: string;
  absender?: string | null;
};

export function zugangsMailText(o: ZugangsMail): string {
  const bis = new Date(o.ablauf).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  const gruss = o.absender?.trim() ? `Mit freundlichen Grüßen\n${o.absender.trim()}` : "Mit freundlichen Grüßen";
  return [
    "Guten Tag,",
    "",
    o.einleitung,
    o.link,
    "",
    `Zugangscode: ${o.code}`,
    "",
    `Der Link gilt bis ${bis}. Bitte leiten Sie Link und Code nicht weiter.`,
    "",
    gruss,
  ].join("\n");
}

export function zugangsMailLink(o: ZugangsMail): string {
  const an = o.an && EMAIL.test(o.an.trim()) ? o.an.trim() : "";
  return `mailto:${an}?subject=${encodeURIComponent(o.betreff)}&body=${encodeURIComponent(zugangsMailText(o).replace(/\n/g, "\r\n"))}`;
}
