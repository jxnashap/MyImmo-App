// Mieterportal: Einladung an eine Adresse und Zustell-Prüfung (02.10.2026).
//
// Hintergrund: docs/zukunft/MIETERPORTAL-AUSBAU.md. Ein Dokument darf nie bei der
// falschen Person landen — und „zugestellt“ darf nur dastehen, wenn es jemand sehen kann.
// Reine Funktionen ohne Datenbank und ohne React, damit sie prüfbar sind; die Actions
// in lib/actions/einladung.ts und lib/actions/dokumente.ts rufen sie auf.
import { istEmail, normalisiereEmail } from "@/lib/newsletter";

/**
 * Die Adresse wird ZWEIMAL eingegeben. Ein Tippfehler, der eine existierende fremde
 * Adresse trifft, ist der eine Weg, auf dem die Bindung an die Adresse nicht schützt:
 * Der Fremde besitzt die Adresse ja und kann sich damit anmelden.
 */
export function pruefeEinladungsAdresse(
  email: string,
  wiederholung: string,
): { ok: true; email: string } | { ok: false; fehler: string } {
  const a = normalisiereEmail(email ?? "");
  const b = normalisiereEmail(wiederholung ?? "");
  if (!istEmail(a)) return { ok: false, fehler: "Bitte eine gültige E-Mail-Adresse des Mieters eintragen." };
  if (a !== b) return { ok: false, fehler: "Die beiden Adressen stimmen nicht überein — bitte genau prüfen." };
  return { ok: true, email: a };
}

/**
 * Bis wann ein Ex-Mieter sein Portal noch sieht: 31.12. des Jahres NACH dem Auszug
 * (Entscheidung des Betreibers, 02.10.2026) — so lange muss die NK-Abrechnung für das
 * Auszugsjahr zugehen (§ 556 Abs. 3 BGB). Spiegelt `mieter_zugang_endet()` in der
 * Datenbank (Migration 20261002120000), die es tatsächlich durchsetzt.
 */
export function zugangEndet(mietende: string | null | undefined): string | null {
  if (!mietende) return null;
  const jahr = Number(mietende.slice(0, 4));
  return Number.isFinite(jahr) ? `${jahr + 1}-12-31` : null;
}

export type ZustellLage = {
  /** Gibt es ein Portal-Konto, das mit diesem Mieter verknüpft ist? */
  verbunden: boolean;
  /** Adresse dieses Kontos (null bei Verknüpfungen vor dem 02.10.2026). */
  email: string | null;
  mietbeginn: string | null;
  mietende: string | null;
  /** Abrechnungsjahr — nur bei der NK-Abrechnung; null bei anderen Dokumenten (kein Jahresbezug). */
  jahr: number | null;
  /** Ist für dieses Jahr (bzw. dieses Dokument) schon eine aktive Zustellung da? */
  schonZugestellt: boolean;
  /** Stichtag (ISO, deutsche Zeit) — für das Zugangsende nach dem Auszug. */
  heute: string;
};

export type ZustellPruefung = { sperre: string | null; warnungen: string[] };

/**
 * Darf ein Dokument (NK-Abrechnung oder ein anderes Archiv-Dokument) ins Mieterportal
 * zugestellt werden?
 * Sperre = geht nicht (der Server lehnt ab). Warnungen = Dialog zeigt sie an.
 */
export function pruefeZustellung(l: ZustellLage): ZustellPruefung {
  const warnungen: string[] = [];
  if (!l.verbunden) {
    return {
      sperre:
        "Dieser Mieter hat kein verbundenes Portal-Konto — das Dokument würde niemand sehen. " +
        "Bitte nur speichern und per Post oder E-Mail zustellen.",
      warnungen,
    };
  }
  const ende = zugangEndet(l.mietende);
  if (ende && l.heute.slice(0, 10) > ende) {
    const [j, m, t] = ende.split("-");
    return {
      sperre: `Der Portal-Zugang dieses Ex-Mieters ist am ${t}.${m}.${j} abgelaufen — er sieht nichts mehr. Bitte per Post oder E-Mail zustellen.`,
      warnungen,
    };
  }
  if (l.jahr !== null) {
    const von = `${l.jahr}-01-01`;
    const bis = `${l.jahr}-12-31`;
    if (l.mietbeginn && l.mietbeginn.slice(0, 10) > bis) {
      return { sperre: `Das Mietverhältnis beginnt erst nach ${l.jahr} — diese Abrechnung gehört nicht zu diesem Mieter.`, warnungen };
    }
    if (l.mietende && l.mietende.slice(0, 10) < von) {
      return { sperre: `Das Mietverhältnis endete vor ${l.jahr} — diese Abrechnung gehört nicht zu diesem Mieter.`, warnungen };
    }
  }
  if (!l.email) {
    warnungen.push("Das Portal-Konto wurde vor der Adress-Bindung verknüpft — die Adresse ist unbekannt. Bitte auf der Mieterseite prüfen.");
  }
  if (l.schonZugestellt && l.jahr !== null) {
    warnungen.push(`Für ${l.jahr} ist bereits eine Abrechnung im Portal sichtbar. Eine zweite stiftet Verwirrung — vorher die alte zurückziehen?`);
  }
  return { sperre: null, warnungen };
}

/**
 * Einladungsmail. Bewusst OHNE Anschrift, Wohnung oder Mietdaten: Ging sie trotz
 * Doppeleingabe an eine falsche Adresse, erfährt der Empfänger nichts über den Mieter.
 */
export function einladungsMail(opts: {
  vermieter: string | null;
  link: string;
  code: string;
  gueltigBis: string;
}): { betreff: string; text: string; html: string } {
  const von = opts.vermieter?.trim() || "Ihr Vermieter";
  const bis = new Date(opts.gueltigBis).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  const betreff = `${von} lädt Sie zum Mieterportal ein`;
  const text = [
    "Guten Tag,",
    "",
    `${von} nutzt MyImmo und lädt Sie in das Mieterportal ein. Dort sehen Sie Ihre Mietdaten,`,
    "melden Anliegen und Zählerstände und erhalten Dokumente wie die Nebenkostenabrechnung.",
    "",
    `1. Diesen Link öffnen: ${opts.link}`,
    `2. Mit GENAU DIESER E-Mail-Adresse registrieren — die Einladung gilt nur für sie.`,
    `3. Der Code ist schon eingetragen; falls nicht: ${opts.code}`,
    "",
    `Die Einladung gilt bis zum ${bis} und nur einmal.`,
    "",
    "Kennen Sie den Absender nicht, ignorieren Sie diese E-Mail einfach.",
    "",
    "MyImmo — Privates Immobilien-Management",
    "https://www.myimmoapp.de",
  ].join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#faf8f4;font-family:Arial,Helvetica,sans-serif;color:#23211c">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e1d4;border-radius:12px;padding:28px">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;margin-bottom:4px">My<span style="color:#b8902b;font-style:italic">Immo</span></div>
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9b968a;margin-bottom:22px">Privates Immobilien-Management</div>
    <h1 style="font-size:19px;margin:0 0 12px">Einladung zum Mieterportal</h1>
    <p style="font-size:15px;line-height:1.65;color:#6b675e;margin:0 0 16px">
      ${esc(von)} nutzt MyImmo und lädt Sie in das Mieterportal ein. Dort sehen Sie Ihre Mietdaten,
      melden Anliegen und Zählerstände und erhalten Dokumente wie die Nebenkostenabrechnung.
    </p>
    <p style="margin:0 0 18px">
      <a href="${esc(opts.link)}" style="display:inline-block;background:#b8902b;color:#1a1a17;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px">Zum Mieterportal</a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#23211c;margin:0 0 8px">
      <strong>Wichtig:</strong> Registrieren Sie sich mit <strong>genau dieser E-Mail-Adresse</strong> — die Einladung gilt nur für sie.
    </p>
    <p style="font-size:13px;line-height:1.6;color:#9b968a;margin:0 0 8px">
      Ihr Code (falls er nicht schon eingetragen ist): <strong style="color:#23211c;letter-spacing:.06em">${esc(opts.code)}</strong><br>
      Gültig bis ${esc(bis)}, nur einmal verwendbar.
    </p>
    <p style="font-size:13px;line-height:1.6;color:#9b968a;margin:0;border-top:1px solid #e7e1d4;padding-top:14px">
      Kennen Sie den Absender nicht, ignorieren Sie diese E-Mail einfach.
    </p>
  </div>
</body></html>`;
  return { betreff, text, html };
}

/**
 * S7 (03.10.2026): Für wie viele Portal-Konten wird ein freigegebener Beleg sichtbar?
 * Spiegelt `mieter_beleg_sichtbar()` (Migration 20261002120000): Konto mit einem Mieter
 * desselben Objekts, Zugang nicht abgelaufen, Belegdatum in dessen Mietzeit (ganze
 * Kalenderjahre). Vorher sagte der Schalter nur „alle Mieter des Objekts“ — wie viele das
 * sind und ob überhaupt jemand, blieb offen.
 */
export function belegReichweite(
  beleg: { prop_id: string | null; buchungsdatum: string | null },
  mieter: { id: string; prop_id: string | null; mietbeginn: string | null; mietende: string | null }[],
  zugaenge: { mieter_id: string; user_id: string }[],
  heute: string,
): number {
  if (!beleg.prop_id) return 0;
  const d = beleg.buchungsdatum?.slice(0, 10) ?? null;
  const konten = new Set<string>();
  for (const z of zugaenge) {
    const m = mieter.find((x) => x.id === z.mieter_id);
    if (!m || m.prop_id !== beleg.prop_id) continue;
    const ende = zugangEndet(m.mietende);
    if (ende && heute > ende) continue;
    if (d && m.mietbeginn && d < `${m.mietbeginn.slice(0, 4)}-01-01`) continue;
    if (d && m.mietende && d > `${m.mietende.slice(0, 4)}-12-31`) continue;
    konten.add(z.user_id);
  }
  return konten.size;
}

/**
 * S4 (03.10.2026): Sieht eine Änderung an einer Mieter-Zeile nach einem NEUEN Mieter aus?
 * Anderer Vor- oder Nachname oder anderer Mietbeginn. Hängt an der Zeile ein Portal-Konto,
 * sähe der bisherige Mieter sonst alles, was künftig für den neuen bestimmt ist (F1).
 * Groß-/Kleinschreibung und Leerzeichen zählen nicht — „anna “ → „Anna“ ist eine Korrektur.
 * Ein bisher LEERES Feld zu füllen ist kein Wechsel.
 */
export function mieterwechselVerdacht(
  alt: { vorname: string | null; nachname: string | null; mietbeginn: string | null },
  neu: { vorname: string | null; nachname: string | null; mietbeginn: string | null },
): boolean {
  const n = (s: string | null) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const anders = (a: string | null, b: string | null) => n(a) !== "" && n(a) !== n(b);
  return anders(alt.vorname, neu.vorname) || anders(alt.nachname, neu.nachname) || anders(alt.mietbeginn, neu.mietbeginn);
}
