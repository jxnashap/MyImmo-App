// iCal-Export: alle anstehenden Termine + automatische Fristen als .ics
// (VEVENT, ganztägig). Vorlauf_tage wird als VALARM-Erinnerung abgebildet.
//
// Ablauf D (Prüfstand 11.10.2026): Die UID einer Frist hing an ihrer POSITION in der Liste
// („mieter-<id>-2“). Kam eine Frist hinzu oder fiel eine weg, trug beim nächsten Import ein anderes
// Ereignis dieselbe UID — der Kalender überschrieb einen Termin mit einem fremden. Jetzt ist die UID
// ein Hash des Fristschlüssels (Quelle, Bezug, Datum, Bezeichnung): gleiche Frist, gleiche UID.
// Erledigt vermerkte und ausgeblendete Fristen stehen wie auf /termine nicht mehr darin.
import { heuteBerlin } from "@/lib/zeitraum";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mieterFristen, kreditFristen, globaleFristen, objektFristen } from "@/lib/fristen";
import { FRIST_VERMERK_SPALTEN, fristUid, fristVermerk, vermerkeAus, type FristVermerk } from "@/lib/fristDokument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ereignis = { datum: string; titel: string; beschreibung: string; uid: string; vorlaufTage?: number | null };

// iCal-Text escapen (RFC 5545)
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const ymd = (iso: string) => iso.replace(/-/g, "");

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const [{ data: term }, { data: props }, { data: miet }, { data: kred }, { data: vermerkRows }] = await Promise.all([
    supabase.from("termine").select("*").eq("erledigt", false).order("datum"),
    supabase.from("properties").select("id,bezeichnung,typ,energieausweis_datum"),
    supabase.from("mieter").select("id,prop_id,vorname,nachname,einheit,mietbeginn,mietende,kuendigung,letzte_erhoehung,mietart,staffel_datum"),
    supabase.from("kredite").select("id,prop_id,bezeichnung,zinsbindung,auszahlung_datum"),
    supabase.from("frist_ausgeblendet").select(FRIST_VERMERK_SPALTEN),
  ]);
  const vermerke = vermerkeAus(vermerkRows as FristVermerk[] | null);
  /** Wie auf /termine: Was erledigt vermerkt oder ausgeblendet ist, kommt nicht in den Kalender. */
  const offen = (quelle: string, bezug: string | null, f: { datum: string | null; label: string }) =>
    !!f.datum && !fristVermerk(vermerke, quelle, bezug, f.datum, f.label);

  const nameOf = new Map((props ?? []).map((p) => [p.id, p.bezeichnung as string]));
  // Ab dem 1. Januar des Vorjahres, nach Berliner Kalender (Audit P8, C15).
  const grenze = `${Number(heuteBerlin().slice(0, 4)) - 1}-01-01`;

  const ereignisse: Ereignis[] = [];
  const add = (datum: string | null, titel: string, beschreibung: string, uid: string, vorlaufTage?: number | null) => {
    if (!datum || datum.slice(0, 10) < grenze) return;
    ereignisse.push({ datum, titel, beschreibung, uid, vorlaufTage });
  };

  for (const m of miet ?? []) {
    const wer = [m.vorname, m.nachname].filter(Boolean).join(" ");
    const wo = (m.prop_id && nameOf.get(m.prop_id)) || "";
    for (const f of mieterFristen(m)) {
      if (!offen("mieter", m.id, f)) continue;
      add(f.datum, f.label, [wer, wo, f.rechtsgrundlage].filter(Boolean).join(" · "), fristUid("mieter", m.id, f.datum!, f.label));
    }
  }
  for (const k of kred ?? []) {
    const wo = (k.prop_id && nameOf.get(k.prop_id)) || "";
    for (const f of kreditFristen(k)) {
      if (!offen("kredit", k.id, f)) continue;
      add(f.datum, f.label, [k.bezeichnung ?? "Darlehen", wo, f.rechtsgrundlage].filter(Boolean).join(" · "), fristUid("kredit", k.id, f.datum!, f.label));
    }
  }
  for (const p of props ?? []) {
    for (const f of objektFristen(p)) {
      if (!offen("objekt", p.id, f)) continue;
      add(f.datum, f.label, [p.bezeichnung, f.rechtsgrundlage].filter(Boolean).join(" · "), fristUid("objekt", p.id, f.datum!, f.label));
    }
  }
  for (const f of globaleFristen()) {
    if (!offen("steuer", null, f)) continue;
    add(f.datum, f.label, f.rechtsgrundlage ?? "", fristUid("steuer", null, f.datum!, f.label));
  }
  for (const t of term ?? []) {
    add(
      t.datum,
      t.titel ?? "Termin",
      [(t.prop_id && nameOf.get(t.prop_id)) || "", t.notiz ?? ""].filter(Boolean).join(" · "),
      `eigen-${t.id}@myimmo`,
      t.vorlauf_tage,
    );
  }

  // DTSTAMP ist laut RFC 5545 eine UTC-Zeit — hier also bewusst ohne Berliner Umrechnung.
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyImmo//Termine//DE",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:MyImmo Termine",
  ];
  for (const e of ereignisse) {
    zeilen.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.datum)}`,
      `SUMMARY:${esc(e.titel)}`,
    );
    if (e.beschreibung) zeilen.push(`DESCRIPTION:${esc(e.beschreibung)}`);
    if (e.vorlaufTage && e.vorlaufTage > 0) {
      zeilen.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.titel)}`, `TRIGGER:-P${e.vorlaufTage}D`, "END:VALARM");
    }
    zeilen.push("END:VEVENT");
  }
  zeilen.push("END:VCALENDAR");

  return new NextResponse(zeilen.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="myimmo-termine.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
