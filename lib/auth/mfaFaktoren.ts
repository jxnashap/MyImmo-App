// Unbestätigte TOTP-Faktoren finden — die Reste einer abgebrochenen 2FA-Einrichtung.
//
// WARUM (30.09.2026, Supabase-Log): `listFactors().totp` enthält in supabase-js
// NUR BESTÄTIGTE Faktoren (Typ `Factor<'totp','verified'>[]`); unbestätigte
// stehen ausschließlich in `.all`. Die Aufräumschleife suchte in `.totp` nach
// unbestätigten — und fand nie einen. Wer die Einrichtung ohne „Abbrechen"
// verließ (Seite neu geladen, Tab zu), bekam danach bei JEDEM Versuch
// „A factor with the friendly name "MyImmo" for this user already exists"
// (neunmal in zwei Minuten im Log) — 2FA war für das Konto dauerhaft blockiert.

type FaktorZeile = { id: string; factor_type?: string; status?: string };

export function unbestaetigteTotp(data: { all?: FaktorZeile[] | null } | null | undefined): string[] {
  return (data?.all ?? [])
    .filter((f) => f.factor_type === "totp" && f.status !== "verified")
    .map((f) => f.id);
}
