// iCal-Export: alle anstehenden Termine + automatische Fristen als .ics
// (VEVENT, ganztägig). Vorlauf_tage wird als VALARM-Erinnerung abgebildet.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mieterFristen, kreditFristen, globaleFristen, objektFristen } from "@/lib/fristen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ereignis = { datum: string; titel: string; beschreibung: string; uid: string; vorlaufTage?: number | null };

// iCal-Text escapen (RFC 5545)
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const ymd = (iso: string) => iso.replace(/-/g, "");

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const [{ data: term }, { data: props }, { data: miet }, { data: kred }] = await Promise.all([
    supabase.from("termine").select("*").eq("erledigt", false).order("datum"),
    supabase.from("properties").select("id,bezeichnung,typ,energieausweis_datum"),
    supabase.from("mieter").select("id,prop_id,vorname,nachname,einheit,mietbeginn,mietende,kuendigung,letzte_erhoehung,mietart,staffel_datum"),
    supabase.from("kredite").select("id,prop_id,bezeichnung,zinsbindung,auszahlung_datum"),
  ]);

  const nameOf = new Map((props ?? []).map((p) => [p.id, p.bezeichnung as string]));
  const heute = new Date();
  const grenze = new Date(heute.getFullYear() - 1, 0, 1); // ab letztem Jahr

  const ereignisse: Ereignis[] = [];
  const add = (datum: string | null, titel: string, beschreibung: string, uid: string, vorlaufTage?: number | null) => {
    if (!datum || new Date(datum) < grenze) return;
    ereignisse.push({ datum, titel, beschreibung, uid, vorlaufTage });
  };

  for (const m of miet ?? []) {
    const wer = [m.vorname, m.nachname].filter(Boolean).join(" ");
    const wo = (m.prop_id && nameOf.get(m.prop_id)) || "";
    mieterFristen(m).forEach((f, i) =>
      add(f.datum, f.label, [wer, wo, f.rechtsgrundlage].filter(Boolean).join(" · "), `mieter-${m.id}-${i}@myimmo`),
    );
  }
  for (const k of kred ?? []) {
    const wo = (k.prop_id && nameOf.get(k.prop_id)) || "";
    kreditFristen(k).forEach((f, i) =>
      add(f.datum, f.label, [k.bezeichnung ?? "Darlehen", wo, f.rechtsgrundlage].filter(Boolean).join(" · "), `kredit-${k.id}-${i}@myimmo`),
    );
  }
  for (const p of props ?? []) {
    objektFristen(p).forEach((f, i) =>
      add(f.datum, f.label, [p.bezeichnung, f.rechtsgrundlage].filter(Boolean).join(" · "), `objekt-${p.id}-${i}@myimmo`),
    );
  }
  globaleFristen().forEach((f, i) =>
    add(f.datum, f.label, f.rechtsgrundlage ?? "", `global-${f.datum}-${i}@myimmo`),
  );
  for (const t of term ?? []) {
    add(
      t.datum,
      t.titel ?? "Termin",
      [(t.prop_id && nameOf.get(t.prop_id)) || "", t.notiz ?? ""].filter(Boolean).join(" · "),
      `eigen-${t.id}@myimmo`,
      t.vorlauf_tage,
    );
  }

  const stamp = `${ymd(new Date().toISOString().slice(0, 10))}T000000Z`;
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
