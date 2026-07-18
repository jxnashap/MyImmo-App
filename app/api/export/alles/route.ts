import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { decryptNullable } from "@/lib/crypto/secure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Voll-Datenexport: alle eigenen Daten als ZIP (CSV je Tabelle + Gesamt-JSON
// + Archiv-Dokumente als Dateien). Deine Daten gehören dir — jederzeit raus.

type Row = Record<string, unknown>;

function csv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const zelle = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(";"), ...rows.map((r) => keys.map((k) => zelle(r[k])).join(";"))].join("\n");
}

// Tabellen mit user_id-Spalte (RLS liefert ohnehin nur eigene Zeilen).
const TABELLEN = [
  "properties", "mieter", "miet_zeitraeume", "mieter_positionen",
  "einnahmen", "kosten", "kredite", "verbrauch", "termine",
  "wiederkehrende_buchungen", "kalkulationen", "dokument_vorlagen",
  "vermieter_profil", "nk_co2", "anliegen", "einladungscodes",
  "zaehlerstand_meldungen", "bewertung_historie", "vergleichsangebote",
];

// Spalten mit Datei-Blobs — nicht in CSV/JSON, Dateien liegen separat im ZIP.
const BLOB_SPALTEN = ["datei_data", "rechnung_data", "foto_data", "daten"];

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });

  const zip = new JSZip();
  const alles: Record<string, Row[]> = {};

  for (const t of TABELLEN) {
    const { data, error } = await supabase.from(t).select("*").limit(10000);
    if (error) continue;
    let rows = (data ?? []) as Row[];
    // Blobs raus, IBANs entschlüsseln (es sind DEINE Daten)
    rows = rows.map((r) => {
      const o: Row = { ...r };
      for (const b of BLOB_SPALTEN) if (b in o) o[b] = o[b] ? "(Datei — siehe Ordner im ZIP)" : null;
      if (t === "mieter" && o.iban) o.iban = decryptNullable(String(o.iban));
      if (t === "mieter" && o.kaution_bank) o.kaution_bank = decryptNullable(String(o.kaution_bank));
      if (t === "kredite" && o.darlnr) o.darlnr = decryptNullable(String(o.darlnr));
      return o;
    });
    if (t === "ibans") continue; // separat unten (Entschlüsselung ganzer Zeilen)
    alles[t] = rows;
    zip.file(`daten/${t}.csv`, csv(rows));
  }

  // IBANs entschlüsselt
  const { data: ibanRows } = await supabase.from("ibans").select("*");
  const ibans = ((ibanRows ?? []) as Row[]).map((r) => ({
    ...r,
    iban: decryptNullable(r.iban as string | null),
    inhaber: decryptNullable(r.inhaber as string | null),
    iban_bidx: undefined,
  }));
  alles["ibans"] = ibans;
  zip.file("daten/ibans.csv", csv(ibans));
  zip.file("daten/alles.json", JSON.stringify(alles, null, 2));

  // Archiv-Dokumente als echte Dateien
  const { data: doks } = await supabase
    .from("notizen")
    .select("id,titel,datei_name,datei_data")
    .not("datei_data", "is", null)
    .limit(500);
  for (const d of (doks ?? []) as { id: string; titel: string | null; datei_name: string | null; datei_data: string }[]) {
    const raw = String(d.datei_data);
    const b64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    const name = (d.datei_name || d.titel || d.id).replace(/[^a-zA-Z0-9äöüÄÖÜß ._-]+/g, "_");
    zip.file(`dokumente/${name}`, Buffer.from(b64, "base64"));
  }

  // Kosten-Belege als echte Dateien
  const { data: belege } = await supabase
    .from("kosten")
    .select("id,beschreibung,rechnung_name,rechnung_data")
    .not("rechnung_data", "is", null)
    .limit(500);
  for (const b of (belege ?? []) as { id: string; beschreibung: string | null; rechnung_name: string | null; rechnung_data: string }[]) {
    const raw = String(b.rechnung_data);
    const b64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    const name = (b.rechnung_name || b.beschreibung || b.id).replace(/[^a-zA-Z0-9äöüÄÖÜß ._-]+/g, "_");
    zip.file(`belege/${name}`, Buffer.from(b64, "base64"));
  }

  zip.file(
    "LIESMICH.txt",
    `MyImmo — Voll-Datenexport vom ${new Date().toLocaleString("de-DE")}\n\n` +
      `daten/      alle Tabellen als CSV (Trennzeichen ;) + alles.json\n` +
      `dokumente/  deine Archiv-Dokumente als Dateien\n` +
      `belege/     Rechnungs-Belege der Kostenbuchungen\n\n` +
      `Deine Daten gehören dir. Dieser Export enthält alles, was in deinem\n` +
      `MyImmo-Konto gespeichert ist.\n`,
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
