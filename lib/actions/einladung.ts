"use server";

// Einladungscodes ("Schlüssel", Businessplan Kap. 14): Der Vermieter lädt einen Mieter
// in das Mieterportal ein.
//
// Seit 02.10.2026 an eine E-MAIL-ADRESSE gebunden (Vorgabe des Betreibers): Der Vermieter
// trägt die Adresse des Mieters zweimal ein, der Code gilt nur für ein Konto mit genau
// dieser bestätigten Adresse (Datenbank: einladungscode_einloesen / handle_new_user_rolle,
// Migration 20261002100000), und MyImmo schickt die Einladung selbst an diese Adresse.
// Vorher war der Code ein Inhaber-Schlüssel — wer ihn hatte, wurde Mieter der Wohnung.
// Hintergrund: docs/zukunft/MIETERPORTAL-AUSBAU.md (F3).
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { featureSperre } from "@/lib/planGate";
import { brevoBereit, sendeMail } from "@/lib/mail/brevo";
import { basisUrl } from "@/lib/net/basisUrl";
import { einladungsMail, pruefeEinladungsAdresse } from "@/lib/mieterZugang";

// Ohne verwechselbare Zeichen (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function neuerCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `MI-${s.slice(0, 4)}-${s.slice(4)}`;
}

export type EinladungErgebnis =
  | { error: string }
  | { code: string; gueltigBis: string; email: string; gesendet: boolean };

export async function erzeugeEinladungscode(
  mieterId: string,
  email: string,
  wiederholung: string,
): Promise<EinladungErgebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const adresse = pruefeEinladungsAdresse(email, wiederholung);
  if (!adresse.ok) return { error: adresse.fehler };

  // Tarif-Schranke. Ohne BILLING_ENFORCED kehrt featureSperre() sofort mit
  // null zurueck — ohne Datenbankabfrage, ohne Verhaltensaenderung.
  // Nur das ERZEUGEN ist geschraenkt: Bereits eingeloeste Zugaenge bleiben
  // gueltig, sonst wuerde ein Tarifwechsel Mieter aussperren, die nichts
  // dafuer koennen.
  const sperre = await featureSperre(supabase, "mieterportal");
  if (sperre) return { error: sperre };

  // Mieter muss dem angemeldeten Vermieter gehören.
  const { data: mieter } = await supabase
    .from("mieter")
    .select("id,prop_id,user_id")
    .eq("id", mieterId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mieter) return { error: "Mieter nicht gefunden." };

  // Alte, noch nicht eingelöste Codes dieses Mieters ersetzen. Schlägt das
  // fehl, darf NICHT weitergemacht werden: Sonst gäbe es zwei gültige Codes
  // für denselben Mieter, und der alte ist womöglich schon weitergegeben.
  const { error: altFehler } = await supabase
    .from("einladungscodes")
    .delete()
    .eq("mieter_id", mieterId)
    .eq("vermieter_id", user.id)
    .is("eingeloest_am", null);
  if (altFehler) return { error: "Der bisherige Code konnte nicht ersetzt werden. Bitte erneut versuchen." };

  const code = neuerCode();
  const { data, error } = await supabase
    .from("einladungscodes")
    .insert({
      vermieter_id: user.id,
      code,
      rolle: "mieter",
      mieter_id: mieterId,
      prop_id: mieter.prop_id,
      email: adresse.email,
    })
    .select("code,gueltig_bis")
    .single();
  if (error || !data) return { error: "Code konnte nicht erstellt werden." };

  // Versand an GENAU die eingetragene Adresse. Ohne Mail-Zugang (Brevo) bleibt
  // der Code trotzdem an die Adresse gebunden — der Vermieter verschickt dann
  // den fertigen Text selbst, und die Oberfläche sagt ehrlich, dass nichts
  // gesendet wurde.
  let gesendet = false;
  if (brevoBereit()) {
    const { data: profil } = await supabase
      .from("vermieter_profil")
      .select("name")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const link = `${await basisUrl()}/login?rolle=mieter&einladung=${encodeURIComponent(data.code as string)}`;
    const mail = einladungsMail({
      vermieter: (profil as { name?: string | null } | null)?.name ?? null,
      link,
      code: data.code as string,
      gueltigBis: data.gueltig_bis as string,
    });
    gesendet = await sendeMail({ an: adresse.email, betreff: mail.betreff, html: mail.html, text: mail.text });
  }

  revalidatePath(`/tenants/${mieterId}`);
  return { code: data.code as string, gueltigBis: data.gueltig_bis as string, email: adresse.email, gesendet };
}

export async function widerrufeEinladung(mieterId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  // Fehler auswerten: „widerrufen" gemeldet, Code weiterhin gültig — genau der
  // Fall, den ein Widerruf verhindern soll.
  const { error } = await supabase
    .from("einladungscodes")
    .delete()
    .eq("mieter_id", mieterId)
    .eq("vermieter_id", user.id)
    .is("eingeloest_am", null);
  if (error) return { error: "Einladung konnte nicht widerrufen werden — der Code ist weiterhin gültig." };
  revalidatePath(`/tenants/${mieterId}`);
  return { ok: true };
}

/**
 * Portal-Zugang trennen: Das verknüpfte Konto sieht danach nichts mehr von diesem
 * Mietverhältnis — auch keine früher freigegebenen Dokumente. Für Auszug, Mieterwechsel
 * in derselben Zeile und eine geänderte E-Mail-Adresse (danach neu einladen).
 */
export async function trenneMieterZugang(mieterId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  // Offene Einladungen zuerst: Sonst könnte ein alter Code den eben getrennten
  // Zugang sofort wiederherstellen.
  const { error: codeFehler } = await supabase
    .from("einladungscodes")
    .delete()
    .eq("mieter_id", mieterId)
    .eq("vermieter_id", user.id)
    .is("eingeloest_am", null);
  if (codeFehler) return { error: "Zugang konnte nicht getrennt werden — bitte erneut versuchen." };

  const { error } = await supabase
    .from("mieter_zugaenge")
    .delete()
    .eq("mieter_id", mieterId)
    .eq("vermieter_id", user.id);
  if (error) return { error: "Zugang konnte nicht getrennt werden — das Konto sieht weiterhin alles. Bitte erneut versuchen." };

  // Gegenprobe: Ein per RLS verschlucktes Löschen meldet keinen Fehler.
  const { data: rest, error: restFehler } = await supabase
    .from("mieter_zugaenge")
    .select("user_id")
    .eq("mieter_id", mieterId)
    .eq("vermieter_id", user.id)
    .limit(1);
  if (restFehler || (rest && rest.length > 0)) {
    return { error: "Zugang konnte nicht getrennt werden — das Konto sieht weiterhin alles. Bitte erneut versuchen." };
  }

  revalidatePath(`/tenants/${mieterId}`);
  revalidatePath("/portal");
  return { ok: true };
}
