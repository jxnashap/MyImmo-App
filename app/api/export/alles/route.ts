import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { decryptNullable } from "@/lib/crypto/secure";
import { csvZelle } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Voll-Datenexport: alle eigenen Daten als ZIP (CSV je Tabelle + Gesamt-JSON
// + Archiv-Dokumente als Dateien). Deine Daten gehören dir — jederzeit raus.

type Row = Record<string, unknown>;

function csv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return [keys.join(";"), ...rows.map((r) => keys.map((k) => csvZelle(r[k])).join(";"))].join("\n");
}

// Welche Tabelle über WELCHE Spalte zum Konto gehört — je Rolle.
//
// Früher stand hier nur eine Namensliste und die Abfrage lautete `select("*")`
// mit dem Kommentar „RLS liefert ohnehin nur eigene Zeilen". Für Vermieter
// stimmt das; für MIETER stimmt es nicht: Die Policy `properties_select_zugang`
// gibt dem Mieter die KOMPLETTE Objektzeile seiner Wohnung — inklusive
// `kaufpreis`, `wert` und `kaufdatum`. Ein Mieter, der auf „Meine Daten
// exportieren" klickt, hätte damit die Kaufpreisdaten seines Vermieters
// heruntergeladen.
//
// Deshalb jetzt: explizite Eigentümer-Spalte je Tabelle, explizit gefiltert,
// und eine eigene Tabellenliste je Rolle. RLS bleibt die zweite Verteidigungs-
// linie, ist aber nicht mehr die einzige.
type Rolle = "vermieter" | "mieter" | "service";

const VERMIETER_TABELLEN: [tabelle: string, spalte: string][] = [
  ["properties", "user_id"], ["mieter", "user_id"], ["miet_zeitraeume", "user_id"],
  ["mieter_positionen", "user_id"], ["einnahmen", "user_id"], ["kosten", "user_id"],
  ["kredite", "user_id"], ["verbrauch", "user_id"], ["termine", "user_id"],
  ["notizen", "user_id"], ["wiederkehrende_buchungen", "user_id"],
  ["kalkulationen", "user_id"], ["dokument_vorlagen", "user_id"],
  ["vermieter_profil", "user_id"], ["nk_co2", "user_id"],
  ["bewertung_historie", "user_id"], ["vergleichsangebote", "user_id"],
  ["firmen", "user_id"], ["bewerber_links", "user_id"], ["bewerbungen", "user_id"],
  ["bewerbung_dateien", "user_id"],
  ["bankverbindungen", "user_id"], ["bank_umsaetze", "user_id"],
  ["abos", "user_id"],
  ["anliegen", "vermieter_id"], ["vermieter_anfragen", "vermieter_id"],
  ["zaehlerstand_meldungen", "vermieter_id"], ["einladungscodes", "vermieter_id"],
  ["auftraege", "vermieter_id"], ["mieter_zugaenge", "vermieter_id"],
  ["service_zugaenge", "vermieter_id"],
];

// Mieter/Service bekommen NUR, was zu ihrem eigenen Zugang gehört. Die
// Stammdaten über sie (Tabelle `mieter`) gehören dem Vermieter — er ist dafür
// der Verantwortliche, das Auskunftsersuchen richtet sich an ihn (siehe /avv).
const MIETER_TABELLEN: [string, string][] = [
  ["anliegen", "mieter_user_id"],
  ["zaehlerstand_meldungen", "mieter_user_id"],
  ["mieter_zugaenge", "user_id"],
];

const SERVICE_TABELLEN: [string, string][] = [
  ["auftraege", "service_user_id"],
  ["service_zugaenge", "user_id"],
];

function tabellenFuer(rolle: Rolle): [string, string][] {
  if (rolle === "mieter") return MIETER_TABELLEN;
  if (rolle === "service") return SERVICE_TABELLEN;
  return VERMIETER_TABELLEN;
}

// Spalten mit Datei-Blobs — nicht in CSV/JSON, Dateien liegen separat im ZIP.
const BLOB_SPALTEN = ["datei_data", "rechnung_data", "foto_data", "daten"];

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });

  const { data: rolleRow } = await supabase
    .from("nutzer_rollen")
    .select("rolle")
    .eq("user_id", user.id)
    .maybeSingle();
  const rolleRoh = rolleRow?.rolle ?? "vermieter";
  const rolle: Rolle = rolleRoh === "mieter" ? "mieter" : rolleRoh === "service" ? "service" : "vermieter";
  const istVermieter = rolle === "vermieter";

  const zip = new JSZip();
  const alles: Record<string, Row[]> = {};

  for (const [t, spalte] of tabellenFuer(rolle)) {
    const { data, error } = await supabase.from(t).select("*").eq(spalte, user.id).limit(10000);
    if (error) continue;
    // Blobs raus, verschlüsselte Felder entschlüsseln (es sind DEINE Daten)
    const rows = ((data ?? []) as Row[]).map((r) => {
      const o: Row = { ...r };
      for (const b of BLOB_SPALTEN) if (b in o) o[b] = o[b] ? "(Datei — siehe Ordner im ZIP)" : null;
      if (t === "mieter" && o.iban) o.iban = decryptNullable(String(o.iban));
      if (t === "mieter" && o.kaution_bank) o.kaution_bank = decryptNullable(String(o.kaution_bank));
      if (t === "kredite" && o.darlnr) o.darlnr = decryptNullable(String(o.darlnr));
      if (t === "bewerbung_dateien" && o.data) o.data = decryptNullable(String(o.data));
      if (t === "bankverbindungen" && o.iban) o.iban = decryptNullable(String(o.iban));
      return o;
    });
    alles[t] = rows;
    zip.file(`daten/${t}.csv`, csv(rows));
  }

  // IBANs entschlüsselt — nur für Vermieter-Konten (Mieter/Service haben keine).
  if (istVermieter) {
    const { data: ibanRows } = await supabase.from("ibans").select("*").eq("user_id", user.id);
    const ibans = ((ibanRows ?? []) as Row[]).map((r) => ({
      ...r,
      iban: decryptNullable(r.iban as string | null),
      inhaber: decryptNullable(r.inhaber as string | null),
      iban_bidx: undefined,
    }));
    alles["ibans"] = ibans;
    zip.file("daten/ibans.csv", csv(ibans));
  }
  zip.file("daten/alles.json", JSON.stringify(alles, null, 2));

  // Archiv-Dokumente als echte Dateien
  const { data: doks } = istVermieter
    ? await supabase
        .from("notizen")
        .select("id,titel,datei_name,datei_data")
        .eq("user_id", user.id)
        .not("datei_data", "is", null)
        .limit(500)
    : { data: [] };
  for (const d of (doks ?? []) as { id: string; titel: string | null; datei_name: string | null; datei_data: string }[]) {
    const raw = String(d.datei_data);
    const b64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    const name = (d.datei_name || d.titel || d.id).replace(/[^a-zA-Z0-9äöüÄÖÜß ._-]+/g, "_");
    zip.file(`dokumente/${name}`, Buffer.from(b64, "base64"));
  }

  // Kosten-Belege als echte Dateien
  const { data: belege } = istVermieter
    ? await supabase
        .from("kosten")
        .select("id,beschreibung,rechnung_name,rechnung_data")
        .eq("user_id", user.id)
        .not("rechnung_data", "is", null)
        .limit(500)
    : { data: [] };
  for (const b of (belege ?? []) as { id: string; beschreibung: string | null; rechnung_name: string | null; rechnung_data: string }[]) {
    const raw = String(b.rechnung_data);
    const b64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    const name = (b.rechnung_name || b.beschreibung || b.id).replace(/[^a-zA-Z0-9äöüÄÖÜß ._-]+/g, "_");
    zip.file(`belege/${name}`, Buffer.from(b64, "base64"));
  }

  const hinweisRolle = istVermieter
    ? `dokumente/  deine Archiv-Dokumente als Dateien\n` +
      `belege/     Rechnungs-Belege der Kostenbuchungen\n\n` +
      `Deine Daten gehören dir. Dieser Export enthält alles, was in deinem\n` +
      `MyImmo-Konto gespeichert ist.\n`
    : rolle === "mieter"
      ? `\nEnthalten ist alles, was zu DEINEM Zugang gehört: deine Anliegen,\n` +
        `deine gemeldeten Zählerstände und deine Wohnungs-Verknüpfung.\n\n` +
        `NICHT enthalten sind die Stammdaten, die dein Vermieter über dein\n` +
        `Mietverhältnis führt (Name, Miethöhe, Kaution und Ähnliches). Dafür ist\n` +
        `er der Verantwortliche im Sinne der DSGVO — MyImmo verarbeitet diese\n` +
        `Daten nur in seinem Auftrag. Ein Auskunftsersuchen nach Art. 15 DSGVO\n` +
        `richtest du deshalb bitte direkt an deinen Vermieter.\n`
      : `\nEnthalten ist alles, was zu DEINEM Zugang gehört: deine Aufträge und\n` +
        `deine Verknüpfung zum Auftraggeber.\n\n` +
        `NICHT enthalten sind die Objekt- und Mieterdaten des Auftraggebers —\n` +
        `dafür ist er der Verantwortliche im Sinne der DSGVO.\n`;

  zip.file(
    "LIESMICH.txt",
    `MyImmo — Datenexport vom ${new Date().toLocaleString("de-DE")}\n\n` +
      `daten/      alle Tabellen als CSV (Trennzeichen ;) + alles.json\n` +
      hinweisRolle,
  );

  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="myimmo-export-${new Date().toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
