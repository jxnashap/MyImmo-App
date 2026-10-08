// Gemeinsame PDF-Erzeugung für Brief, NK-Abrechnung und Übergabeprotokoll.
// Wird von den Download-Routen UND den „Speichern"-Server-Actions genutzt —
// eine Quelle für Daten-Laden + Builder-Aufruf, keine doppelte Logik.

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDocPdf } from "@/lib/pdf/docPdf";
import { buildNkPdf, vermieterAus } from "@/lib/pdf/nkPdf";
import { buildProtokollPdf, type ProtokollDaten } from "@/lib/pdf/protokollPdf";
import { berechneNk, type NkCo2Input } from "@/lib/nk";
import { ladeNkPositionen, nkCo2Argumente } from "@/lib/nkPositionen";
import { ladeVorauszahlung } from "@/lib/nkDaten";
import { decryptIbanRow } from "@/lib/ibanData";
import { decryptNullable } from "@/lib/crypto/secure";
import {
  TITEL,
  ART_BESCHEINIGUNG,
  ART_ZEIGT_KONTO,
  ART_BETRAG_RUECKFALL,
  briefDatum,
  fehlendePlatzhalter,
  satzanfangGross,
  fuelleVorlage,
  vorlageFuer,
  type DocArt,
} from "@/lib/dokumentVorlagen";
import {
  alleMieter,
  anrede,
  briefAblehnung,
  digitalGesperrt,
  type BriefAbgelehnt,
  empfaengerNamenZeilen,
  mieterhoehungBasis,
  namenAufzaehlung,
  pruefeBrief,
} from "@/lib/briefPruefung";
import { vertragswerte, type MietkontoZeitraum } from "@/lib/mietkonto";
import { heuteBerlin } from "@/lib/zeitraum";

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
  " €";
// DIN 5008: ausgeschrieben ohne führende Null, aus den Zahlen des ISO-Textes (= Vorschau).
const deDate = briefDatum;

const safe = (s: string) => (s || "Mieter").replace(/[^a-zA-Z0-9]+/g, "_");
const fmtIbanAnzeige = (s: string) =>
  s ? s.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim() : "";

export type ErzeugtesPdf = {
  pdf: Uint8Array;
  titel: string; // Anzeigename (Archiv-Titel)
  dateiname: string; // <...>.pdf
  mieterName: string;
  /** Pruefhinweise fuer den VERMIETER (nur NK) — nicht Teil des Briefs. */
  warnungen?: string[];
};

// ---------------------------------------------------------------- Brief ----
export type BriefFields = {
  art: string;
  datum: string;
  betrag: string;
  grund: string;
  ibanId: string;
  vName: string;
  vAdr: string;
  text: string;
  /** "1" = gespeicherte E-Signatur ins PDF einbetten (nie bei Schriftform-Arten). */
  signieren?: string;
  /** Zugang beim Mieter (ISO) — Grundlage der Fristen bei Kündigung und Mieterhöhung. */
  zugang?: string;
};

export async function erzeugeBriefPdf(
  supabase: SupabaseClient,
  userId: string,
  mieterId: string,
  f: BriefFields,
): Promise<ErzeugtesPdf | BriefAbgelehnt | null> {
  const art = (f.art as DocArt) || "allgemein";

  const { data: tenant } = await supabase
    .from("mieter")
    .select("vorname,nachname,weitere_mieter,mieter_adresse,einheit,prop_id,kaltmiete,nk_vorauszahlung,stellplatz_miete,mietbeginn,letzte_erhoehung,iban")
    .eq("id", mieterId)
    .single();
  if (!tenant) return null;

  const [{ data: property }, { data: profil }, { data: iban }, { data: zr }] = await Promise.all([
    tenant.prop_id
      ? supabase.from("properties").select("bezeichnung,adresse").eq("id", tenant.prop_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("vermieter_profil")
      .select("name,strasse,plz,ort,email")
      .eq("user_id", userId)
      .maybeSingle(),
    f.ibanId
      ? supabase.from("ibans").select("kontoname,inhaber,iban").eq("id", f.ibanId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("miet_zeitraeume").select("von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete").eq("mieter_id", mieterId),
  ]);
  const zeitraeume = (zr ?? []) as MietkontoZeitraum[];
  const heuteYm = heuteBerlin().slice(0, 7);

  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  // B44: alle Vertragspartner — Platzhalter {{mieter}}, Adressfeld und Anrede.
  const namen = alleMieter(mieterName, tenant.weitere_mieter);
  const objekt = property
    ? `${property.bezeichnung}${tenant.einheit ? ", " + tenant.einheit : ""}${property.adresse ? ", " + property.adresse : ""}`
    : "–";

  // Die Beträge, die DIESEN Monat gelten (Paket B) — wie die Vorschau (dokument/page.tsx).
  const gilt = vertragswerte(tenant, zeitraeume, heuteYm);
  const kaltmiete = gilt.kaltmiete;
  const nkvz = gilt.nk;
  const warm = kaltmiete + nkvz + gilt.stellplatz;
  // Betragsfeld ist type="number" (Punkt als Dezimaltrenner) — kein deutscher Freitext.
  const betragNum = parseFloat(f.betrag) || 0;
  // Ohne Eingabe die geschuldete WARMmiete (vorher Kaltmiete; Quittung blieb ganz leer).
  const effBetrag = betragNum > 0 ? betragNum : ART_BETRAG_RUECKFALL.includes(art) ? warm : 0;

  const werte: Record<string, string> = {
    mieter: namenAufzaehlung(namen) || "–",
    objekt,
    betrag: effBetrag > 0 ? eur(effBetrag) : "",
    miete: kaltmiete > 0 ? eur(kaltmiete) : "",
    datum: deDate(f.datum),
    grund: f.grund.trim(),
    mieterkonto: fmtIbanAnzeige(decryptNullable(tenant.iban) ?? ""),
    mietbeginn: tenant.mietbeginn ? deDate(tenant.mietbeginn) : "–",
    nkvz: nkvz > 0 ? eur(nkvz) : "0,00 €",
    warmmiete: warm > 0 ? eur(warm) : "",
    vermieter: f.vName || profil?.name || "",
  };

  const quelle = f.text.trim() ? f.text : vorlageFuer(art);

  // Gesamtprüfung P3: dieselbe Prüfung wie die Vorschau (DocGenerator) — hier die Schranke.
  // Ohne Absender kein Brief (B42, § 126b BGB nennt den Erklärenden); kein Rückfall auf „MyImmo“.
  const absenderName = (f.vName || profil?.name || "").trim();
  const pruefung = pruefeBrief({
    art,
    text: quelle,
    grund: f.grund,
    vName: absenderName,
    datum: f.datum,
    zugang: f.zugang ?? "",
    kuendigung: { ueberlassung: tenant.mietbeginn },
    mieterhoehung: { ...mieterhoehungBasis(tenant, zeitraeume, f.datum, heuteYm), neueMiete: betragNum },
    mieterAnzahl: namen.length,
  });
  const luecken = fehlendePlatzhalter(quelle, werte);
  if (luecken.length) pruefung.fehlend.push(...luecken.map((k) => `{{${k}}}`));
  const ablehnung = briefAblehnung(pruefung);
  if (ablehnung.length) return { abgelehnt: ablehnung };

  const gefuellt = fuelleVorlage(quelle, werte);
  const absaetze = ART_BESCHEINIGUNG.includes(art) ? satzanfangGross(gefuellt) : gefuellt;

  const ibanData = iban ? decryptIbanRow(iban) : null;
  // Zahlungskasten nur, wo der Brief zur Zahlung auffordert (nicht Quittung/Mieterhöhung).
  const konto = ART_ZEIGT_KONTO.includes(art) && ibanData?.iban ? ibanData : null;
  const absenderOrt = [profil?.plz, profil?.ort].filter(Boolean).join(" ") || null;

  // E-Signatur nur auf Wunsch laden und einbetten — nie bei Schriftform (A8: eine eingebettete
  // Bild-Unterschrift ist keine eigenhändige, § 126 BGB; die Kündigung wäre nichtig, § 125 BGB).
  let unterschriftPng: string | null = null;
  if (f.signieren === "1" && !digitalGesperrt(art)) {
    const { data: sig } = await supabase
      .from("unterschriften")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    unterschriftPng = sig?.data ?? null;
  }

  const pdf = await buildDocPdf({
    titel: TITEL[art] ?? "Schreiben",
    absender: {
      name: absenderName,
      adresse: f.vAdr || [profil?.strasse, absenderOrt].filter(Boolean).join(", ") || null,
      email: profil?.email ?? null,
      ort: profil?.ort ?? null,
    },
    empfaengerName: namenAufzaehlung(namen) || "–",
    empfaengerNamen: empfaengerNamenZeilen(namen),
    anrede: anrede(namen),
    // Fallback ohne Objektnamen — der enthält oft selbst die Straße, sie stand
    // im Adressfeld dann doppelt (gleiches Muster wie im DocGenerator).
    empfaengerAdresse:
      tenant.mieter_adresse ||
      [tenant.einheit, property?.adresse].filter(Boolean).join(", ") ||
      property?.bezeichnung ||
      "–",
    objekt,
    absaetze,
    konto,
    bescheinigung: ART_BESCHEINIGUNG.includes(art),
    unterschriftPng,
  });

  const titel = TITEL[art] ?? "Schreiben";
  return {
    pdf,
    titel: `${titel} – ${mieterName || "Mieter"}`,
    dateiname: `${art}_${safe(mieterName)}.pdf`,
    mieterName,
  };
}

// ------------------------------------------------------------------- NK ----
export async function erzeugeNkPdf(
  supabase: SupabaseClient,
  mieterId: string,
  jahr: number,
): Promise<ErzeugtesPdf | null> {
  // Konsequent wie beim Brief: Profil/IBAN explizit auf den angemeldeten
  // Nutzer filtern — nicht nur auf RLS verlassen.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenant } = await supabase
    .from("mieter")
    .select(
      "id,prop_id,vorname,nachname,mieter_adresse,einheit,flaeche,mietbeginn,mietende,nk_vorauszahlung,iban",
    )
    .eq("id", mieterId)
    .single();
  if (!tenant) return null;

  const [{ data: property }, nkPos, { data: profil }, { data: iban }, { data: co2Row }] =
    await Promise.all([
      tenant.prop_id
        ? supabase
            .from("properties")
            .select("bezeichnung,adresse")
            .eq("id", tenant.prop_id)
            .single()
        : Promise.resolve({ data: null }),
      // Dieselbe Quelle wie die NK-Seite (lib/nkPositionen.ts): Kosten am Objekt oder Altbestand.
      ladeNkPositionen(supabase, tenant, jahr),
      supabase
        .from("vermieter_profil")
        .select("name,strasse,plz,ort,email")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("ibans")
        .select("kontoname,inhaber,iban")
        .eq("user_id", user.id)
        .order("standard", { ascending: false })
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("nk_co2")
        .select("co2_kg,co2_kosten,flaeche,gewerbe")
        .eq("mieter_id", mieterId)
        .eq("jahr", jahr)
        .maybeSingle(),
    ]);

  const co2Arg = nkCo2Argumente(nkPos, (co2Row ?? null) as NkCo2Input | null);
  const abrechnung = berechneNk(
    jahr,
    tenant,
    property ?? null,
    nkPos.positionen,
    co2Arg.co2Input,
    await ladeVorauszahlung(mieterId, jahr),
    co2Arg.opts,
  );

  const pdf = await buildNkPdf(
    abrechnung,
    vermieterAus(profil, iban ? decryptIbanRow(iban) : null),
    { mieterIban: decryptNullable(tenant.iban) },
  );

  return {
    pdf,
    titel: `Nebenkostenabrechnung ${jahr}`,
    dateiname: `NK-Abrechnung_${jahr}_${safe(abrechnung.mieterName)}.pdf`,
    mieterName: abrechnung.mieterName,
    // Pruefhinweise fuer den VERMIETER durchreichen. Sie gehoeren nicht in den
    // Brief an den Mieter, duerfen aber auch nicht verlorengehen, wenn das PDF
    // ohne die Bildschirmansicht erzeugt wird (Download, Beleihungs-Mappe).
    warnungen: abrechnung.warnungen,
  };
}

// ------------------------------------------------------------ Protokoll ----
export type ProtokollFields = {
  typ: string;
  datum: string;
  strom: string;
  gas: string;
  wasser: string;
  schluessel: string;
  raeume: ProtokollDaten["raeume"];
};

export async function erzeugeProtokollPdf(
  supabase: SupabaseClient,
  userId: string,
  mieterId: string,
  f: ProtokollFields,
): Promise<ErzeugtesPdf | null> {
  const typ = f.typ === "auszug" ? ("auszug" as const) : ("einzug" as const);

  const { data: tenant } = await supabase
    .from("mieter")
    .select("vorname,nachname,einheit,prop_id")
    .eq("id", mieterId)
    .single();
  if (!tenant) return null;

  const [{ data: property }, { data: profil }] = await Promise.all([
    tenant.prop_id
      ? supabase.from("properties").select("bezeichnung,adresse").eq("id", tenant.prop_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("vermieter_profil").select("name").eq("user_id", userId).maybeSingle(),
  ]);

  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  const objekt = property
    ? `${property.bezeichnung}${tenant.einheit ? ", " + tenant.einheit : ""}${property.adresse ? ", " + property.adresse : ""}`
    : "–";

  const pdf = await buildProtokollPdf({
    typ,
    datum: f.datum,
    objekt,
    mieterName: mieterName || "–",
    vermieterName: profil?.name ?? "",
    strom: f.strom,
    gas: f.gas,
    wasser: f.wasser,
    schluessel: f.schluessel,
    raeume: f.raeume,
  });

  return {
    pdf,
    titel: `Übergabeprotokoll (${typ === "einzug" ? "Einzug" : "Auszug"})`,
    dateiname: `Uebergabeprotokoll_${safe(mieterName)}.pdf`,
    mieterName,
  };
}
