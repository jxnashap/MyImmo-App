import { NextResponse } from "next/server";
import { featureSperre } from "@/lib/planGate";
import { getAuthedUser, callAnthropic, MB, kiBereit, KI_NICHT_BEREIT } from "@/lib/aiRoute";
import { darfWeiter } from "@/lib/net/bremse";
import { jsonBegrenzt, ZuGrossFehler } from "@/lib/net/grenzen";
import { BELEG_PROMPT, leseBelegVorschlag, objektVorschlag } from "@/lib/belegEingang";

// KI-Vorschlag für einen Beleg im Belegeingang (Ablauf B/F, Prüfstand 11.10.2026).
//
// Ein dauerhafter Auftrag statt eines losen Aufrufs: Der Eintrag in `beleg_eingang` trägt Zustand,
// Versuche, letzten Versuch und Fehlergrund. `beleg_eingang_beanspruchen` nimmt ihn GENAU EINMAL in
// Arbeit (zwei Tabs, Doppelklick → einer bekommt ihn; höchstens drei Versuche; ein abgebrochener Lauf
// ist nach fünf Minuten wieder frei). Das Ergebnis ist ein VORSCHLAG — gebucht wird erst, was der
// Vermieter in der Prüfliste freigibt (lib/actions/belegEingang.ts → bucheBeleg).
// Zustellrisiko: Bricht die Funktion NACH der KI-Antwort und VOR dem Speichern ab, ist der Aufruf
// bezahlt, aber ohne Ergebnis — der nächste Versuch fragt erneut (höchstens drei insgesamt).

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const MAX_BILD = 5 * MB; // Bildgrenze des KI-Anbieters
const MAX_PDF = 15 * MB;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const { user, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Du bist nicht mehr angemeldet — bitte neu anmelden." }, { status: 401 });
  const sperre = await featureSperre(supabase, "ki_import");
  if (sperre) return NextResponse.json({ error: sperre }, { status: 402 });
  if (!kiBereit()) return NextResponse.json({ error: KI_NICHT_BEREIT }, { status: 503 });

  let id = "";
  try {
    const body = (await jsonBegrenzt(req, 1024)) as Record<string, unknown> | null;
    id = String(body?.id ?? "");
  } catch (e) {
    if (e instanceof ZuGrossFehler) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 413 });
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (!UUID.test(id)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

  // Jeder Aufruf kostet Geld beim KI-Anbieter: Bremse je Konto, bei Störung gesperrt.
  if (!(await darfWeiter("beleg_ki", 30, 3600, user.id, { sperrtBeiAusfall: true }))) {
    return NextResponse.json({ error: "Zu viele Auswertungen in kurzer Zeit. Bitte später erneut versuchen." }, { status: 429 });
  }

  const { data: beansprucht, error: anspruchFehler } = await supabase.rpc("beleg_eingang_beanspruchen", { p_id: id });
  if (anspruchFehler) return NextResponse.json({ error: "Beleg konnte nicht geladen werden." }, { status: 503 });
  const eintrag = (beansprucht as { id: string; datei_pfad: string; datei_mime: string; datei_groesse: number }[] | null)?.[0];
  if (!eintrag) {
    return NextResponse.json(
      { error: "Der Vorschlag läuft schon, liegt schon vor oder ist nach drei Versuchen nicht mehr möglich — bitte von Hand ausfüllen." },
      { status: 409 },
    );
  }

  /** Lauf beenden: Fehlergrund festhalten (nur, solange WIR ihn in Arbeit haben). */
  const scheitern = async (grund: string, status: number) => {
    const { error } = await supabase.from("beleg_eingang").update({ status: "fehler", fehler: grund.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).eq("status", "in_arbeit");
    // Scheitert auch das, bleibt der Eintrag „in Arbeit“ und gilt nach fünf Minuten als abgebrochen
    // (wieder beanspruchbar) — kein Zustand, der hängen bleibt.
    if (error) console.warn("[beleg-vorschlag] Fehlergrund nicht gespeichert");
    return NextResponse.json({ error: grund }, { status });
  };

  const istPdf = eintrag.datei_mime === "application/pdf";
  if (eintrag.datei_groesse > (istPdf ? MAX_PDF : MAX_BILD)) {
    return scheitern(istPdf ? "PDF zu groß für die Auswertung (max. 15 MB) — bitte von Hand ausfüllen." : "Bild zu groß für die Auswertung (max. 5 MB) — bitte von Hand ausfüllen.", 413);
  }
  const { data: datei, error: ladeFehler } = await supabase.storage.from("belege").download(eintrag.datei_pfad);
  if (ladeFehler || !datei) return scheitern("Beleg-Datei nicht lesbar.", 502);
  const data = Buffer.from(await datei.arrayBuffer()).toString("base64");
  const block = istPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: eintrag.datei_mime, data } };

  let antwortText = "";
  try {
    const resp = await callAnthropic(process.env.ANTHROPIC_API_KEY ?? "", {
      model: MODEL,
      max_tokens: 800,
      temperature: 0,
      messages: [{ role: "user", content: [block, { type: "text", text: BELEG_PROMPT }] }],
    });
    if (!resp.ok) return scheitern(`KI-Dienst antwortete mit ${resp.status}.`, 502);
    const json = await resp.json();
    antwortText = (json?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  } catch (e) {
    if (e instanceof ZuGrossFehler) return scheitern("Antwort des KI-Dienstes war zu groß.", 502);
    if ((e as Error).name === "AbortError") return scheitern("Zeitüberschreitung beim KI-Dienst.", 504);
    return scheitern("KI-Dienst nicht erreichbar.", 502);
  }

  const vorschlag = leseBelegVorschlag(antwortText);
  if (!vorschlag) return scheitern("Antwort der KI war nicht lesbar — bitte von Hand ausfüllen.", 422);
  const { data: objekte } = await supabase.from("properties").select("id,bezeichnung,adresse").eq("user_id", user.id);
  const prop_id = objektVorschlag(vorschlag.objektHinweis, (objekte ?? []) as { id: string; bezeichnung: string | null; adresse: string | null }[]);

  const { data: gespeichert, error: speicherFehler } = await supabase
    .from("beleg_eingang")
    .update({ status: "vorschlag", vorschlag: { ...vorschlag, prop_id }, fehler: null, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).eq("status", "in_arbeit")
    .select("id").maybeSingle();
  if (speicherFehler) return scheitern("Vorschlag konnte nicht gespeichert werden.", 503);
  // Inzwischen von Hand gebucht oder verworfen: Der Vorschlag ist dann gegenstandslos.
  if (!gespeichert) return NextResponse.json({ ok: true, ueberholt: true });
  return NextResponse.json({ ok: true, vorschlag: { ...vorschlag, prop_id } });
}
