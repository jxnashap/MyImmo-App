"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { zahlDe, datumIsoDe, nameSplit } from "@/lib/onboardingParse";

// Willkommens-Assistent (Design-Handoff Phase 1): legt aus drei Schritten
// Objekt + optional Mietverhältnis + optional Kredit in einem Zug an.
// Die "Artefakte" im Ergebnis sind ECHTE Folgen der Datenanlage (Wiederkehr-
// Vorlage, abgeleitete NK-Frist, AfA-Grundlage, Beleihungsordner) — keine Deko.

export type OnboardingEingaben = {
  typ: string;
  adresse: string;
  preis: string;
  flaeche: string;
  mieterName: string;
  kalt: string;
  nkv: string;
  beginn: string;
  kaution: string;
  darlehen: string;
  zins: string;
  rate: string;
  bindung: string;
};

export type OnboardingErgebnis =
  | {
      ok: true;
      propId: string;
      artefakte: { wiederkehr: boolean; nkFrist: boolean; afa: boolean; beleihung: true };
    }
  | { ok: false; error: string };

const TYPEN = ["Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie", "Ferienimmobilie", "Grundstück"];

export async function onboardingAnlegen(e: OnboardingEingaben): Promise<OnboardingErgebnis> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adresse = e.adresse.trim();
  if (!adresse) return { ok: false, error: "Bitte gib eine Adresse an." };
  const typ = TYPEN.includes(e.typ) ? e.typ : "Eigentumswohnung";

  const kaufpreis = zahlDe(e.preis);
  const flaeche = zahlDe(e.flaeche);
  const kalt = zahlDe(e.kalt);
  const nkv = zahlDe(e.nkv);
  const mieterName = e.mieterName.trim();
  const mitMieter = !!mieterName && kalt != null && kalt > 0;

  // Bezeichnung = Straßenteil vor dem ersten Komma (kurz für Listen), Adresse voll.
  const bezeichnung = adresse.split(",")[0].trim() || adresse;

  const { data: neu, error } = await supabase
    .from("properties")
    .insert({
      user_id: user.id,
      bezeichnung,
      typ,
      adresse,
      kaufpreis,
      kaufdatum: null,
      wert: kaufpreis, // Startwert = Kaufpreis; später über Marktwert-Schätzer/Index aktualisierbar
      flaeche,
      miete: mitMieter ? kalt : null,
      obj_status: mitMieter ? "Vermietet" : "Leer",
      afa_methode: "auto",
    })
    .select("id")
    .single();
  if (error || !neu?.id) return { ok: false, error: error?.message ?? "Objekt konnte nicht angelegt werden." };
  const propId = neu.id as string;

  // Wiederkehr-Vorlage "Miete" (gleiche Semantik wie das Objekt-Formular:
  // Vorlage anlegen, Buchungen erzeugt der Nutzer bewusst auf /cashflow).
  let wiederkehr = false;
  if (mitMieter) {
    const heute = new Date().toISOString().split("T")[0];
    const { error: wErr } = await supabase.from("wiederkehrende_buchungen").insert({
      user_id: user.id,
      art: "einnahme",
      prop_id: propId,
      kategorie: "Miete",
      betrag: kalt,
      beschreibung: `Kaltmiete ${bezeichnung} (automatisch)`,
      zyklus: "monatlich",
      start_datum: datumIsoDe(e.beginn) ?? heute,
      ende_datum: null,
      aktiv: true,
    });
    wiederkehr = !wErr;
  }

  // Mietverhältnis (optional, Schritt 2).
  let nkFrist = false;
  if (mitMieter) {
    const { vorname, nachname } = nameSplit(mieterName);
    const mietbeginn = datumIsoDe(e.beginn);
    const { error: mErr } = await supabase.from("mieter").insert({
      user_id: user.id,
      prop_id: propId,
      vorname,
      nachname,
      kaltmiete: kalt,
      nk_vorauszahlung: nkv,
      mietbeginn,
      kaution: zahlDe(e.kaution),
    });
    // NK-Abrechnungsfrist (§ 556 III) wird aus dem Mietverhältnis abgeleitet.
    nkFrist = !mErr && !!mietbeginn;
  }

  // Kredit (optional, Schritt 3).
  const darlehen = zahlDe(e.darlehen);
  const rate = zahlDe(e.rate);
  if ((darlehen != null && darlehen > 0) || (rate != null && rate > 0)) {
    await supabase.from("kredite").insert({
      user_id: user.id,
      prop_id: propId,
      bezeichnung: `Darlehen ${bezeichnung}`,
      betrag: darlehen,
      restschuld: darlehen,
      zinssatz: zahlDe(e.zins),
      monatsrate: rate,
      zinsbindung: datumIsoDe(e.bindung),
    });
  }

  for (const p of ["/", "/properties", "/tenants", "/kredite", "/cashflow", "/termine"]) revalidatePath(p);

  return {
    ok: true,
    propId,
    artefakte: { wiederkehr, nkFrist, afa: kaufpreis != null && kaufpreis > 0, beleihung: true },
  };
}
