// Datentypen — spiegeln das BESTEHENDE Supabase-Schema von MyImmo.
// Besitzspalte überall: user_id (= auth.uid()), per RLS abgesichert.

export type Property = {
  id: string;
  user_id: string;
  bezeichnung: string;
  typ: string | null;
  adresse: string | null;
  kaufpreis: number | null;
  wert: number | null;        // aktueller Wert
  flaeche: number | null;
  baujahr: number | null;
  miete: number | null;       // Soll-Miete des Objekts
  hausgeld: number | null;
  obj_status: string | null;  // z.B. "Vermietet", "Leer"
  zimmer: number | null;
  energieklasse: string | null;
  notiz_import: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Tenant = {
  id: string;
  user_id: string;
  prop_id: string | null;
  vorname: string | null;
  nachname: string | null;
  email: string | null;
  telefon: string | null;
  mieter_adresse: string | null;
  einheit: string | null;
  mietbeginn: string | null;
  mietende: string | null;
  kuendigung: number | null;        // Kündigungsfrist (Monate)
  kaltmiete: number | null;
  nk_vorauszahlung: number | null;  // Nebenkosten-Vorauszahlung
  kaution: number | null;
  kaution_status: string | null;
  kaution_bank: string | null;
  mietspiegel: number | null;
  flaeche: number | null;
  mietart: string | null;            // z.B. "Standard", "Staffel", "Index"
  notiz: string | null;
  miethistorie: string | null;
  letzte_erhoehung: string | null;   // Datum der letzten Mieterhöhung
  staffel_datum: string | null;      // nächste Staffel-/Anpassungsstufe
  staffel_betrag: number | null;     // Erhöhungsbetrag je Stufe
  staffel_intervall: string | null;  // z.B. "12" (Monate) oder "jährlich"
  created_at: string | null;
};

export type Einnahme = {
  id: string;
  prop_id: string | null;
  buchungsdatum: string | null;
  kategorie: string | null;
  betrag: number | null;
  beschreibung: string | null;
  wiederkehrend: boolean | null;
};

export type Kosten = {
  id: string;
  prop_id: string | null;
  mieter_id: string | null;
  buchungsdatum: string | null;
  kategorie: string | null;
  betrag: number | null;
  beschreibung: string | null;
  notiz: string | null;
  wiederkehrend: boolean | null;
  rechnung_name: string | null;
  rechnung_type: string | null;
  rechnung_size: string | null;
};

export type Verbrauch = {
  id: string;
  prop_id: string | null;
  buchungsdatum: string | null;
  art: string | null;
  menge: number | null;
  einheit: string | null;
  verbrauchkosten: number | null;
};

export type Kredit = {
  id: string;
  prop_id: string | null;
  bezeichnung: string | null;
  bank: string | null;
  darlnr: string | null;
  betrag: number | null;
  restschuld: number | null;
  grundschuld: number | null;
  beleihung: number | null;
  zinssatz: number | null;
  tilgungssatz: number | null;
  monatsrate: number | null;
  zinsbindung: string | null;
  laufzeit: number | null;
};

export type Notiz = {
  id: string;
  prop_id: string | null;
  titel: string | null;
  kategorie: string | null;
  inhalt: string | null;
  created_at: string | null;
  datei_name: string | null;
  datei_type: string | null;
  datei_size: number | null;
};

export type VermieterProfil = {
  id: string;
  user_id: string;
  name: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  email: string | null;
  telefon: string | null;
  bankname: string | null;
  iban: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Iban = {
  id: string;
  user_id: string;
  kontoname: string;
  inhaber: string | null;
  iban: string;
  created_at: string | null;
};

export type Termin = {
  id: string;
  prop_id: string | null;
  titel: string | null;
  datum: string | null;
  notiz: string | null;
};

// Felder, die im Objekt-Formular bearbeitet werden
export const PROPERTY_FIELDS = [
  "bezeichnung", "typ", "adresse", "kaufpreis", "wert", "flaeche",
  "baujahr", "miete", "hausgeld", "obj_status", "zimmer", "energieklasse",
] as const;

// Felder, die im Mieter-Formular bearbeitet werden
export const TENANT_FIELDS = [
  "vorname", "nachname", "email", "telefon", "mieter_adresse", "einheit",
  "mietbeginn", "mietende", "kaltmiete", "nk_vorauszahlung", "kaution",
  "kaution_status", "flaeche", "mietart", "notiz",
] as const;
