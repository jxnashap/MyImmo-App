// Profi-AVM-Adapter (PriceHubble / Sprengnetter / on-geo VALUE) — Stufe 3, Premium.
// Kostenpflichtig (Vertrag/Abo), daher als deaktivierter Stub hinter Feature-Flag.
// Nach Freigabe: hier den API-Call implementieren; Ergebnis wird als separate
// „Profi-Wertindikation" neben der ImmoWertV-Rechnung angezeigt (nicht vermischt).
//
// ENV: VALUATION_AVM_ENABLED = "true", AVM_API_KEY, AVM_ENDPOINT_URL

export type AvmWert = { marktwert: number; mietwert: number | null; quelle: string; stand: string | null };

export async function avmWert(
  _adresse: string | null,
  _obj: { typ?: string | null; flaeche?: number | null; baujahr?: number | null },
): Promise<AvmWert | null> {
  if (process.env.VALUATION_AVM_ENABLED !== "true") return null;
  // TODO: PriceHubble/Sprengnetter-Call mit AVM_API_KEY gegen AVM_ENDPOINT_URL.
  // Ohne Vertrag/Secrets bewusst null → nur ImmoWertV-Schätzung sichtbar.
  return null;
}
