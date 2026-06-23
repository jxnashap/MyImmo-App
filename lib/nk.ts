// Nebenkosten-Abrechnung — reine Berechnungslogik (ohne Abhängigkeiten).
// Quelle der Umlagebeträge: mieter_positionen (je Mieter, optional je Jahr).

export type NkRawPosition = {
  bezeichnung: string;
  betrag: number | null;
  umlageschluessel: string | null;
  umlagefaehig: boolean | null;
  jahr: number | null;
};

export type NkTenant = {
  vorname: string | null;
  nachname: string | null;
  mieter_adresse: string | null;
  einheit: string | null;
  flaeche: number | null;
  mietbeginn: string | null;
  mietende: string | null;
  nk_vorauszahlung: number | null;
};

export type NkProperty = {
  bezeichnung: string | null;
  adresse: string | null;
};

export type NkLine = {
  bezeichnung: string;
  umlageschluessel: string | null;
  betrag: number;
};

export type NkAbrechnung = {
  jahr: number;
  mieterName: string;
  mieterAdresse: string | null;
  objekt: string;
  objektAdresse: string | null;
  einheit: string | null;
  flaeche: number | null;
  zeitraumVon: string; // YYYY-MM-DD
  zeitraumBis: string; // YYYY-MM-DD
  monate: number; // belegte Monate im Abrechnungsjahr (0..12)
  positionen: NkLine[]; // umlagefähige Positionen
  ausgenommen: NkLine[]; // nicht umlagefähige (nur Hinweis)
  umlageGesamt: number;
  nkVorauszahlungMonat: number;
  vorauszahlungGeleistet: number;
  saldo: number; // > 0 = Guthaben (Erstattung), < 0 = Nachzahlung
};

function ym(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** Belegte volle Monate im Abrechnungsjahr aus Mietbeginn/-ende. */
export function monateImJahr(
  jahr: number,
  mietbeginn: string | null,
  mietende: string | null,
): { von: string; bis: string; monate: number } {
  const jahresStart = new Date(Date.UTC(jahr, 0, 1));
  const jahresEnde = new Date(Date.UTC(jahr, 11, 31));

  const beginn = mietbeginn ? new Date(mietbeginn) : jahresStart;
  const ende = mietende ? new Date(mietende) : jahresEnde;

  const von = beginn > jahresStart ? beginn : jahresStart;
  const bis = ende < jahresEnde ? ende : jahresEnde;

  if (von > bis) {
    return {
      von: jahresStart.toISOString().slice(0, 10),
      bis: jahresEnde.toISOString().slice(0, 10),
      monate: 0,
    };
  }

  const monate = Math.min(12, Math.max(0, ym(bis) - ym(von) + 1));
  return {
    von: von.toISOString().slice(0, 10),
    bis: bis.toISOString().slice(0, 10),
    monate,
  };
}

export function berechneNk(
  jahr: number,
  tenant: NkTenant,
  property: NkProperty | null,
  positionen: NkRawPosition[],
): NkAbrechnung {
  // Positionen des Jahres (oder ohne Jahresangabe = Altbestand) berücksichtigen.
  const relevant = positionen.filter((p) => p.jahr == null || p.jahr === jahr);

  const umlagefaehig: NkLine[] = relevant
    .filter((p) => p.umlagefaehig === true)
    .map((p) => ({
      bezeichnung: p.bezeichnung,
      umlageschluessel: p.umlageschluessel,
      betrag: p.betrag ?? 0,
    }));

  const ausgenommen: NkLine[] = relevant
    .filter((p) => p.umlagefaehig !== true)
    .map((p) => ({
      bezeichnung: p.bezeichnung,
      umlageschluessel: p.umlageschluessel,
      betrag: p.betrag ?? 0,
    }));

  const umlageGesamt = umlagefaehig.reduce((s, p) => s + p.betrag, 0);

  const { von, bis, monate } = monateImJahr(jahr, tenant.mietbeginn, tenant.mietende);

  const nkVorauszahlungMonat = tenant.nk_vorauszahlung ?? 0;
  const vorauszahlungGeleistet = nkVorauszahlungMonat * monate;
  const saldo = vorauszahlungGeleistet - umlageGesamt;

  const mieterName =
    [tenant.vorname, tenant.nachname].filter(Boolean).join(" ") || "Mieter";

  return {
    jahr,
    mieterName,
    mieterAdresse: tenant.mieter_adresse,
    objekt: property?.bezeichnung || "—",
    objektAdresse: property?.adresse ?? null,
    einheit: tenant.einheit,
    flaeche: tenant.flaeche,
    zeitraumVon: von,
    zeitraumBis: bis,
    monate,
    positionen: umlagefaehig,
    ausgenommen,
    umlageGesamt,
    nkVorauszahlungMonat,
    vorauszahlungGeleistet,
    saldo,
  };
}

export function deDatum(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}
