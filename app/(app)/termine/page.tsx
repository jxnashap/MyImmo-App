import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { datum } from "@/lib/format";
import { heuteBerlin } from "@/lib/zeitraum";
import { fristZiel } from "@/lib/heute";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { anliegenTermine, ANLIEGEN_TERMIN_SPALTEN, type AnliegenMitTermin } from "@/lib/anliegenTermin";
import { vorgangUrl } from "@/lib/anliegenListe";
import { vollmachtStatus, vertreterName } from "@/lib/vertreter";
import { mieterFristen, kreditFristen, globaleFristen, objektFristen, zeitraumMonateJeMieter } from "@/lib/fristen";
import {
  createTermin, createVorlageTermin, deleteTermin, toggleErledigt,
  blendeFristAus, zeigeFristWieder, erledigeFrist,
} from "@/lib/actions/termine";
import {
  FRIST_VERMERK_SPALTEN, ZUSTELLWEGE, erledigtAus, fristVermerk, fristVorgang, vermerkeAus, vorgangText,
  type ArchivDok, type FristDokument, type FristVermerk, type FristVorgang, type PortalZustellung,
} from "@/lib/fristDokument";
import { quelleZu } from "@/lib/fristQuellen";
import DeleteButton from "@/components/DeleteButton";
import AufklappForm from "@/components/AufklappForm";
import ExpandableList from "@/components/ExpandableList";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import { KATEGORIE_STIL, TERMIN_KATEGORIEN, WARTUNGS_VORLAGEN, WIEDERKEHRUNG_LABEL, fristSchluessel } from "@/lib/termine";
import type { Termin, Property, Tenant, Kredit } from "@/lib/types";
import { RotateCw, RotateCcw, Pencil, X, CalendarDays, Plus, Eye, EyeOff } from "lucide-react";
import Leer from "@/components/Leer";

type Eintrag = {
  datum: string;
  label: string;
  wer: string;
  wo: string;
  /** „anliegen“: vom Mieter bestätigter Termin eines Anliegens (lib/anliegenTermin.ts) — nur Anzeige. */
  quelle: "mieter" | "kredit" | "eigen" | "steuer" | "objekt" | "vertreter" | "anliegen";
  typ: "info" | "warn" | "ok";
  kategorie: string;
  rechtsgrundlage?: string;
  erledigt?: boolean;
  wiederkehrung?: string | null;
  id?: string;
  /** Nur abgeleitete Fristen: wohin die Frist führt (fristZiel, Paket D). */
  ziel?: string;
  /** Nur abgeleitete Fristen: Schluessel zum Aus-/Einblenden. */
  schluessel?: string;
  ausgeblendet?: boolean;
  /** Ablauf D: Mieter/Darlehen/Objekt/Vertreter, zu dem die Frist gehört (Teil des Schlüssels). */
  bezug?: string | null;
  /** Ablauf D: Schreiben zur Frist und wie weit der Vorgang ist. */
  dokument?: FristDokument;
  vorgang?: FristVorgang;
  /** Schlüssel, unter dem „erledigt“ vermerkt wird — immer mit Bezug. */
  erledigtSchluessel?: string;
};

export default async function TerminePage(
  props0: {
    searchParams: Promise<{ quelle?: string; jahr?: string; kategorie?: string; erledigte?: string; ansicht?: string; monat?: string; tag?: string; ausgeblendete?: string }>;
  }
) {
  const searchParams = await props0.searchParams;
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const [{ data: term }, { data: props }, { data: miet }, { data: kred }, { data: versteckt }, { data: archivRows }, { data: vertreterRows }, { data: zrRows }, { data: portalRows }, { data: anlTerminRows }] = await Promise.all([
    supabase.from("termine").select("*").order("datum"),
    supabase.from("properties").select("id,bezeichnung,typ,energieausweis_datum").order("bezeichnung"),
    supabase.from("mieter").select("id,prop_id,vorname,nachname,einheit,mietbeginn,mietende,kuendigung,letzte_erhoehung,mietart,staffel_datum,staffel_intervall,staffel_betrag,staffel_prozent,staffel_stufen"),
    supabase.from("kredite").select("id,prop_id,bezeichnung,zinsbindung,auszahlung_datum"),
    supabase.from("frist_ausgeblendet").select(FRIST_VERMERK_SPALTEN),
    // Ablauf D: Schreiben an Mieter (ohne Dateiinhalt) — für den Stand „PDF erstellt / im Portal“.
    supabase.from("notizen").select("id,mieter_id,titel,created_at").not("mieter_id", "is", null).order("created_at", { ascending: false }).limit(2000),
    // Paket D (06.10.2026): Vollmacht-Ablauf stand nur auf dem Dashboard — im Kalender fehlte er.
    supabase.from("vertreter").select("id,vorname,nachname,gueltig_bis,widerrufen_am").not("gueltig_bis", "is", null),
    supabase.from("miet_zeitraeume").select("mieter_id,von"),
    supabase.from("zustellungen").select("notiz_id,zugestellt_am,gelesen_am,zurueckgezogen_am").eq("art", "dokument").limit(2000),
    // Vom Mieter bestätigte Termine (21.10.2026) — erscheinen ohne eigenen Kalendereintrag.
    supabase.from("anliegen").select(ANLIEGEN_TERMIN_SPALTEN).eq("vermieter_id", user?.id ?? "").not("termin_bestaetigt", "is", null).neq("status", "erledigt"),
  ]);
  const archiv = (archivRows ?? []) as ArchivDok[];
  const portal = (portalRows ?? []) as PortalZustellung[];

  const properties = (props ?? []) as (Pick<Property, "id" | "bezeichnung" | "typ"> & { energieausweis_datum: string | null })[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const termine = (term ?? []) as Termin[];
  const mieter = (miet ?? []) as Tenant[];
  const kredite = (kred ?? []) as (Kredit & { auszahlung_datum: string | null })[];
  const mieterName = new Map(mieter.map((m) => [m.id, [m.vorname, m.nachname].filter(Boolean).join(" ")]));

  const eintraege: Eintrag[] = [];

  const zrMonate = zeitraumMonateJeMieter(zrRows as { mieter_id: string; von: string }[] | null);
  for (const m of mieter) {
    const wo = `${(m.prop_id && nameOf.get(m.prop_id)) || "–"}${m.einheit ? " · " + m.einheit : ""}`;
    const wer = [m.vorname, m.nachname].filter(Boolean).join(" ");
    for (const f of mieterFristen(m, { zeitraumMonate: zrMonate.get(m.id) ?? [] })) {
      if (!f.datum) continue;
      eintraege.push({ datum: f.datum, label: f.label, wer, wo, quelle: "mieter", typ: f.typ, kategorie: f.kategorie ?? "Miete", rechtsgrundlage: f.rechtsgrundlage, ziel: fristZiel("mieter", m.id, f.label, f.dokument), bezug: m.id, dokument: f.dokument });
    }
  }
  for (const k of kredite) {
    const wo = (k.prop_id && nameOf.get(k.prop_id)) || "–";
    for (const f of kreditFristen(k)) {
      if (!f.datum) continue;
      eintraege.push({ datum: f.datum, label: f.label, wer: k.bezeichnung ?? "Kredit", wo, quelle: "kredit", typ: f.typ, kategorie: f.kategorie ?? "Finanzierung", rechtsgrundlage: f.rechtsgrundlage, ziel: fristZiel("kredit", k.id, f.label), bezug: k.id });
    }
  }
  for (const p of properties) {
    for (const f of objektFristen(p)) {
      if (!f.datum) continue;
      eintraege.push({ datum: f.datum, label: f.label, wer: "", wo: p.bezeichnung, quelle: "objekt", typ: f.typ, kategorie: f.kategorie ?? "Sonstiges", rechtsgrundlage: f.rechtsgrundlage, ziel: fristZiel("objekt", p.id, f.label), bezug: p.id });
    }
  }
  // Globale Steuer-Fristen (Grundsteuer-Raten, ESt-Erklärung)
  for (const f of globaleFristen()) {
    if (!f.datum) continue;
    eintraege.push({ datum: f.datum, label: f.label, wer: "", wo: "Alle Objekte", quelle: "steuer", typ: f.typ, kategorie: f.kategorie ?? "Steuer", rechtsgrundlage: f.rechtsgrundlage, ziel: fristZiel("steuer", null, f.label) });
  }
  const heuteISO = heuteBerlin();
  for (const v of (vertreterRows ?? []) as { id: string; vorname: string | null; nachname: string; gueltig_bis: string; widerrufen_am: string | null }[]) {
    const status = vollmachtStatus(v, heuteISO);
    if (status === "widerrufen") continue;
    eintraege.push({
      datum: v.gueltig_bis.slice(0, 10),
      label: "Vollmacht endet",
      wer: vertreterName(v),
      wo: "Vertreter",
      quelle: "vertreter",
      typ: status === "gueltig" ? "info" : "warn",
      kategorie: "Sonstiges",
      ziel: fristZiel("vertreter", v.id, "Vollmacht endet"),
      bezug: v.id,
    });
  }
  for (const at of anliegenTermine((anlTerminRows ?? []) as AnliegenMitTermin[], termine)) {
    eintraege.push({
      datum: at.datum,
      label: at.label,
      wer: (at.mieterId && mieterName.get(at.mieterId)) || "",
      wo: (at.propId && nameOf.get(at.propId)) || "",
      quelle: "anliegen",
      typ: "info",
      kategorie: "Sonstiges",
      ziel: vorgangUrl(at.anliegenId),
      bezug: at.anliegenId,
    });
  }
  for (const t of termine) {
    if (!t.datum) continue;
    eintraege.push({
      datum: t.datum,
      label: t.titel ?? "Termin",
      wer: [t.mieter_id ? mieterName.get(t.mieter_id) : null, t.notiz].filter(Boolean).join(" · "),
      wo: (t.prop_id && nameOf.get(t.prop_id)) || "",
      quelle: "eigen",
      typ: "info",
      kategorie: t.kategorie ?? "Sonstiges",
      erledigt: t.erledigt ?? false,
      wiederkehrung: t.wiederkehrung,
      id: t.id,
      // Ablauf D: Ein Termin mit Mieter führt zu dessen Akte (Unterlagen, Schreiben), sonst zum Objekt.
      ziel: t.mieter_id ? `/tenants/${t.mieter_id}` : t.prop_id ? `/properties/${t.prop_id}` : undefined,
    });
  }

  // Abgeleitete Fristen bekommen einen Schluessel, ueber den sie aus- und wieder
  // eingeblendet werden koennen. Eigene Termine brauchen ihn nicht — die lassen
  // sich abhaken oder loeschen.
  // Ablauf D: Der Vermerk ist entweder „ausgeblendet“ (nur Ansicht) oder „erledigt“ (vom Vermieter mit
  // Zugangsdatum und Zustellweg bestätigt). Erledigt zählt wie ein abgehakter Termin.
  const vermerke = vermerkeAus(versteckt as FristVermerk[] | null);
  for (const e of eintraege) {
    // Eigene Termine hakt man ab, Anliegen-Termine schließt man mit dem Anliegen — kein Vermerk.
    if (e.quelle === "eigen" || e.quelle === "anliegen") continue;
    const v = fristVermerk(vermerke, e.quelle, e.bezug ?? null, e.datum, e.label);
    e.erledigtSchluessel = fristSchluessel(e.quelle, e.datum, e.label, e.bezug);
    e.schluessel = v?.schluessel ?? e.erledigtSchluessel;
    const erl = erledigtAus(v);
    e.ausgeblendet = !!v && !erl;
    e.erledigt = !!erl;
    if (e.dokument && e.bezug) e.vorgang = fristVorgang(e.dokument, e.bezug, e.datum, archiv, portal, erl);
  }

  eintraege.sort((a, b) => a.datum.localeCompare(b.datum));

  // ---- Filter ----
  const zeigeErledigte = searchParams.erledigte === "1";
  const zeigeAusgeblendete = searchParams.ausgeblendete === "1";
  const anzahlAusgeblendet = eintraege.filter((e) => e.ausgeblendet).length;
  const filterQ = searchParams.quelle;
  const filterK = searchParams.kategorie;
  let sichtbar = eintraege;
  if (!zeigeErledigte) sichtbar = sichtbar.filter((e) => !e.erledigt);
  if (!zeigeAusgeblendete) sichtbar = sichtbar.filter((e) => !e.ausgeblendet);
  if (filterQ) sichtbar = sichtbar.filter((e) => (filterQ === "auto" ? e.quelle !== "eigen" : e.quelle === filterQ));
  if (filterK) sichtbar = sichtbar.filter((e) => e.kategorie === filterK);

  const aktuellesJahr = Number(heuteISO.slice(0, 4));
  const jahr = searchParams.jahr ?? "rollierend";
  const jahre = Array.from(
    new Set([...eintraege.map((e) => Number(e.datum.slice(0, 4))), aktuellesJahr])
  ).sort((a, b) => b - a);
  // Zeitraum-Filter. Standard ist NICHT mehr das Kalenderjahr: Im Dezember
  // waren die Januar-Fristen damit unsichtbar, obwohl die KPI-Kachel „In 30
  // Tagen" sie mitzählte. Rollierend „nächste 12 Monate" plus alles
  // Überfällige — das entspricht dem, wonach man auf dieser Seite sucht.
  if (jahr === "rollierend") {
    const heuteMs = Date.parse(heuteISO);
    const in12M = heuteMs + 365 * 86400000;
    sichtbar = sichtbar.filter((e) => {
      const t = Date.parse(e.datum.slice(0, 10));
      return t <= in12M; // Vergangenes bleibt drin (überfällige Fristen)
    });
  } else if (jahr !== "alle") {
    sichtbar = sichtbar.filter((e) => Number(e.datum.slice(0, 4)) === Number(jahr));
  }

  const filters: FilterDef[] = [
    { name: "quelle", label: "Quelle", icon: "quelle", variant: "segmented", options: [{ value: "", label: "Alle" }, { value: "auto", label: "Automatisch" }, { value: "eigen", label: "Eigene" }] },
    { name: "kategorie", label: "Kategorie", icon: "kategorie", options: [{ value: "", label: "Alle Kategorien" }, ...TERMIN_KATEGORIEN.map((k) => ({ value: k, label: `${KATEGORIE_STIL[k]?.icon ?? ""} ${k}` })), { value: "Betriebskosten", label: "Betriebskosten" }] },
    { name: "jahr", label: "Zeitraum", icon: "jahr", defaultValue: "rollierend", options: [{ value: "rollierend", label: "Nächste 12 Monate" }, ...jahre.map((y) => ({ value: String(y), label: String(y) })), { value: "alle", label: "Alle" }] },
  ];

  // Tage bis zur Frist, gezählt in Berliner Kalendertagen (Audit P8, C15) — vorher gegen die
  // Uhrzeit des Servers (UTC), nach Mitternacht stand eine Frist noch einen Tag als „in 1 Tg.“ da.
  const heuteMs = Date.parse(heuteISO);
  const tageBis = (d: string) => Math.round((Date.parse(d.slice(0, 10)) - heuteMs) / 86400000);
  const heuteMonat = heuteISO.slice(0, 7);
  // Ausgeblendetes zaehlt auch in den Kacheln nicht mehr mit: Eine Zahl unter
  // „Ueberfaellig", zu der in der Liste nichts steht, ist schlimmer als keine.
  const offen = eintraege.filter((e) => !e.erledigt && !e.ausgeblendet);
  const anstehend = offen.filter((e) => tageBis(e.datum) >= 0);
  const in30 = anstehend.filter((e) => tageBis(e.datum) <= 30).length;
  const in90 = anstehend.filter((e) => tageBis(e.datum) <= 90).length;
  // Nur echte Aufgaben koennen ueberfaellig werden. Reine Ereignis-Marker
  // (typ "info": Mietbeginn, Kaufdatum ...) sind mit ihrem Datum erledigt —
  // ein vergangener Mietbeginn ist keine offene Frist.
  // Ebenso keine „Möglichkeit“ (typ "ok": Mieterhöhung/Indexanpassung möglich, Sonderkündigungsrecht):
  // Sie stand rot unter „Überfällig — vor 757 Tg.“ (Durchsicht 27.10.2026, M03).
  const istAufgabe = (e: Eintrag) => e.typ === "warn" || e.quelle === "eigen";
  const ueberfaellig = offen.filter((e) => tageBis(e.datum) < 0 && istAufgabe(e)).length;

  // ---- Monatsansicht ----
  const ansicht = searchParams.ansicht === "monat" ? "monat" : "liste";
  const monatParam = /^\d{4}-\d{2}$/.test(searchParams.monat ?? "") ? (searchParams.monat as string) : heuteMonat;
  const [mJahr, mMonat] = monatParam.split("-").map(Number);
  const ersterTag = new Date(mJahr, mMonat - 1, 1);
  const tageImMonat = new Date(mJahr, mMonat, 0).getDate();
  const startWochentag = (ersterTag.getDay() + 6) % 7; // Mo=0
  const vorMonat = `${mMonat === 1 ? mJahr - 1 : mJahr}-${String(mMonat === 1 ? 12 : mMonat - 1).padStart(2, "0")}`;
  const nachMonat = `${mMonat === 12 ? mJahr + 1 : mJahr}-${String(mMonat === 12 ? 1 : mMonat + 1).padStart(2, "0")}`;
  const proTag = new Map<string, Eintrag[]>();
  for (const e of eintraege) {
    if (!zeigeErledigte && e.erledigt) continue;
    if (!zeigeAusgeblendete && e.ausgeblendet) continue;
    if (e.datum.startsWith(monatParam)) {
      const arr = proTag.get(e.datum) ?? [];
      arr.push(e);
      proTag.set(e.datum, arr);
    }
  }
  const gewaehlterTag = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.tag ?? "") ? searchParams.tag : null;
  const monatsName = ersterTag.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const linkMit = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, ...patch })) if (v) q.set(k, String(v));
    return `/termine?${q.toString()}`;
  };

  // Ablauf D: Stand des Schreibens unter der Frist. „Fällig“ und „erledigt“ sind zwei Dinge — erledigt
  // ist die Frist erst, wenn der Vermieter den Zugang mit Datum und Weg bestätigt; das Formular dafür
  // klappt hier auf. Ein PDF oder ein Abruf im Portal erledigt nichts von selbst.
  const hier = linkMit({ flash: "", flashTyp: "" });
  const vorgangZeile = (e: Eintrag, v: FristVorgang, quelleUrl: string | null) => {
    const notizId = v.stand === "offen" ? null : v.notizId;
    return (
      <span className="tz-vorgang">
        <span style={{ color: v.stand === "erledigt" ? "var(--green)" : "var(--muted)" }}>{vorgangText(v)}</span>
        {v.stand === "offen" && e.ziel && <Link href={e.ziel}>Schreiben vorbereiten</Link>}
        {notizId && <a href={`/archiv/${notizId}/datei`} target="_blank" rel="noopener noreferrer">Schreiben öffnen</a>}
        {quelleUrl && <a href={quelleUrl} target="_blank" rel="noopener noreferrer">Gesetzestext</a>}
        {/* Eine Möglichkeit (typ "ok") hat keinen Zugang zu bestätigen — nur Pflichten. */}
        {v.stand !== "erledigt" && e.typ !== "ok" && e.erledigtSchluessel && (
          <details className="tz-erledigen">
            <summary>Zugang bestätigen</summary>
            <form action={erledigeFrist.bind(null, e.erledigtSchluessel)} className="tz-erledigen-form">
              <input type="hidden" name="zurueck" value={hier} />
              {notizId && <input type="hidden" name="notiz_id" value={notizId} />}
              <label>
                <span>Zugegangen am</span>
                <input type="date" name="erledigt_am" required max={heuteISO} defaultValue={heuteISO} className="input" />
              </label>
              <label>
                <span>Weg</span>
                <select name="zustellweg" required defaultValue="" className="input">
                  <option value="" disabled>bitte wählen</option>
                  {Object.entries(ZUSTELLWEGE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <button type="submit" className="btn btn-gold btn-sm">Als erledigt vermerken</button>
              <span className="tz-erledigen-hinweis">Nur vermerken, was du belegen kannst — MyImmo prüft den Zugang nicht.</span>
            </form>
          </details>
        )}
      </span>
    );
  };

  // Kompakte Terminzeile (03.10.2026, wie die Listen im Mieterportal und auf dem Dashboard):
  // links Abhaken bzw. Farbpunkt der Kategorie, dann Titel und darunter Kategorie · Mieter ·
  // Objekt, rechts Datum und Restzeit, ganz rechts die Aktionen. Die Rechtsgrundlage steht im
  // Tooltip der Zeile — sie war die längste und am seltensten gebrauchte Angabe.
  const zeile = (e: Eintrag, i: number) => {
    const tage = tageBis(e.datum);
    const stil = KATEGORIE_STIL[e.kategorie] ?? KATEGORIE_STIL.Sonstiges;
    const aufgabe = e.typ !== "info" || e.quelle === "eigen";
    const farbe = e.erledigt ? "var(--green)" : e.typ === "warn" || (tage < 0 && aufgabe) ? "var(--red)" : e.typ === "ok" ? "var(--green)" : "var(--muted)";
    // Nutzer tippen Kategorien auch klein („wartung") — angezeigt wird sie mit Großbuchstaben.
    const kategorie = e.kategorie.charAt(0).toUpperCase() + e.kategorie.slice(1);
    // Ablauf D: Rechtsgrundlage mit amtlicher Fundstelle und Prüfdatum (lib/fristQuellen.ts).
    const q = quelleZu(e.rechtsgrundlage);
    const tooltip = e.rechtsgrundlage ? (q ? `${e.rechtsgrundlage} — Wortlaut geprüft am ${datum(q.geprueft)}` : e.rechtsgrundlage) : undefined;
    return (
      <div key={`${e.quelle}-${e.bezug ?? e.id ?? i}-${e.datum}-${e.label}`} className="termin-zeile" style={{ opacity: e.erledigt ? 0.6 : 1 }} title={tooltip}>
        <span className="tz-markierung">
          {e.quelle === "eigen" && e.id ? (
            <form action={toggleErledigt.bind(null, e.id, !e.erledigt)} style={{ display: "inline-flex" }}>
              <button
                type="submit"
                className="tap44"
                aria-label={e.erledigt ? "Termin wieder öffnen" : "Termin als erledigt abhaken"}
                title={e.erledigt ? "Wieder öffnen" : "Als erledigt abhaken"}
                style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${e.erledigt ? "var(--green)" : "var(--line2)"}`, background: e.erledigt ? "var(--green-dim)" : "transparent", color: "var(--green)", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 11, lineHeight: 1, padding: 0 }}
              >
                {e.erledigt ? "✓" : ""}
              </button>
            </form>
          ) : (
            <span className="tz-punkt" style={{ background: stil.punkt }} title={kategorie} />
          )}
        </span>
        <span className="tz-text">
          <span className="listen-zeile-titel" style={{ textDecoration: e.erledigt ? "line-through" : undefined }}>
            {e.ziel ? <Link href={e.ziel} style={{ color: "inherit" }}>{e.label}</Link> : e.label}
            {e.wiederkehrung && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}><RotateCw size={11} style={{ verticalAlign: "-1px" }} /> {WIEDERKEHRUNG_LABEL[e.wiederkehrung] ?? e.wiederkehrung}</span>}
          </span>
          <span className="listen-zeile-sub">{[`${stil.icon} ${kategorie}`, e.wer, e.wo].filter(Boolean).join(" · ")}</span>
          {e.vorgang && vorgangZeile(e, e.vorgang, q?.url ?? null)}
        </span>
        <span className="tz-wann">
          <span className="tz-wann-datum">{datum(e.datum)}</span>
          <span className="tz-wann-rest" style={{ color: farbe }}>
            {e.erledigt ? "erledigt" : tage < 0 ? (aufgabe ? `vor ${Math.abs(tage).toLocaleString("de-DE")}\u00a0Tg.` : "erfolgt") : tage === 0 ? "heute" : `in ${tage.toLocaleString("de-DE")}\u00a0Tg.`}
          </span>
        </span>
        <span className="tz-aktionen">
          {e.quelle === "eigen" && e.id ? (
            <>
              <Link href={`/termine/${e.id}/edit`} className="delete-btn" title="Termin bearbeiten" aria-label="Termin bearbeiten" style={{ color: "var(--muted)" }}><Pencil size={14} /></Link>
              <DeleteButton action={deleteTermin.bind(null, e.id)} className="delete-btn" label={<X size={14} />} confirmText="Termin löschen?" />
            </>
          ) : e.schluessel && e.erledigt ? (
            // Erledigt-Vermerk aufheben (z. B. versehentlich bestätigt): löscht nur den Vermerk.
            <form action={zeigeFristWieder.bind(null, e.schluessel)} style={{ display: "inline-flex" }}>
              <button
                type="submit"
                className="delete-btn"
                aria-label="Erledigt-Vermerk aufheben"
                title="Erledigt-Vermerk aufheben — die Frist erscheint wieder als offen"
                style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "grid", placeItems: "center", width: 22 }}
              >
                <RotateCcw size={14} />
              </button>
            </form>
          ) : e.schluessel ? (
            // Abgeleitete Fristen liessen sich weder abhaken noch loeschen — eine
            // einmal verpasste Frist blieb fuer immer stehen. Ausblenden loescht
            // nichts; die Frist ergibt sich weiter aus den Stammdaten.
            <form action={(e.ausgeblendet ? zeigeFristWieder : blendeFristAus).bind(null, e.schluessel)} style={{ display: "inline-flex" }}>
              <button
                type="submit"
                className="delete-btn"
                aria-label={e.ausgeblendet ? "Wieder einblenden" : "Ausblenden"}
                title={e.ausgeblendet ? "Wieder einblenden" : "Ausblenden — die Frist bleibt berechnet, verschwindet nur aus der Liste"}
                style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "grid", placeItems: "center", width: 22 }}
              >
                {e.ausgeblendet ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </form>
          ) : null}
        </span>
      </div>
    );
  };

  // Liste nach Monaten gruppiert (03.10.2026): erst Überfälliges, dann je Monat eine
  // Überschrift — liest sich wie eine Agenda statt wie eine lange Tabelle.
  const monatsTitel = (iso: string) => {
    const [y, m] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
  };
  const gruppiert = (liste: Eintrag[]) => {
    const out: React.ReactNode[] = [];
    let letzter = "";
    liste.forEach((e, i) => {
      const m = e.datum.slice(0, 7);
      if (m !== letzter) {
        out.push(<div key={`m-${m}-${i}`} className="tz-gruppe" data-kopf>{monatsTitel(e.datum)}</div>);
        letzter = m;
      }
      out.push(zeile(e, i));
    });
    return out;
  };

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Termine</div>
          <div className="topbar-sub">Automatische Fristen aus Mietern, Krediten &amp; Steuer plus eigene Termine · Angaben ohne Gewähr</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={linkMit({ ansicht: ansicht === "monat" ? "" : "monat" })} className="btn btn-ghost" style={{ fontSize: 12 }}>
            {ansicht === "monat" ? "☰ Liste" : "▦ Monat"}
          </Link>
          <a href="/termine/ical" className="btn btn-ghost" style={{ fontSize: 12 }} title="Alle anstehenden Termine als iCal-Datei für deinen Kalender">
            <CalendarDays size={14} style={{ verticalAlign: "-2px" }} /> Kalender-Export (.ics)
          </a>
        </div>
      </div>
      <hr className="topbar-rule" />

      <div className="staffel grid-4 mb-20">
        <div className="kpi-card"><div className="kpi-label">Anstehend</div><div className="kpi-value">{anstehend.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">In 30 Tagen</div><div className="kpi-value" style={{ color: in30 > 0 ? "var(--amber)" : "var(--text)" }}>{in30}</div></div>
        <div className="kpi-card"><div className="kpi-label">In 90 Tagen</div><div className="kpi-value">{in90}</div></div>
        <div className="kpi-card"><div className="kpi-label">Überfällig</div><div className="kpi-value" style={{ color: ueberfaellig > 0 ? "var(--red)" : "var(--green)" }}>{ueberfaellig}</div></div>
      </div>

      <AufklappForm label={<><Plus size={14} style={{ verticalAlign: "-2px" }} /> Neuer Termin</>}>
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header"><h3><Plus size={16} style={{ verticalAlign: "-3px" }} /> Neuer Termin</h3></div>
        <div className="section-body">
          <form action={createTermin} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "var(--track-caption)" }}>Titel</span>
              <input name="titel" required className="input" placeholder="z. B. Heizungswartung" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "var(--track-caption)" }}>Datum</span>
              <input name="datum" type="date" required className="input" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "var(--track-caption)" }}>Kategorie</span>
              <select name="kategorie" className="input">
                {TERMIN_KATEGORIEN.map((k) => <option key={k} value={k}>{KATEGORIE_STIL[k]?.icon} {k}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "var(--track-caption)" }}>Wiederkehrung</span>
              <select name="wiederkehrung" className="input">
                <option value="">einmalig</option>
                {Object.entries(WIEDERKEHRUNG_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "var(--track-caption)" }}>Objekt</span>
              <select name="prop_id" className="input">
                <option value="">—</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "var(--track-caption)" }}>Mieter</span>
              <select name="mieter_id" className="input">
                <option value="">—</option>
                {mieter.map((m) => <option key={m.id} value={m.id}>{[m.vorname, m.nachname].filter(Boolean).join(" ")}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, width: 90 }}>
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "var(--track-caption)" }}>Vorlauf (Tg.)</span>
              <input name="vorlauf_tage" type="number" min="0" max="365" className="input" placeholder="—" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, flex: 1, minWidth: 140 }}>
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "var(--track-caption)" }}>Notiz</span>
              <input name="notiz" className="input" />
            </label>
            <button className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Termin</button>
          </form>

          {/* Prüfpflichten-Katalog: Ein Klick legt den wiederkehrenden Termin an.
              EIN gemeinsames Formular — jeder Button trägt seine Vorlage als
              formAction, das Objekt-Select gilt für alle. */}
          <form style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Schnell anlegen (Wartung &amp; Pflichtprüfungen)</div>
              <select name="prop_id" className="input" style={{ fontSize: 11.5, padding: "3px 8px", width: "auto" }}>
                <option value="">Objekt: keins / alle</option>
                {(props ?? []).map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {WARTUNGS_VORLAGEN.map((v) => (
                <button
                  key={v.titel}
                  formAction={createVorlageTermin.bind(null, v.titel, v.wiederkehrung, v.kategorie, v.notiz, null)}
                  className="btn btn-ghost"
                  style={{ fontSize: 11.5, opacity: v.kern ? 1 : 0.75 }}
                  title={`${v.notiz}${v.relevanz ? ` · Nur relevant: ${v.relevanz}` : ""} · ${WIEDERKEHRUNG_LABEL[v.wiederkehrung]}`}
                >
                  {KATEGORIE_STIL[v.kategorie]?.icon} {v.titel} <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "var(--track-caption)" }}><RotateCw size={11} style={{ verticalAlign: "-1px" }} /> {WIEDERKEHRUNG_LABEL[v.wiederkehrung]}</span>
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>
      </AufklappForm>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}><FilterBar filters={filters} /></div>
        <Link href={linkMit({ erledigte: zeigeErledigte ? "" : "1" })} className="btn btn-ghost" style={{ fontSize: 11.5, marginBottom: 16 }}>
          {zeigeErledigte ? "✓ Erledigte ausblenden" : "Erledigte anzeigen"}
        </Link>
        {/* Nur zeigen, wenn es auch etwas Ausgeblendetes gibt — sonst ist es
            ein Knopf, der nichts tut. */}
        {anzahlAusgeblendet > 0 && (
          <Link href={linkMit({ ausgeblendete: zeigeAusgeblendete ? "" : "1" })} className="btn btn-ghost" style={{ fontSize: 11.5, marginBottom: 16 }}>
            {zeigeAusgeblendete
              ? "✓ Ausgeblendete verstecken"
              : `Ausgeblendete anzeigen (${anzahlAusgeblendet})`}
          </Link>
        )}
      </div>

      {ansicht === "monat" ? (
        <div className="section">
          <div className="section-header">
            <h3>{monatsName}</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <Link href={linkMit({ monat: vorMonat, tag: "" })} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }}>←</Link>
              <Link href={linkMit({ monat: heuteMonat, tag: "" })} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }}>Heute</Link>
              <Link href={linkMit({ monat: nachMonat, tag: "" })} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }}>→</Link>
            </div>
          </div>
          <div className="section-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
                <div key={w} style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", padding: "2px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{w}</div>
              ))}
              {Array.from({ length: startWochentag }).map((_, i) => <div key={`leer-${i}`} />)}
              {Array.from({ length: tageImMonat }).map((_, i) => {
                const tagIso = `${monatParam}-${String(i + 1).padStart(2, "0")}`;
                const tagesEintraege = proTag.get(tagIso) ?? [];
                const istHeute = tagIso === heuteISO;
                const aktiv = gewaehlterTag === tagIso;
                return (
                  <Link
                    key={tagIso}
                    href={linkMit({ tag: aktiv ? "" : tagIso })}
                    style={{
                      minHeight: 56, borderRadius: 8, padding: "5px 7px", textDecoration: "none",
                      border: `1px solid ${aktiv ? "var(--gold)" : istHeute ? "var(--gold-dim)" : "var(--line)"}`,
                      background: aktiv ? "var(--gold-pale)" : "var(--bg3)", color: "var(--text)",
                      display: "flex", flexDirection: "column", gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, color: istHeute ? "var(--gold)" : "var(--muted)", fontWeight: istHeute ? 700 : 400 }}>{i + 1}</span>
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {tagesEintraege.slice(0, 4).map((e, j) => (
                        <span key={j} title={e.label} style={{ width: 7, height: 7, borderRadius: "50%", background: (KATEGORIE_STIL[e.kategorie] ?? KATEGORIE_STIL.Sonstiges).punkt }} />
                      ))}
                      {tagesEintraege.length > 4 && <span style={{ fontSize: 9, color: "var(--muted)" }}>+{tagesEintraege.length - 4}</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
            {/* Unter dem Raster die Termine des Monats als Liste — oder, nach Klick auf einen
                Tag, nur die dieses Tages (03.10.2026; vorher stand ohne Klick nichts da). */}
            {(() => {
              const liste = gewaehlterTag
                ? proTag.get(gewaehlterTag) ?? []
                : Array.from(proTag.entries()).sort(([a], [b]) => a.localeCompare(b)).flatMap(([, l]) => l);
              return (
                <div style={{ marginTop: 18 }}>
                  <div className="tz-gruppe" style={{ paddingTop: 0 }}>
                    {gewaehlterTag ? `Termine am ${datum(gewaehlterTag)}` : `Termine im ${monatsName}`}
                    {gewaehlterTag && <Link href={linkMit({ tag: "" })} style={{ marginLeft: 10, color: "var(--gold)", textTransform: "none", letterSpacing: 0 }}>ganzer Monat</Link>}
                  </div>
                  {liste.length === 0
                    ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{gewaehlterTag ? "Keine Termine an diesem Tag." : "Keine Termine in diesem Monat."}</div>
                    : liste.map(zeile)}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="section">
          <div className="section-header">
            {/* Hieß „Anstehende Termine", enthielt aber auch Überfälliges
                („vor 40 Tg."). Überfälliges steht jetzt in einer eigenen
                Gruppe darüber, der Rest heißt neutral „Termine". */}
            <h3>Termine</h3>
          </div>
          <div className="section-body">
            {sichtbar.length === 0 ? (
              // Zwei Fälle, die vorher beide „Keine Termine" hießen: Wer noch
              // gar nichts angelegt hat, braucht einen Einstieg — wer nur
              // gefiltert hat, braucht den Hinweis auf den Filter, sonst hält
              // er seine Termine für verschwunden.
              eintraege.length === 0 ? (
                <Leer
                  icon={CalendarDays}
                  titel="Noch keine Termine"
                  text="Hier laufen Fristen und Termine zusammen — Nebenkosten, Mieterhöhungen, Wartungen. Vieles trägt MyImmo automatisch ein, sobald Objekte und Mieter erfasst sind."
                  aktion={{ href: "/properties", label: "Zu den Objekten" }}
                />
              ) : (
                <Leer
                  art="filter"
                  icon={CalendarDays}
                  titel="Keine Termine in dieser Auswahl"
                  text="Es gibt Termine, aber keiner passt zu den gesetzten Filtern. Setze Jahr, Quelle oder Kategorie zurück."
                />
              )
            ) : (
              <ExpandableList limit={12} label="weitere Termine">
                {(() => {
                  const ueber = sichtbar.filter((e) => tageBis(e.datum) < 0 && istAufgabe(e));
                  const vergangen = sichtbar.filter((e) => tageBis(e.datum) < 0 && !(e.typ !== "info" || e.quelle === "eigen"));
                  const kommend = sichtbar.filter((e) => tageBis(e.datum) >= 0);
                  return [
                    ...(ueber.length > 0
                      ? [<div key="h-ueber" className="tz-gruppe" data-kopf style={{ color: "var(--red)" }}>Überfällig ({ueber.length})</div>, ...ueber.map(zeile)]
                      : []),
                    ...gruppiert(kommend),
                    ...(vergangen.length > 0
                      ? [<div key="h-vergangen" className="tz-gruppe" data-kopf>Vergangen</div>, ...vergangen.map(zeile)]
                      : []),
                  ];
                })()}
              </ExpandableList>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
