// Vertreter / Bevollmächtigter (02.10.2026) — reine Helfer, ohne Datenbank und ohne React.
//
// Der Vertreter ist eine Vertrauensperson, die für den Vermieter bei Bank und Notar handelt
// (typisch: Vermieter im Ausland, Originale vorlegen, Darlehen unterschreiben). Er hat KEINEN
// Zugang zur App. MyImmo hält die Angaben fest und erinnert — es formuliert keine Vollmacht und
// beurteilt nicht, ob sie im Einzelfall reicht. Die Hinweise sagen deshalb „meist“ und „vorher
// nachfragen“; die eine feste Regel (§ 29 GBO) ist Gesetz, keine Einschätzung.

export const VOLLMACHT_ARTEN = {
  general: "Generalvollmacht",
  bank: "Bankvollmacht (Konto, Unterlagen)",
  darlehen: "Vollmacht für Darlehensvertrag",
  grundbuch: "Grundbuch-/Grundschuldvollmacht",
  immobilie: "Verwaltung der Immobilien",
  sonstige: "Sonstige",
} as const;
export type VollmachtArt = keyof typeof VOLLMACHT_ARTEN;

export const VOLLMACHT_FORMEN = {
  privatschriftlich: "Privatschriftlich (nur unterschrieben)",
  bankformular: "Formular der Bank",
  beglaubigt: "Unterschrift öffentlich beglaubigt (Notar/Konsulat)",
  beurkundet: "Notariell beurkundet",
} as const;
export type VollmachtForm = keyof typeof VOLLMACHT_FORMEN;

/** Erlaubte Dateien für den Scan der Vollmacht. */
export const VOLLMACHT_DATEITYPEN = ["application/pdf", "image/jpeg", "image/png"] as const;
export const VOLLMACHT_MAX_BYTES = 8 * 1024 * 1024;

export type Vertreter = {
  id: string;
  vorname: string | null;
  nachname: string;
  beziehung: string | null;
  geburtsdatum: string | null;
  geburtsort: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  email: string | null;
  telefon: string | null;
  vollmacht_art: VollmachtArt;
  vollmacht_form: VollmachtForm;
  umfang: string | null;
  ausgestellt_am: string | null;
  gueltig_bis: string | null;
  widerrufen_am: string | null;
  im_ausland_unterzeichnet: boolean;
  apostille: boolean;
  beglaubigt_durch: string | null;
  original_bei: string | null;
  notiz: string | null;
  datei_name: string | null;
  datei_size: number | null;
};

/** Spalten für die Liste — ohne `datei_data` (Base64, lädt die Datei-Route einzeln). */
export const VERTRETER_SPALTEN =
  "id,vorname,nachname,beziehung,geburtsdatum,geburtsort,strasse,plz,ort,land,email,telefon," +
  "vollmacht_art,vollmacht_form,umfang,ausgestellt_am,gueltig_bis,widerrufen_am," +
  "im_ausland_unterzeichnet,apostille,beglaubigt_durch,original_bei,notiz,datei_name,datei_size";

export type VollmachtStatus = "gueltig" | "laeuft_ab" | "abgelaufen" | "widerrufen";

/** Tage zwischen zwei ISO-Daten (b − a), auf den Zahlen, nie über Ortszeit. */
function tage(a: string, b: string): number {
  const z = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((z(b) - z(a)) / 86_400_000);
}

export const ABLAUF_WARN_TAGE = 60;

export function vollmachtStatus(v: Pick<Vertreter, "gueltig_bis" | "widerrufen_am">, heute: string): VollmachtStatus {
  if (v.widerrufen_am && v.widerrufen_am.slice(0, 10) <= heute) return "widerrufen";
  if (v.gueltig_bis) {
    const rest = tage(heute, v.gueltig_bis);
    if (rest < 0) return "abgelaufen";
    if (rest <= ABLAUF_WARN_TAGE) return "laeuft_ab";
  }
  return "gueltig";
}

export type Hinweis = { art: "warn" | "info"; text: string };

/** Was an dieser Vollmacht fehlt oder zu beachten ist — Reihenfolge: Warnungen zuerst. */
export function vollmachtHinweise(v: Vertreter, heute: string): Hinweis[] {
  const h: Hinweis[] = [];
  const status = vollmachtStatus(v, heute);
  const datumDe = (s: string) => s.slice(0, 10).split("-").reverse().join(".");

  if (status === "widerrufen") {
    h.push({ art: "warn", text: "Widerrufen — Bank und ggf. Notar über den Widerruf informieren und die Vollmachtsurkunde zurückverlangen (§ 175 BGB)." });
    return h;
  }
  if (status === "abgelaufen") h.push({ art: "warn", text: `Abgelaufen am ${datumDe(v.gueltig_bis!)}.` });
  if (status === "laeuft_ab") h.push({ art: "warn", text: `Läuft am ${datumDe(v.gueltig_bis!)} ab.` });

  const grundbuch = v.vollmacht_art === "grundbuch" || v.vollmacht_art === "general";
  if (grundbuch && (v.vollmacht_form === "privatschriftlich" || v.vollmacht_form === "bankformular")) {
    h.push({ art: "warn", text: "Für Erklärungen gegenüber dem Grundbuchamt (z. B. Grundschuld) genügt eine nur unterschriebene Vollmacht nicht — dort ist mindestens eine öffentlich beglaubigte Unterschrift nötig (§ 29 GBO)." });
  }
  if (v.vollmacht_art === "darlehen" && v.vollmacht_form === "privatschriftlich") {
    h.push({ art: "info", text: "Banken verlangen für den Darlehensvertrag meist ihr eigenes Vollmachtsformular oder eine beglaubigte Vollmacht — vorher bei der Bank nachfragen." });
  }
  if (v.im_ausland_unterzeichnet && !v.apostille && (v.vollmacht_form === "beglaubigt" || v.vollmacht_form === "beurkundet")) {
    h.push({ art: "info", text: "Im Ausland beglaubigt: Deutsche Stellen verlangen dafür meist eine Apostille — außer eine deutsche Auslandsvertretung hat beglaubigt. Je nach Land gilt anderes; beim Notar nachfragen." });
  }
  if (!v.datei_name) h.push({ art: "info", text: "Noch kein Scan der Vollmacht hinterlegt." });
  if (!v.original_bei) h.push({ art: "info", text: "Notiere, wo das Original liegt — Bank und Notar verlangen meist das Original oder eine Ausfertigung." });
  return h;
}

export function vertreterName(v: Pick<Vertreter, "vorname" | "nachname">): string {
  return [v.vorname, v.nachname].filter(Boolean).join(" ");
}

/** Was der Kreditantrag über den Vertreter druckt — ohne Scan, mit lesbaren Daten. */
export type KreditVertreterDaten = {
  name: string; beziehung: string | null; geburt: string | null; anschrift: string | null;
  kontakt: string | null; art: string; form: string; ausgestellt: string | null;
  gueltigBis: string | null; beglaubigtDurch: string | null; umfang: string | null;
};

/**
 * Bereitet einen Vertreter für den Kreditantrag auf. Eine widerrufene oder abgelaufene
 * Vollmacht geht NICHT an die Bank — dort stünde sonst ein Bevollmächtigter, der keiner mehr ist.
 */
export function kreditVertreter(v: Vertreter, heute: string): KreditVertreterDaten | { fehler: string } {
  const status = vollmachtStatus(v, heute);
  if (status === "widerrufen") return { fehler: "Die Vollmacht dieses Vertreters ist widerrufen." };
  if (status === "abgelaufen") return { fehler: "Die Vollmacht dieses Vertreters ist abgelaufen." };
  const d = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join(".") : null);
  const geburt = [d(v.geburtsdatum), v.geburtsort].filter(Boolean).join(" in ") || null;
  return {
    name: vertreterName(v),
    beziehung: v.beziehung,
    geburt,
    anschrift: [v.strasse, [v.plz, v.ort].filter(Boolean).join(" "), v.land].filter(Boolean).join(", ") || null,
    kontakt: [v.telefon, v.email].filter(Boolean).join(" · ") || null,
    art: VOLLMACHT_ARTEN[v.vollmacht_art] ?? v.vollmacht_art,
    form: VOLLMACHT_FORMEN[v.vollmacht_form] ?? v.vollmacht_form,
    ausgestellt: d(v.ausgestellt_am),
    gueltigBis: d(v.gueltig_bis),
    beglaubigtDurch: [v.beglaubigt_durch, v.apostille ? "mit Apostille" : null].filter(Boolean).join(" · ") || null,
    umfang: v.umfang,
  };
}
