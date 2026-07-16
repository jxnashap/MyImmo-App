// Gemeinsame PDF-Erzeugung für Brief, NK-Abrechnung und Übergabeprotokoll.
// Wird von den Download-Routen UND den „Speichern"-Server-Actions genutzt —
// eine Quelle für Daten-Laden + Builder-Aufruf, keine doppelte Logik.

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDocPdf } from "@/lib/pdf/docPdf";
import { buildNkPdf, vermieterAus } from "@/lib/pdf/nkPdf";
import { buildProtokollPdf, type ProtokollDaten } from "@/lib/pdf/protokollPdf";
import { buildWohnungsgeberPdf } from "@/lib/pdf/wohnungsgeberPdf";
import { berechneNk, type NkRawPosition, type NkCo2Input } from "@/lib/nk";
import { decryptIbanRow } from "@/lib/ibanData";
import { decryptNullable } from "@/lib/crypto/secure";
import {
  TITEL,
  ART_BESCHEINIGUNG,
  ART_ZEIGT_BETRAG,
  fuelleVorlage,
  vorlageFuer,
  type DocArt,
} from "@/lib/dokumentVorlagen";

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
  " €";
const deDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "";

const safe = (s: string) => (s || "Mieter").replace(/[^a-zA-Z0-9]+/g, "_");
const fmtIbanAnzeige = (s: string) =>
  s ? s.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim() : "";

export type ErzeugtesPdf = {
  pdf: Uint8Array;
  titel: string; // Anzeigename (Archiv-Titel)
  dateiname: string; // <...>.pdf
  mieterName: string;
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
  /** "1" = gespeicherte E-Signatur ins PDF einbetten. */
  signieren?: string;
};

export async function erzeugeBriefPdf(
  supabase: SupabaseClient,
  userId: string,
  mieterId: string,
  f: BriefFields,
): Promise<ErzeugtesPdf | null> {
  const art = (f.art as DocArt) || "allgemein";

  const { data: tenant } = await supabase
    .from("mieter")
    .select("vorname,nachname,mieter_adresse,einheit,prop_id,kaltmiete,nk_vorauszahlung,stellplatz_miete,mietbeginn,iban")
    .eq("id", mieterId)
    .single();
  if (!tenant) return null;

  const [{ data: property }, { data: profil }, { data: iban }] = await Promise.all([
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
  ]);

  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  const objekt = property
    ? `${property.bezeichnung}${tenant.einheit ? ", " + tenant.einheit : ""}${property.adresse ? ", " + property.adresse : ""}`
    : "–";

  const kaltmiete = tenant.kaltmiete ?? 0;
  const betragNum = parseFloat(f.betrag) || 0;
  const fallbackMiete = art === "zahlungserinnerung" || art === "mahnung";
  const effBetrag = betragNum > 0 ? betragNum : fallbackMiete ? kaltmiete : 0;

  const nkvz = tenant.nk_vorauszahlung ?? 0;
  const warm = kaltmiete + nkvz + (tenant.stellplatz_miete ?? 0);
  const werte: Record<string, string> = {
    mieter: mieterName || "–",
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
  const absaetze = fuelleVorlage(quelle, werte);

  const ibanData = iban ? decryptIbanRow(iban) : null;
  const konto = ART_ZEIGT_BETRAG.includes(art) && ibanData?.iban ? ibanData : null;
  const absenderOrt = [profil?.plz, profil?.ort].filter(Boolean).join(" ") || null;

  // E-Signatur nur auf Wunsch laden und einbetten.
  let unterschriftPng: string | null = null;
  if (f.signieren === "1") {
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
      name: f.vName || profil?.name || "MyImmo",
      adresse: f.vAdr || [profil?.strasse, absenderOrt].filter(Boolean).join(", ") || null,
      email: profil?.email ?? null,
      ort: profil?.ort ?? null,
    },
    empfaengerName: mieterName || "–",
    empfaengerAdresse: tenant.mieter_adresse || objekt,
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

  const [{ data: property }, { data: positions }, { data: profil }, { data: iban }, { data: co2Row }] =
    await Promise.all([
      tenant.prop_id
        ? supabase
            .from("properties")
            .select("bezeichnung,adresse")
            .eq("id", tenant.prop_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("mieter_positionen")
        .select("bezeichnung,betrag,umlageschluessel,umlagefaehig,jahr,aufteilung,verbrauch_mieter,verbrauch_gesamt")
        .eq("mieter_id", mieterId)
        .order("created_at"),
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

  const abrechnung = berechneNk(
    jahr,
    tenant,
    property ?? null,
    (positions ?? []) as NkRawPosition[],
    (co2Row ?? null) as NkCo2Input | null,
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

// ------------------------------------------------ Wohnungsgeberbestätigung ----
export type WohnungsgeberFields = {
  vorgang: string;          // "einzug" | "auszug"
  datum: string;            // Einzugs-/Auszugsdatum, ISO
  weiterePersonen: string;  // zusätzliche meldepflichtige Personen, je Zeile
};

export async function erzeugeWohnungsgeberPdf(
  supabase: SupabaseClient,
  userId: string,
  mieterId: string,
  f: WohnungsgeberFields,
): Promise<ErzeugtesPdf | null> {
  const vorgang = f.vorgang === "auszug" ? ("auszug" as const) : ("einzug" as const);

  const { data: tenant } = await supabase
    .from("mieter")
    .select("vorname,nachname,mieter_adresse,einheit,prop_id,mietbeginn,mietende")
    .eq("id", mieterId)
    .single();
  if (!tenant) return null;

  const [{ data: property }, { data: profil }] = await Promise.all([
    tenant.prop_id
      ? supabase.from("properties").select("bezeichnung,adresse").eq("id", tenant.prop_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("vermieter_profil")
      .select("name,strasse,plz,ort")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  const wohnungsanschrift =
    [property?.adresse, tenant.einheit].filter(Boolean).join(", ") ||
    tenant.mieter_adresse ||
    property?.bezeichnung ||
    "—";
  const wohnungsgeberAnschrift =
    [profil?.strasse, [profil?.plz, profil?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  // Fallback-Datum: Einzug → Mietbeginn, Auszug → Mietende.
  const datum = f.datum || (vorgang === "auszug" ? tenant.mietende : tenant.mietbeginn) || "";
  const weitere = f.weiterePersonen
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const pdf = await buildWohnungsgeberPdf({
    vorgang,
    datum,
    wohnungsgeberName: profil?.name || "",
    wohnungsgeberAnschrift,
    wohnungsanschrift,
    personen: [mieterName, ...weitere].filter(Boolean),
  });

  return {
    pdf,
    titel: `Wohnungsgeberbestätigung (${vorgang === "einzug" ? "Einzug" : "Auszug"})`,
    dateiname: `Wohnungsgeberbestaetigung_${safe(mieterName)}.pdf`,
    mieterName,
  };
}
