"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashUrl, sicheresZiel } from "@/lib/flash";
import { encrypt } from "@/lib/crypto/secure";
import { normalizeIban } from "@/lib/iban";
import { mieterwechselVerdacht } from "@/lib/mieterZugang";
import { trenneMieterZugang } from "@/lib/actions/einladung";
import { heuteBerlin } from "@/lib/zeitraum";
import { abWannFragen, planeMietaenderung, type ZeitraumZeile } from "@/lib/sollAb";
import { schreibeMietaenderung } from "@/lib/mietaenderung";

function parse(formData: FormData) {
  const num = (k: string) => {
    const v = formData.get(k);
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };
  const str = (k: string) => {
    const v = formData.get(k);
    return v == null || v === "" ? null : String(v);
  };
  return {
    prop_id: str("prop_id"),
    vorname: str("vorname"),
    nachname: str("nachname"),
    email: str("email"),
    telefon: str("telefon"),
    mieter_adresse: str("mieter_adresse"),
    einheit: str("einheit"),
    mietbeginn: str("mietbeginn"),
    mietende: str("mietende"),
    kuendigung: num("kuendigung"),
    letzte_erhoehung: str("letzte_erhoehung"),
    kaltmiete: num("kaltmiete"),
    nk_vorauszahlung: num("nk_vorauszahlung"),
    stellplatz: str("stellplatz"),
    stellplatz_miete: num("stellplatz_miete"),
    kaution: num("kaution"),
    kaution_status: str("kaution_status"),
    flaeche: num("flaeche"),
    mietart: str("mietart"),
    staffel_datum: str("staffel_datum"),
    staffel_betrag: num("staffel_betrag"),
    staffel_intervall: str("staffel_intervall"),
    staffel_typ: str("staffel_typ"),
    staffel_prozent: num("staffel_prozent"),
    staffel_stufen: num("staffel_stufen"),
    notiz: str("notiz"),
    // B44: weitere Vertragspartner (Freitext, Zeilen bleiben erhalten; DB-Grenze 600 Zeichen).
    weitere_mieter: str("weitere_mieter")?.trim().slice(0, 600) || null,
  };
}

// Mieter-IBAN separat: wird VERSCHLÜSSELT gespeichert (wie ibans.iban),
// darf deshalb nicht durch parse() als Klartext laufen.
function ibanEnc(formData: FormData): string | null {
  const raw = String(formData.get("iban") ?? "").trim();
  return raw ? encrypt(normalizeIban(raw)) : null;
}

export async function createTenant(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("mieter").insert({ ...parse(formData), iban: ibanEnc(formData), user_id: user.id });
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  // Zurueck dorthin, wo der Nutzer angefangen hat. `/tenants/new` nimmt ein
  // `?back=` entgegen und zeigt es im Zurueck-Knopf an — ausgewertet wurde es
  // bisher nicht, weshalb man nach "+ Mieter" auf der Objektseite in der
  // Mieterliste landete und sein Objekt neu suchen musste.
  const ziel = sicheresZiel(formData.get("back"), "/tenants");
  revalidatePath(ziel);
  redirect(flashUrl(ziel, "Mieter angelegt."));
}

export async function updateTenant(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Geprüft (08.09.2026): TenantForm schickt ALLE Felder aus parse() mit, und
  // die Bearbeiten-Seite füllt die IBAN entschlüsselt vor — ein Speichern
  // löscht also nichts, was nicht im Formular stand (anders als seinerzeit
  // `notiz_import` in properties.ts).
  const neu = parse(formData);

  // S4 (03.10.2026): Mieterwechsel in derselben Zeile. Hängt ein Portal-Konto an diesem
  // Mieter und ändern sich Name oder Mietbeginn, entscheidet der Vermieter ausdrücklich:
  // „korrektur“ (gleiche Person) oder „trennen“ (neuer Mieter — der alte Zugang endet).
  // Die Oberfläche fragt vorher; hier wird es durchgesetzt, auch am Formular vorbei.
  // Fail-closed: Ohne gesicherte Auskunft über den Zugang wird nicht gespeichert.
  const [altRes, zugRes, zrRes] = await Promise.all([
    supabase.from("mieter").select("vorname,nachname,mietbeginn,kaltmiete,nk_vorauszahlung,stellplatz_miete,prop_id").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("mieter_zugaenge").select("user_id").eq("mieter_id", id).eq("vermieter_id", user.id).limit(1),
    supabase.from("miet_zeitraeume").select("id,von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete").eq("mieter_id", id).eq("user_id", user.id),
  ]);
  if (altRes.error || zugRes.error || zrRes.error) throw new Error("Mieter konnte nicht gespeichert werden — bitte erneut versuchen.");
  const alt = altRes.data as {
    vorname: string | null; nachname: string | null; mietbeginn: string | null;
    kaltmiete: number | null; nk_vorauszahlung: number | null; stellplatz_miete: number | null; prop_id: string | null;
  } | null;
  if (alt && (zugRes.data ?? []).length > 0 && mieterwechselVerdacht(alt, neu)) {
    const entscheidung = String(formData.get("mieterwechsel") ?? "");
    if (entscheidung === "trennen") {
      const r = await trenneMieterZugang(id);
      if ("error" in r && r.error) throw new Error(r.error);
    } else if (entscheidung !== "korrektur") {
      redirect(flashUrl(`/tenants/${id}/edit`, "Name oder Mietbeginn geändert, und an diesem Mieter hängt ein Portal-Konto. Bitte angeben, ob es ein neuer Mieter ist — nichts wurde gespeichert.", "error"));
    }
  }

  // Paket B (06.10.2026): Ändern sich Kaltmiete, NK-Vorauszahlung oder Stellplatzmiete eines
  // laufenden Mietverhältnisses, gilt das erst AB einem Monat — sonst rechnete das Mietkonto
  // rückwirkend mit dem neuen Betrag (Nacherfassung, Rückstand). „korrektur“ = Tippfehler,
  // gilt seit Beginn. Die Oberfläche fragt vorher; hier wird es durchgesetzt.
  if (alt) {
    const altBetraege = { kaltmiete: alt.kaltmiete, nk_vorauszahlung: alt.nk_vorauszahlung, stellplatz_miete: alt.stellplatz_miete };
    const neuBetraege = { kaltmiete: neu.kaltmiete, nk_vorauszahlung: neu.nk_vorauszahlung, stellplatz_miete: neu.stellplatz_miete };
    if (abWannFragen(neu.mietbeginn ?? alt.mietbeginn, altBetraege, neuBetraege, heuteBerlin().slice(0, 7))) {
      const ab = String(formData.get("miete_ab") ?? "");
      if (/^\d{4}-\d{2}$/.test(ab)) {
        const plan = planeMietaenderung({
          mietbeginn: neu.mietbeginn ?? alt.mietbeginn,
          alt: altBetraege,
          neu: neuBetraege,
          zeitraeume: (zrRes.data ?? []) as ZeitraumZeile[],
          abYm: ab,
        });
        const r = await schreibeMietaenderung(supabase, { userId: user.id, mieterId: id, propId: neu.prop_id ?? alt.prop_id, plan });
        if ("error" in r) redirect(flashUrl(`/tenants/${id}/edit`, r.error, "error"));
      } else if (ab !== "korrektur") {
        redirect(flashUrl(`/tenants/${id}/edit`, "Miete geändert — bitte angeben, ab welchem Monat der neue Betrag gilt. Nichts wurde gespeichert.", "error"));
      }
    }
  }

  const { error } = await supabase
    .from("mieter")
    .update({ ...neu, iban: ibanEnc(formData) })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  revalidatePath(`/tenants/${id}`);
  // Zurueck auf den Mieter, nicht in die Liste: Eingestiegen wird ueber
  // /tenants/<id>/edit. Wer in die Liste geworfen wird, muss seinen Mieter nach
  // jedem Speichern neu suchen (wie updateProperty).
  const ziel = sicheresZiel(formData.get("back"), `/tenants/${id}`);
  revalidatePath(ziel);
  redirect(flashUrl(ziel, "Mieter gespeichert."));
}

export async function deleteTenant(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("mieter").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  redirect("/tenants");
}
