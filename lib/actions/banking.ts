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
