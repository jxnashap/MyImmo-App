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
  mietart: string | null;
  notiz: string | null;
  created_at: string | null;
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
