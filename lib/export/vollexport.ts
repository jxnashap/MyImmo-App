// Vollständiger Datenexport (B05, Prüfstand 11.10.2026).
//
// VORHER (app/api/export/alles/route.ts bis 11.10.2026):
//   · ~30 Tabellen fehlten (u. a. Nebenkosten am Objekt, Sanierungsprojekte, Zustellungen,
//     Vertreter, Freigaben, Anhänge an Anliegen) — die Liste war seit Juli nicht nachgezogen.
//   · `.limit(10000)` bzw. `.limit(500)` — PostgREST liefert ohnehin höchstens 1.000 Zeilen je
//     Anfrage, mehr kam nie an, ohne Hinweis.
//   · Belege im Storage-Bucket `belege` (seit Juli der Normalfall) wurden nie gelesen — der
//     Datensatz verwies auf eine Datei, die im ZIP fehlte.
//   · Dateien hießen nach ihrem Originalnamen: zwei „Rechnung.pdf“ → eine überschrieb die andere.
//   · Ein Abfragefehler wurde mit `continue` übergangen; das ZIP sagte trotzdem „enthält alles“.
//
// JETZT:
//   · EINE Liste je Rolle (`EXPORT_TABELLEN`); `tests/vollexport.test.ts` verlangt für JEDE Tabelle
//     aus den Migrationen einen Eintrag hier oder eine begründete Ausnahme.
//   · Jede Tabelle wird über `ladeAlle()` vollständig geladen (stabile Sortierung über den Schlüssel).
//   · Dateien (Base64-Spalten UND Storage) liegen unter `dateien/<tabelle>/<id>_<spalte>…` — eindeutig
//     durch die Zeilen-ID; die CSV-Zelle nennt genau diesen Pfad (Referenz bleibt erhalten).
//   · `manifest.json`: Zeilen je Tabelle, je Datei Quelle, Größe, SHA-256 — und JEDER Fehler.
//     Fehlt etwas, heißt das ZIP `…-UNVOLLSTAENDIG-…` und LIESMICH beginnt mit einer Warnung.
//   · Es heißt „Export“, nicht „Backup“: Ein Rückspielen ist nicht geprüft (siehe LIESMICH).

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { decrypt, decryptNullable } from "@/lib/crypto/secure";
import { csvZelle } from "@/lib/csv";
import { DatenUnvollstaendig, ladeAlle, stapel } from "@/lib/db/ladeAlle";

type Row = Record<string, unknown>;
export type ExportRolle = "vermieter" | "mieter" | "service";

/** Datei in einer Spalte (Base64 oder Data-URI, ggf. verschlüsselt). `name`: Spalte mit dem Originalnamen. */
type DateiSpalte = { spalte: string; name?: string };

export type ExportTabelle = {
  name: string;
  /** Spalte, über die die Zeile dem Konto gehört. Fehlt sie, kommt die Tabelle über `eltern`. */
  besitz?: string;
  /** Kind-Tabelle ohne eigene Besitz-Spalte: Zeilen zu den bereits geladenen Eltern-Zeilen. */
  eltern?: { tabelle: string; spalte: string; elternSpalte: string };
  /** Eindeutiger Schlüssel für die stabile Sortierung beim Blättern. */
  schluessel: string[];
  dateien?: DateiSpalte[];
  /**
   * Pfad-Spalte im Storage-Bucket (Kosten-Belege, Belegeingang). `wenn`: nur für Zeilen, auf die das
   * zutrifft — ein GEBUCHTER Eingang teilt seine Datei mit der Buchung und liegt dort schon.
   */
  storage?: { spalte: string; bucket: string; wenn?: (r: Record<string, unknown>) => boolean };
  /** Mit DATA_ENCRYPTION_KEY verschlüsselte Textspalten — im Export entschlüsselt (es sind DEINE Daten). */
  verschluesselt?: string[];
  /** Spalten, die nicht in den Export gehören (Sicherheitsmerkmale, technische Indizes). */
  ohne?: string[];
};

const V = (name: string, besitz: string, extra: Partial<ExportTabelle> = {}): ExportTabelle => ({
  name, besitz, schluessel: ["id"], ...extra,
});

export const EXPORT_TABELLEN: Record<ExportRolle, ExportTabelle[]> = {
  vermieter: [
    V("properties", "user_id"),
    V("mieter", "user_id", { verschluesselt: ["iban", "kaution_bank"] }),
    V("miet_zeitraeume", "user_id"), V("mieter_positionen", "user_id"),
    V("einnahmen", "user_id"),
    V("kosten", "user_id", { dateien: [{ spalte: "rechnung_data", name: "rechnung_name" }], storage: { spalte: "rechnung_path", bucket: "belege" } }),
    // Belegeingang (Ablauf B): noch nicht gebuchte Belege samt Datei; gebuchte liegen zusätzlich bei den Kosten.
    V("beleg_eingang", "user_id", { storage: { spalte: "datei_pfad", bucket: "belege", wenn: (r) => r.status !== "gebucht" } }),
    V("kredite", "user_id", { verschluesselt: ["darlnr"] }),
    V("verbrauch", "user_id"), V("termine", "user_id"),
    V("notizen", "user_id", { dateien: [{ spalte: "datei_data", name: "datei_name" }] }),
    V("wiederkehrende_buchungen", "user_id"), V("kalkulationen", "user_id"),
    V("dokument_vorlagen", "user_id"), V("vermieter_profil", "user_id"),
    V("nk_co2", "user_id"), V("nk_objekt_jahr", "user_id"), V("nk_objekt_kosten", "user_id"),
    V("bewertung_historie", "user_id"), V("vergleichsangebote", "user_id"),
    V("firmen", "user_id"), V("bewerber_links", "user_id"),
    V("bewerbungen", "user_id", { dateien: [{ spalte: "unterschrift_data" }] }),
    V("bewerbung_dateien", "user_id", { dateien: [{ spalte: "data", name: "name" }] }),
    V("abos", "user_id"),
    { name: "abo_zahlungen", besitz: "user_id", schluessel: ["transaktion_id"] },
    V("sanierungsprojekte", "user_id"),
    V("selbstauskunft", "user_id", { verschluesselt: ["daten_enc"] }),
    V("beleihung_dokumente", "user_id", { dateien: [{ spalte: "datei_data", name: "datei_name" }] }),
    { name: "beleihung_freigaben", besitz: "user_id", schluessel: ["token"], ohne: ["code_hash"] },
    { name: "beleihung_rueckmeldungen", eltern: { tabelle: "beleihung_freigaben", spalte: "token", elternSpalte: "token" }, schluessel: ["id"] },
    V("makler_dokumente", "user_id", { dateien: [{ spalte: "datei_data", name: "datei_name" }] }),
    { name: "makler_freigaben", besitz: "user_id", schluessel: ["token"], ohne: ["code_hash"] },
    V("freigabe_abrufe", "user_id"),
    V("freigabe_eingang", "user_id", { dateien: [{ spalte: "datei_data", name: "datei_name" }] }),
    V("freigabe_termine", "user_id"),
    { name: "frist_ausgeblendet", besitz: "user_id", schluessel: ["user_id", "schluessel"] },
    { name: "unterschriften", besitz: "user_id", schluessel: ["user_id"], dateien: [{ spalte: "data" }] },
    V("vertreter", "user_id", { dateien: [{ spalte: "datei_data", name: "datei_name" }] }),
    V("ibans", "user_id", { verschluesselt: ["iban", "inhaber"], ohne: ["iban_bidx"] }),
    { name: "konto_freischaltung", besitz: "user_id", schluessel: ["user_id"] },
    { name: "nutzer_rollen", besitz: "user_id", schluessel: ["user_id"] },
    V("anliegen", "vermieter_id"),
    { name: "anliegen_ereignisse", eltern: { tabelle: "anliegen", spalte: "anliegen_id", elternSpalte: "id" }, schluessel: ["id"] },
    { name: "anliegen_dateien", eltern: { tabelle: "anliegen", spalte: "anliegen_id", elternSpalte: "id" }, schluessel: ["id"], dateien: [{ spalte: "daten", name: "name" }] },
    V("vermieter_anfragen", "vermieter_id"),
    V("zaehlerstand_meldungen", "vermieter_id", { dateien: [{ spalte: "foto_data", name: "foto_name" }] }),
    V("einladungscodes", "vermieter_id"),
    V("auftraege", "vermieter_id", { dateien: [{ spalte: "rechnung_data", name: "rechnung_name" }] }),
    V("auftrag_notizen", "vermieter_id", { dateien: [{ spalte: "datei_data", name: "datei_name" }] }),
    { name: "auftrag_rueckmeldungen", eltern: { tabelle: "auftraege", spalte: "auftrag_id", elternSpalte: "id" }, schluessel: ["id"] },
    V("angebotsanfragen", "vermieter_id"),
    { name: "angebote", eltern: { tabelle: "angebotsanfragen", spalte: "anfrage_id", elternSpalte: "id" }, schluessel: ["id"] },
    V("zustellungen", "vermieter_id"),
    { name: "gebaeude_infos", besitz: "vermieter_id", schluessel: ["prop_id"] },
    { name: "mieter_zugaenge", besitz: "vermieter_id", schluessel: ["user_id", "mieter_id"] },
    { name: "service_zugaenge", besitz: "vermieter_id", schluessel: ["user_id", "vermieter_id"] },
    { name: "service_objekte", besitz: "vermieter_id", schluessel: ["service_user_id", "prop_id"] },
  ],
  // Mieter/Service bekommen NUR, was zu ihrem eigenen Zugang gehört. Die Stammdaten über sie gehören
  // dem Vermieter — er ist der Verantwortliche, das Auskunftsersuchen richtet sich an ihn (siehe /avv).
  mieter: [
    V("anliegen", "mieter_user_id"),
    { name: "anliegen_dateien", eltern: { tabelle: "anliegen", spalte: "anliegen_id", elternSpalte: "id" }, schluessel: ["id"], dateien: [{ spalte: "daten", name: "name" }] },
    V("anliegen_ereignisse", "autor_id"),
    V("zaehlerstand_meldungen", "mieter_user_id", { dateien: [{ spalte: "foto_data", name: "foto_name" }] }),
    { name: "mieter_zugaenge", besitz: "user_id", schluessel: ["user_id", "mieter_id"] },
    { name: "konto_freischaltung", besitz: "user_id", schluessel: ["user_id"] },
    { name: "nutzer_rollen", besitz: "user_id", schluessel: ["user_id"] },
  ],
  service: [
    V("auftraege", "service_user_id", { dateien: [{ spalte: "rechnung_data", name: "rechnung_name" }] }),
    V("auftrag_notizen", "autor_id", { dateien: [{ spalte: "datei_data", name: "datei_name" }] }),
    { name: "service_zugaenge", besitz: "user_id", schluessel: ["user_id", "vermieter_id"] },
    { name: "konto_freischaltung", besitz: "user_id", schluessel: ["user_id"] },
    { name: "nutzer_rollen", besitz: "user_id", schluessel: ["user_id"] },
  ],
};

/** Tabellen, die BEWUSST nicht im Export stehen — mit Grund (der Test verlangt einen). */
export const EXPORT_AUSNAHMEN: Record<string, string> = {
  mfa_wiederherstellung: "Sicherheitsmerkmal (nur Hashes der Wiederherstellungscodes) — ohne Nutzen für dich, mit Risiko bei Weitergabe",
  zugriff_limit: "technische Versuchsbremse, nur HMAC-Kennzeichen, kein Konto-Bezug",
  registrierung_freigaben: "an eine E-Mail-Adresse gebunden, verfällt nach 14 Tagen",
  newsletter_anmeldungen: "an eine E-Mail-Adresse gebunden, nicht an das Konto",
  billing_einstellungen: "Systemschalter, kein Konto-Bezug",
  regional_kennzahlen: "Marktdaten, kein Konto-Bezug",
  bank_auth_anfragen: "seit 29.08.2026 gedroppt",
  bank_umsaetze: "seit 29.08.2026 gedroppt",
  bankverbindungen: "seit 29.08.2026 gedroppt",
  demo_seed: "Schema der Demo-Vorlage, kein Nutzerkonto",
  nk_co: "Teil von nk_co2 (Namensrest beim Durchsuchen)",
};

/** Abfrage-Schnittstelle, die der Supabase-Client und der Prüfstand gleichermaßen erfüllen. */
type Abfrage = {
  select(spalten: string): Abfrage;
  eq(spalte: string, wert: unknown): Abfrage;
  in(spalte: string, werte: unknown[]): Abfrage;
  order(spalte: string, opt?: { ascending?: boolean }): Abfrage;
  range(von: number, bis: number): PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
};
export type ExportDb = {
  from(tabelle: string): Abfrage;
  storage: { from(bucket: string): { download(pfad: string): Promise<{ data: Blob | null; error: { message: string } | null }> } };
};

export type ManifestDatei =
  | { pfad: string; quelle: string; id: string; groesse: number; sha256: string }
  | { pfad: null; quelle: string; id: string; fehler: string };

export type Manifest = {
  format: "myimmo-export";
  version: 2;
  erstellt: string;
  rolle: ExportRolle;
  vollstaendig: boolean;
  tabellen: { name: string; zeilen: number; fehler?: string }[];
  dateien: ManifestDatei[];
  ausgenommen: Record<string, string>;
};

/** Bereinigter, kurzer Dateiname — Umlaute bleiben, alles andere wird zu „_“. */
export function sichererName(roh: string | null | undefined): string {
  const s = String(roh ?? "").normalize("NFC").replace(/[^a-zA-Z0-9äöüÄÖÜß ._-]+/g, "_").replace(/^[.\s_]+/, "").trim();
  return s.slice(0, 80);
}

/** Base64 bzw. Data-URI (ggf. verschlüsselt) → Bytes. Wirft bei Unsinn statt still zu leeren. */
export function dateiBytes(roh: string): Buffer {
  const klar = decrypt(roh);
  const b64 = klar.startsWith("data:") ? klar.slice(klar.indexOf(",") + 1) : klar;
  const sauber = b64.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=_-]*$/.test(sauber)) throw new Error("kein Base64");
  const buf = Buffer.from(sauber, "base64");
  if (sauber.length > 0 && buf.length === 0) throw new Error("leer nach Dekodierung");
  return buf;
}

const sha256 = (b: Buffer | Uint8Array) => createHash("sha256").update(b).digest("hex");

function csv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return [keys.join(";"), ...rows.map((r) => keys.map((k) => csvZelle(r[k])).join(";"))].join("\n");
}

const zeilenId = (t: ExportTabelle, r: Row) => t.schluessel.map((s) => String(r[s] ?? "")).join("_");

export type ExportErgebnis = { zip: Uint8Array; manifest: Manifest; dateiname: string };

/**
 * Baut das ZIP. `db` ist der Client der angemeldeten Sitzung (RLS bleibt zweite Linie); jede
 * Abfrage filtert zusätzlich ausdrücklich auf das eigene Konto.
 */
export async function baueVollexport(db: ExportDb, userId: string, rolle: ExportRolle, heute: string, jetzt: Date = new Date()): Promise<ExportErgebnis> {
  const zip = new JSZip();
  const manifest: Manifest = {
    format: "myimmo-export", version: 2, erstellt: jetzt.toISOString(), rolle, vollstaendig: true,
    tabellen: [], dateien: [], ausgenommen: EXPORT_AUSNAHMEN,
  };
  const alles: Record<string, Row[]> = {};
  const geladen = new Map<string, Row[]>();
  const vergeben = new Set<string>();

  const legeAb = (pfadRoh: string, bytes: Buffer | Uint8Array, quelle: string, id: string): string => {
    let pfad = pfadRoh;
    for (let n = 2; vergeben.has(pfad); n++) pfad = pfadRoh.replace(/(\.[^./]*)?$/, (e) => `_${n}${e ?? ""}`);
    vergeben.add(pfad);
    zip.file(pfad, bytes);
    manifest.dateien.push({ pfad, quelle, id, groesse: bytes.length, sha256: sha256(bytes) });
    return pfad;
  };
  const fehlt = (quelle: string, id: string, fehler: string) => {
    manifest.vollstaendig = false;
    manifest.dateien.push({ pfad: null, quelle, id, fehler });
  };

  for (const t of EXPORT_TABELLEN[rolle]) {
    let rows: Row[];
    try {
      if (t.besitz) {
        rows = await ladeAlle(t.name, (von, bis) => {
          let q = db.from(t.name).select("*").eq(t.besitz!, userId);
          for (const s of t.schluessel) q = q.order(s, { ascending: true });
          return q.range(von, bis);
        });
      } else {
        const eltern = geladen.get(t.eltern!.tabelle) ?? [];
        const ids = eltern.map((e) => e[t.eltern!.elternSpalte]).filter((x) => x != null);
        rows = [];
        for (const teil of stapel(ids)) {
          rows.push(...(await ladeAlle(t.name, (von, bis) => {
            let q = db.from(t.name).select("*").in(t.eltern!.spalte, teil);
            for (const s of t.schluessel) q = q.order(s, { ascending: true });
            return q.range(von, bis);
          })));
        }
      }
    } catch (e) {
      manifest.vollstaendig = false;
      manifest.tabellen.push({ name: t.name, zeilen: 0, fehler: e instanceof DatenUnvollstaendig ? e.ursache : String(e) });
      continue;
    }
    geladen.set(t.name, rows);

    const ausgabe: Row[] = [];
    for (const r of rows) {
      const o: Row = { ...r };
      const id = zeilenId(t, r);
      for (const s of t.ohne ?? []) delete o[s];
      for (const s of t.verschluesselt ?? []) {
        if (o[s] == null) continue;
        try {
          o[s] = decryptNullable(String(o[s]));
        } catch {
          o[s] = "(nicht entschlüsselbar — siehe manifest.json)";
          fehlt(`${t.name}.${s}`, id, "Entschlüsselung fehlgeschlagen");
        }
      }
      for (const d of t.dateien ?? []) {
        const roh = r[d.spalte];
        if (roh == null || roh === "") continue;
        const quelle = `${t.name}.${d.spalte}`;
        try {
          const bytes = dateiBytes(String(roh));
          const name = sichererName(d.name ? (r[d.name] as string) : "") || d.spalte;
          o[d.spalte] = `(Datei: ${legeAb(`dateien/${t.name}/${id}_${name}`, bytes, quelle, id)})`;
        } catch (e) {
          o[d.spalte] = "(Datei fehlt — siehe manifest.json)";
          fehlt(quelle, id, e instanceof Error ? e.message : "nicht lesbar");
        }
      }
      if (t.storage && r[t.storage.spalte] && (!t.storage.wenn || t.storage.wenn(r))) {
        const quelle = `${t.storage.bucket}:${t.name}.${t.storage.spalte}`;
        const pfad = String(r[t.storage.spalte]);
        try {
          const { data, error } = await db.storage.from(t.storage.bucket).download(pfad);
          if (error || !data) throw new Error(error?.message ?? "Datei nicht gefunden");
          const bytes = Buffer.from(await data.arrayBuffer());
          const name = sichererName(pfad.split("/").pop()) || "beleg";
          o[t.storage.spalte] = `(Datei: ${legeAb(`dateien/${t.name}/${id}_beleg_${name}`, bytes, quelle, id)})`;
        } catch (e) {
          o[t.storage.spalte] = `(Datei fehlt — siehe manifest.json; Speicherort ${pfad})`;
          fehlt(quelle, id, e instanceof Error ? e.message : "nicht lesbar");
        }
      }
      ausgabe.push(o);
    }
    alles[t.name] = ausgabe;
    manifest.tabellen.push({ name: t.name, zeilen: ausgabe.length });
    zip.file(`daten/${t.name}.csv`, csv(ausgabe));
  }

  zip.file("daten/alles.json", JSON.stringify(alles, null, 2));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("LIESMICH.txt", liesmich(manifest, jetzt));

  const dateiname = manifest.vollstaendig ? `myimmo-export-${heute}.zip` : `myimmo-export-UNVOLLSTAENDIG-${heute}.zip`;
  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { zip: buf, manifest, dateiname };
}

function liesmich(m: Manifest, jetzt: Date): string {
  const fehlerTab = m.tabellen.filter((t) => t.fehler);
  const fehlerDat = m.dateien.filter((d) => d.pfad === null);
  const warnung = m.vollstaendig
    ? ""
    : `ACHTUNG: DIESER EXPORT IST UNVOLLSTÄNDIG.\n` +
      `${fehlerTab.length} Tabelle(n) und ${fehlerDat.length} Datei(en) konnten nicht gelesen werden —\n` +
      `Einzelheiten in manifest.json. Bitte den Export später erneut anfordern.\n\n`;
  const rolle = m.rolle === "vermieter"
    ? "Enthalten sind alle Tabellen deines Kontos (Liste und Zeilenzahlen in manifest.json).\n"
    : m.rolle === "mieter"
      ? "Enthalten ist alles, was zu DEINEM Zugang gehört: deine Anliegen samt Anhängen, deine\n" +
        "Nachrichten, deine gemeldeten Zählerstände und deine Wohnungs-Verknüpfung.\n\n" +
        "NICHT enthalten sind die Stammdaten, die dein Vermieter über dein Mietverhältnis führt\n" +
        "(Name, Miethöhe, Kaution und Ähnliches). Dafür ist er der Verantwortliche im Sinne der\n" +
        "DSGVO — MyImmo verarbeitet diese Daten nur in seinem Auftrag. Ein Auskunftsersuchen nach\n" +
        "Art. 15 DSGVO richtest du deshalb bitte direkt an deinen Vermieter.\n"
      : "Enthalten ist alles, was zu DEINEM Zugang gehört: deine Aufträge, deine Notizen und Fotos\n" +
        "und deine Verknüpfungen zu Auftraggebern.\n\n" +
        "NICHT enthalten sind die Objekt- und Mieterdaten des Auftraggebers — dafür ist er der\n" +
        "Verantwortliche im Sinne der DSGVO.\n";
  return (
    warnung +
    `MyImmo — Datenexport vom ${jetzt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}\n\n` +
    `daten/          jede Tabelle als CSV (Trennzeichen ;) + alles.json\n` +
    `dateien/        Dateien je Tabelle: <tabelle>/<Zeilen-ID>_<Name> — die CSV-Zelle nennt den Pfad\n` +
    `manifest.json   Zeilen je Tabelle, je Datei Größe und SHA-256, alle Fehler\n\n` +
    rolle + "\n" +
    `Prüfen: Die SHA-256-Werte in manifest.json gehören zu den Dateien im ZIP. Stimmt einer nicht\n` +
    `oder lässt sich das ZIP nicht öffnen, ist der Download unvollständig — bitte neu herunterladen.\n\n` +
    `Hinweis: Dies ist ein Export deiner Daten, kein geprüftes Backup. Ein automatisches\n` +
    `Zurückspielen in MyImmo gibt es nicht.\n`
  );
}
