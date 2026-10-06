// Neuigkeiten aus dem Mieterportal fürs Dashboard (02.10.2026, Idee des Betreibers:
// „Grafik halbieren, daneben die Neuigkeiten aus dem Mieterportal, darunter die Termine“).
//
// Reine Funktion ohne Datenbank: Die Seite reicht die Zeilen herein.
//
// ABGRENZUNG ZU „Termine & Aufgaben“ (lib/heute.ts), damit nichts doppelt dasteht: Dort stehen
// Dinge, die eine HANDLUNG verlangen (offene Anliegen, Zählerstände, Mieten, Fristen). Hier
// steht, was PASSIERT ist — Nachricht vom Mieter, Termin bestätigt, Dokument bestätigt,
// Angebot eingegangen, Rückmeldung einer Firma, Antrag des Hausmeisters, neue Bewerbung.

import { vorgangUrl } from "@/lib/anliegenListe";
import { eingangOrt } from "@/lib/freigabeEingang";

export type NeuigkeitArt = "nachricht" | "termin" | "dokument" | "angebot" | "firma" | "freigabe" | "bewerbung" | "hausmeister" | "eingang";

export type Neuigkeit = {
  art: NeuigkeitArt;
  text: string;
  sub: string;
  href: string;
  /** ISO-Zeitpunkt, nach dem sortiert wird (neueste zuerst). */
  zeit: string;
};

export type NeuigkeitenQuelle = {
  /** Verlaufseinträge (anliegen_ereignisse) — nur die des Mieters zählen. */
  ereignisse: { anliegen_id: string; autor_rolle: string; art: string; text: string | null; created_at: string }[];
  /** Titel und Mieter je Anliegen. */
  anliegen: Map<string, { titel: string; mieter: string }>;
  /** Bestätigte oder gelesene Zustellungen (Dokument/Mitteilung). */
  zustellungen: { titel: string | null; art: string; mieter: string; bestaetigt_am: string | null }[];
  /** Eingegangene Angebote zu Angebotsanfragen. */
  angebote: { firma: string; betrag: number; created_at: string }[];
  /** Rückmeldungen von Firmen über den Auftrags-Link. */
  rueckmeldungen: { art: string; firma: string | null; auftrag: string; created_at: string }[];
  /** Aufträge des Hausmeisters, die auf Freigabe warten (`fachbetrieb`: er schlägt eine Firma vor). */
  freigaben: { titel: string; created_at: string; fachbetrieb?: boolean }[];
  /** Notizen und Fotos des Hausmeisters am Auftrag (05.10.2026). Fehlt bei älteren Aufrufern. */
  hausmeister?: { art: string; auftrag: string; created_at: string }[];
  /**
   * Dateien, die Bank oder Makler über ihren Link geschickt haben und die noch nicht entschieden
   * sind (06.10.2026). Wie die Freigaben ohne Altersgrenze — sie warten auf den Eigentümer.
   */
  eingang?: { art: "bank" | "makler"; propId: string | null; absender: string | null; datei_name: string; created_at: string }[];
  /** Neue Bewerbungen (status „neu“). */
  bewerbungen: { name: string | null; created_at: string }[];
};

/** Wie weit zurück „neu“ reicht. */
export const NEUIGKEITEN_TAGE = 14;

const RUECKMELDUNG: Record<string, string> = {
  zusage: "hat den Auftrag angenommen",
  absage: "hat den Auftrag abgesagt",
  rueckfrage: "hat eine Rückfrage",
};

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/** ISO-Datum minus n Tage — auf den Zahlen, ohne Ortszeit. */
function grenzeVor(heute: string, tage: number): string {
  const [y, m, d] = heute.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - tage)).toISOString().slice(0, 10);
}

export function bauePortalNeuigkeiten(q: NeuigkeitenQuelle, heute: string, grenze = 6): { liste: Neuigkeit[]; gesamt: number } {
  const ab = grenzeVor(heute, NEUIGKEITEN_TAGE);
  const neu = (zeit: string | null | undefined) => !!zeit && zeit.slice(0, 10) >= ab;
  const out: Neuigkeit[] = [];

  for (const e of q.ereignisse) {
    if (e.autor_rolle !== "mieter" || !neu(e.created_at)) continue;
    const a = q.anliegen.get(e.anliegen_id);
    if (e.art === "nachricht") {
      out.push({ art: "nachricht", text: `Nachricht von ${a?.mieter ?? "Mieter"}`, sub: a?.titel ?? "Anliegen", href: vorgangUrl(e.anliegen_id), zeit: e.created_at });
    } else if (e.art === "termin") {
      out.push({ art: "termin", text: e.text ?? "Termin bestätigt", sub: [a?.mieter, a?.titel].filter(Boolean).join(" · "), href: vorgangUrl(e.anliegen_id), zeit: e.created_at });
    }
  }
  for (const z of q.zustellungen) {
    if (!neu(z.bestaetigt_am)) continue;
    out.push({
      art: "dokument",
      text: `${z.mieter} hat bestätigt`,
      sub: z.titel ?? (z.art === "mitteilung" ? "Mitteilung" : "Dokument"),
      href: z.art === "mitteilung" ? "/anliegen?tab=haus" : "/archiv",
      zeit: z.bestaetigt_am!,
    });
  }
  for (const g of q.angebote) {
    if (!neu(g.created_at)) continue;
    out.push({ art: "angebot", text: `Angebot von ${g.firma}`, sub: euro(g.betrag), href: "/anliegen", zeit: g.created_at });
  }
  for (const r of q.rueckmeldungen) {
    if (!neu(r.created_at)) continue;
    out.push({ art: "firma", text: `${r.firma ?? "Firma"} ${RUECKMELDUNG[r.art] ?? "hat geantwortet"}`, sub: r.auftrag, href: "/anliegen?tab=service", zeit: r.created_at });
  }
  for (const f of q.freigaben) {
    out.push({
      art: "freigabe",
      text: f.fachbetrieb ? "Hausmeister: Fachbetrieb nötig" : "Hausmeister bittet um Freigabe",
      sub: f.titel,
      href: "/anliegen?tab=service",
      zeit: f.created_at,
    });
  }
  for (const h of q.hausmeister ?? []) {
    if (!neu(h.created_at)) continue;
    out.push({ art: "hausmeister", text: h.art === "foto" ? "Hausmeister hat ein Foto angehängt" : "Notiz vom Hausmeister", sub: h.auftrag, href: "/anliegen?tab=service", zeit: h.created_at });
  }
  for (const e of q.eingang ?? []) {
    const wer = e.art === "bank" ? "Bank" : "Makler";
    out.push({
      art: "eingang",
      text: `${wer} hat ein Dokument geschickt${e.absender ? ` (${e.absender})` : ""}`,
      sub: e.datei_name,
      href: eingangOrt(e.art, e.propId),
      zeit: e.created_at,
    });
  }
  for (const b of q.bewerbungen) {
    if (!neu(b.created_at)) continue;
    out.push({ art: "bewerbung", text: `Neue Bewerbung${b.name ? ` von ${b.name}` : ""}`, sub: "Mietinteressent", href: "/anliegen?tab=bewerbungen", zeit: b.created_at });
  }

  out.sort((a, b) => b.zeit.localeCompare(a.zeit));
  return { liste: out.slice(0, grenze), gesamt: out.length };
}
