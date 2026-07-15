"use server";

// Open Banking (Etappe 2): Konto verbinden + Umsätze abrufen.
// Nur Lesezugriff; sensible Felder werden App-seitig verschlüsselt gespeichert.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decryptNullable } from "@/lib/crypto/secure";
import {
  ebKonfiguriert,
  starteAutorisierung,
  holeTransaktionen,
  transaktionsRef,
} from "@/lib/banking/enableBanking";

function baseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Schritt 1: Autorisierung starten → liefert die Bank-Login-URL. */
export async function starteBankVerbindung(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  if (!ebKonfiguriert()) return { error: "Banking ist noch nicht konfiguriert (Env-Variablen fehlen)." };

  const aspspName = String(formData.get("aspspName") ?? "").trim();
  const aspspCountry = String(formData.get("aspspCountry") ?? "").trim().toUpperCase();
  const propId = String(formData.get("propId") ?? "").trim();
  if (!aspspName || !/^[A-Z]{2}$/.test(aspspCountry)) return { error: "Bitte eine Bank wählen." };

  // state anlegen — der Callback findet darüber den Nutzer/Kontext wieder.
  const { data: anfrage, error } = await supabase
    .from("bank_auth_anfragen")
    .insert({ user_id: user.id, aspsp_name: aspspName, aspsp_country: aspspCountry, prop_id: propId || null })
    .select("state")
    .single();
  if (error || !anfrage) return { error: "Verbindung konnte nicht gestartet werden." };

  const gueltigBis = new Date(Date.now() + 89 * 24 * 60 * 60 * 1000); // knapp unter PSD2-Maximum
  try {
    const url = await starteAutorisierung({
      aspspName,
      aspspCountry,
      redirectUrl: `${baseUrl()}/api/banking/callback`,
      state: anfrage.state as string,
      gueltigBis,
    });
    return { url };
  } catch (e) {
    console.error("Banking-Auth fehlgeschlagen:", e instanceof Error ? e.message : e);
    return { error: "Die Bank-Autorisierung konnte nicht gestartet werden. Ist die Redirect-URL bei Enable Banking registriert?" };
  }
}

/** Umsätze eines verbundenen Kontos abrufen und verschlüsselt speichern. */
export async function aktualisiereUmsaetze(
  verbindungId: string,
): Promise<{ neu?: number; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: v } = await supabase
    .from("bankverbindungen")
    .select("id,account_uid")
    .eq("id", verbindungId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!v) return { error: "Verbindung nicht gefunden." };

  let transaktionen;
  try {
    transaktionen = await holeTransaktionen(v.account_uid);
  } catch (e) {
    console.error("Umsatz-Abruf fehlgeschlagen:", e instanceof Error ? e.message : e);
    return { error: "Umsätze konnten nicht abgerufen werden — ggf. ist die Freigabe abgelaufen (alle 90 Tage neu bestätigen)." };
  }

  // Upsert mit Dedup über (verbindung_id, transaktions_ref)
  const zeilen = transaktionen.map((t) => {
    const vorzeichen = t.credit_debit_indicator === "DBIT" ? -1 : 1;
    const gegen = t.credit_debit_indicator === "DBIT" ? t.creditor?.name : t.debtor?.name;
    const zweck = (t.remittance_information ?? []).join(" ").trim();
    return {
      user_id: user.id,
      verbindung_id: v.id,
      transaktions_ref: transaktionsRef(t),
      buchungsdatum: t.booking_date ?? t.value_date ?? null,
      betrag: vorzeichen * Math.abs(parseFloat(t.transaction_amount.amount) || 0),
      waehrung: t.transaction_amount.currency ?? "EUR",
      gegenpartei: gegen ? encrypt(gegen) : null,
      verwendungszweck: zweck ? encrypt(zweck) : null,
    };
  });

  let neu = 0;
  if (zeilen.length > 0) {
    // vorhandene Refs holen, nur wirklich neue zählen/einfügen
    const { data: vorhandene } = await supabase
      .from("bank_umsaetze")
      .select("transaktions_ref")
      .eq("verbindung_id", v.id);
    const bekannt = new Set((vorhandene ?? []).map((r) => r.transaktions_ref));
    const frisch = zeilen.filter((z) => !bekannt.has(z.transaktions_ref));
    neu = frisch.length;
    if (frisch.length > 0) {
      const { error } = await supabase.from("bank_umsaetze").insert(frisch);
      if (error) return { error: "Umsätze konnten nicht gespeichert werden." };
    }
  }

  await supabase
    .from("bankverbindungen")
    .update({ letzter_abruf: new Date().toISOString() })
    .eq("id", v.id)
    .eq("user_id", user.id);

  revalidatePath("/banking");
  return { neu };
}

/** Verbindung (inkl. gespeicherter Umsätze, via CASCADE) entfernen. */
export async function loescheBankVerbindung(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bankverbindungen").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/banking");
  return { ok: true };
}

/** Einen Bank-Eingang als Mieteingang bestätigen (Etappe 3, „vorschlagen + bestätigen"). */
export async function bestaetigeUmsatzAlsMiete(input: {
  umsatzId: string;
  mieterId: string;
  propId: string | null;
  nkAnteil: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: u } = await supabase
    .from("bank_umsaetze")
    .select("id,betrag,buchungsdatum,status")
    .eq("id", input.umsatzId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!u) return { ok: false, error: "Umsatz nicht gefunden." };
  if (u.status === "bestaetigt") return { ok: true }; // Doppelklick
  const betrag = Number(u.betrag);
  if (!(betrag > 0) || !u.buchungsdatum)
    return { ok: false, error: "Nur Eingänge mit Buchungsdatum können als Miete gebucht werden." };

  // Mieter muss dem Nutzer gehören (RLS sichert das ohnehin, aber früh prüfen).
  const { data: m } = await supabase
    .from("mieter")
    .select("id,prop_id")
    .eq("id", input.mieterId)
    .maybeSingle();
  if (!m) return { ok: false, error: "Mieter nicht gefunden." };

  // Idempotenz wie im Mietkonto: gleicher Mieter + gleiches Datum → vorhandene
  // Einnahme verknüpfen statt doppelt zu buchen.
  const { data: schonDa } = await supabase
    .from("einnahmen")
    .select("id")
    .eq("mieter_id", input.mieterId)
    .eq("kategorie", "Miete")
    .eq("buchungsdatum", u.buchungsdatum)
    .limit(1);

  let einnahmeId = schonDa?.[0]?.id as string | undefined;
  if (!einnahmeId) {
    const nk = input.nkAnteil != null && Number.isFinite(Number(input.nkAnteil)) ? Number(input.nkAnteil) : null;
    const { data: neu, error } = await supabase
      .from("einnahmen")
      .insert({
        user_id: user.id,
        mieter_id: input.mieterId,
        prop_id: input.propId ?? m.prop_id,
        buchungsdatum: u.buchungsdatum, // tatsächlicher Zufluss (§ 11 EStG)
        kategorie: "Miete",
        betrag,
        beschreibung: "Mieteingang (Bank-Abgleich)",
        nk_anteil: nk,
        wiederkehrend: true,
      })
      .select("id")
      .single();
    if (error || !neu) return { ok: false, error: "Buchen fehlgeschlagen." };
    einnahmeId = neu.id;
  }

  await supabase
    .from("bank_umsaetze")
    .update({ status: "bestaetigt", einnahme_id: einnahmeId })
    .eq("id", u.id)
    .eq("user_id", user.id);

  revalidatePath("/banking");
  revalidatePath("/mietkonto");
  revalidatePath("/cashflow");
  return { ok: true };
}

/** Einen Bank-Ausgang als Kosten-Buchung bestätigen. */
export async function bestaetigeUmsatzAlsKosten(input: {
  umsatzId: string;
  propId: string | null;
  kategorie: string;
  beschreibung: string;
  wiederkehrend: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { data: u } = await supabase
    .from("bank_umsaetze")
    .select("id,betrag,buchungsdatum,status")
    .eq("id", input.umsatzId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!u) return { ok: false, error: "Umsatz nicht gefunden." };
  if (u.status === "bestaetigt") return { ok: true }; // Doppelklick
  const betrag = Number(u.betrag);
  if (!(betrag < 0) || !u.buchungsdatum)
    return { ok: false, error: "Nur Ausgänge mit Buchungsdatum können als Kosten gebucht werden." };

  const kategorie = input.kategorie.trim() || "Sonstiges";
  const beschreibung = input.beschreibung.trim().slice(0, 200) || "Bank-Umsatz";

  const { data: neu, error } = await supabase
    .from("kosten")
    .insert({
      user_id: user.id,
      prop_id: input.propId || null,
      buchungsdatum: u.buchungsdatum,
      kategorie,
      betrag: Math.abs(betrag),
      beschreibung,
      wiederkehrend: Boolean(input.wiederkehrend),
    })
    .select("id")
    .single();
  if (error || !neu) return { ok: false, error: "Buchen fehlgeschlagen." };

  await supabase
    .from("bank_umsaetze")
    .update({ status: "bestaetigt", kosten_id: neu.id })
    .eq("id", u.id)
    .eq("user_id", user.id);

  revalidatePath("/banking");
  revalidatePath("/kosten");
  revalidatePath("/cashflow");
  return { ok: true };
}

/** Umsatz ausblenden / wieder einblenden (privates herausfiltern). */
export async function setzeUmsatzStatus(id: string, status: "neu" | "ausgeblendet") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase
    .from("bank_umsaetze")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id)
    .neq("status", "bestaetigt"); // bestätigte Buchungen nicht still umflaggen
  revalidatePath("/banking");
  return { ok: true };
}
