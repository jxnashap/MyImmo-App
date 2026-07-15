// AfA-Assistent (D1): Planungslogik rund um die Gebäude-Abschreibung.
// Reine Rechenfunktionen ohne DB. KEINE Steuerberatung — vereinfachte Modelle
// zur Orientierung; maßgeblich sind der Einzelfall und der Steuerbescheid.
//
// Enthält:
//  1) afaSatzNachFertigstellung (§ 7 Abs. 4 EStG)
//  2) degressivVsLinear — Vergleich inkl. optimalem Wechseljahr (§ 7 Abs. 5a → Abs. 3)
//  3) pruefe7b — Sonder-AfA-Check (§ 7b EStG)
//  4) verteile82b — Erhaltungsaufwand auf 2–5 Jahre (§ 82b EStDV)
//  5) kaufpreisAufteilung — Gebäude-/Grundanteil

const r2 = (n: number) => Math.round(n * 100) / 100;

// -------------------------------------------------- 1) linearer AfA-Satz ----

/** AfA-Satz nach Fertigstellungsjahr, § 7 Abs. 4 S. 1 Nr. 2 EStG. */
export function afaSatzNachFertigstellung(jahr: number | null | undefined): number {
  if (!jahr) return 2;
  if (jahr >= 2023) return 3;   // Fertigstellung nach 31.12.2022
  if (jahr < 1925) return 2.5;  // vor 1925
  return 2;                     // 1925–2022
}

// ------------------------------------ 2) degressiv vs. linear (+ Wechsel) ----

export type AfaJahr = {
  jahr: number;        // 1..n (AfA-Jahr)
  degressiv: number;   // 5 % vom Restwert
  linear: number;      // fester linearer Betrag
  optimal: number;     // empfohlene Strategie (degressiv, dann Wechsel)
  restwertOptimal: number; // Restbuchwert der optimalen Strategie am Jahresende
};

export type AfaVergleich = {
  gebaeudeAK: number;
  linearSatz: number;      // % (i. d. R. 3 bei Neubau)
  nutzungsdauer: number;   // Jahre (100 / linearSatz)
  wechseljahr: number;     // AfA-Jahr, ab dem linear (vom Restwert) ≥ degressiv → Wechsel
  summeDegressiv10: number; // kumuliert nach 10 Jahren, rein degressiv
  summeOptimal10: number;   // kumuliert nach 10 Jahren, optimale Strategie
  plan: AfaJahr[];
};

/**
 * Vergleich degressive AfA (5 % vom Restbuchwert, § 7 Abs. 5a) gegen lineare AfA
 * und Ermittlung des optimalen Wechseljahres. Nach dem Wechsel wird der
 * Restbuchwert linear auf die verbleibende Nutzungsdauer verteilt (§ 7 Abs. 3) —
 * das ist ab dem Jahr sinnvoll, in dem dieser Betrag die degressive AfA übersteigt.
 */
export function degressivVsLinear(
  gebaeudeAK: number,
  linearSatz = 3,
  jahre = 15,
): AfaVergleich {
  const nd = Math.round(100 / linearSatz); // Nutzungsdauer, z. B. 33 Jahre bei 3 %
  const linearBetrag = r2((gebaeudeAK * linearSatz) / 100);

  const plan: AfaJahr[] = [];
  let restDeg = gebaeudeAK;      // Restwert rein degressiv
  let restOpt = gebaeudeAK;      // Restwert optimale Strategie
  let gewechselt = false;
  let wechseljahr = 0;
  let linearNachWechsel = 0;

  for (let i = 1; i <= jahre; i++) {
    const degressiv = r2(restDeg * 0.05);
    restDeg = r2(restDeg - degressiv);

    // Optimale Strategie
    let optimal: number;
    if (!gewechselt) {
      const restNutzungsdauer = Math.max(1, nd - (i - 1));
      const linearAusRest = r2(restOpt / restNutzungsdauer);
      const degOpt = r2(restOpt * 0.05);
      if (linearAusRest >= degOpt) {
        gewechselt = true;
        wechseljahr = i;
        linearNachWechsel = linearAusRest;
        optimal = linearAusRest;
      } else {
        optimal = degOpt;
      }
    } else {
      optimal = Math.min(linearNachWechsel, restOpt);
    }
    restOpt = r2(Math.max(0, restOpt - optimal));

    plan.push({ jahr: i, degressiv, linear: linearBetrag, optimal, restwertOptimal: restOpt });
  }

  const bis10 = (sel: (j: AfaJahr) => number) => r2(plan.slice(0, 10).reduce((s, j) => s + sel(j), 0));

  return {
    gebaeudeAK: r2(gebaeudeAK),
    linearSatz,
    nutzungsdauer: nd,
    wechseljahr: wechseljahr || jahre,
    summeDegressiv10: bis10((j) => j.degressiv),
    summeOptimal10: bis10((j) => j.optimal),
    plan,
  };
}

// --------------------------------------------- 3) § 7b Sonder-AfA-Check ----

export type Paragraf7bInput = {
  bauantragJahr: number | null;   // Jahr des Bauantrags/der Bauanzeige
  neueWohnung: boolean;           // bisher nicht vorhandene Wohnung
  qngNachweis: boolean;           // EH40/QNG-Nachweis (Effizienzhaus 40)
  baukostenProM2: number | null;  // tatsächliche Anschaffungs-/Herstellungskosten je m²
  flaeche: number | null;         // Wohnfläche m²
};

export type Paragraf7bErgebnis = {
  berechtigt: boolean;
  gruende: { ok: boolean; text: string }[];
  bemessungsgrundlageProM2: number; // gekappt auf 4.000 €/m²
  maxSonderAfaProJahr: number;      // 5 % der (gekappten) BMG, Jahre 1–4
  hinweis: string;
};

const P7B_BMG_MAX = 4000;   // €/m² Bemessungsgrundlage
const P7B_KOSTEN_MAX = 5200; // €/m² Baukostenobergrenze (ab Wachstumschancengesetz)

/** Prüft die Voraussetzungen der Sonderabschreibung § 7b EStG. */
export function pruefe7b(input: Paragraf7bInput): Paragraf7bErgebnis {
  const j = input.bauantragJahr;
  const zeitraumOk = j != null && j >= 2023 && j <= 2029;
  const kostenOk = input.baukostenProM2 != null && input.baukostenProM2 <= P7B_KOSTEN_MAX;
  const flaeche = input.flaeche ?? 0;

  const gruende = [
    { ok: zeitraumOk, text: "Bauantrag/Bauanzeige zwischen 2023 und 30.09.2029" },
    { ok: input.neueWohnung, text: "Neue, bisher nicht vorhandene Wohnung" },
    { ok: input.qngNachweis, text: "Effizienzhaus 40 / QNG-Nachweis (Nachhaltigkeitssiegel)" },
    { ok: kostenOk, text: `Baukosten höchstens ${P7B_KOSTEN_MAX.toLocaleString("de-DE")} €/m²` },
  ];
  const berechtigt = gruende.every((g) => g.ok);

  const bemessungsgrundlageProM2 = Math.min(input.baukostenProM2 ?? 0, P7B_BMG_MAX);
  const maxSonderAfaProJahr = berechtigt ? r2(bemessungsgrundlageProM2 * flaeche * 0.05) : 0;

  return {
    berechtigt,
    gruende,
    bemessungsgrundlageProM2: r2(bemessungsgrundlageProM2),
    maxSonderAfaProJahr,
    hinweis: berechtigt
      ? "Voraussetzungen erfüllt: zusätzlich bis 5 % p. a. in den Jahren 1–4 (max. 20 %) neben der linearen oder degressiven AfA. Bemessungsgrundlage gedeckelt auf 4.000 €/m². Überschreiten der Baukostengrenze durch nachträgliche Kosten in den ersten 3 Jahren führt zur Rückgängigmachung."
      : "Mindestens eine Voraussetzung ist nicht erfüllt — ohne alle Punkte keine Sonder-AfA nach § 7b.",
  };
}

// ------------------------------------ 4) § 82b Erhaltungsaufwand-Verteilung ----

export type Paragraf82bErgebnis = {
  jahre: number;
  proJahr: number;
  sofortSteuerersparnis: number | null; // bei Sofortabzug im 1. Jahr
  verteiltErsparnisProJahr: number | null;
  hinweis: string;
};

/**
 * Größerer Erhaltungsaufwand kann gleichmäßig auf 2–5 Jahre verteilt werden
 * (§ 82b EStDV). Zeigt Betrag/Jahr und – bei angegebenem Grenzsteuersatz – die
 * jährliche Steuerersparnis der Verteilung. Reine Progressionsglättung, keine
 * Aussage über die Gesamtersparnis.
 */
export function verteile82b(betrag: number, jahre: number, grenzsteuersatz?: number | null): Paragraf82bErgebnis {
  const n = Math.max(1, Math.min(5, Math.round(jahre)));
  const proJahr = r2(betrag / n);
  const satz = grenzsteuersatz != null && grenzsteuersatz > 0 ? grenzsteuersatz / 100 : null;
  return {
    jahre: n,
    proJahr,
    sofortSteuerersparnis: satz != null ? r2(betrag * satz) : null,
    verteiltErsparnisProJahr: satz != null ? r2(proJahr * satz) : null,
    hinweis:
      n === 1
        ? "Sofortabzug im Jahr der Zahlung."
        : `Verteilung auf ${n} Jahre glättet die Progression — sinnvoll, wenn der Sofortabzug einen Verlust erzeugt, der steuerlich verpufft. Bei Verkauf/Ende der Vermietung ist der Rest sofort abziehbar.`,
  };
}

// --------------------------------------------- 5) Kaufpreisaufteilung ----

export type KaufpreisAufteilung = {
  bodenwert: number;
  gebaeudewert: number;
  gebaeudeanteilProzent: number;
  grundanteilProzent: number;
  hinweis: string;
};

/**
 * Teilt den Gesamtkaufpreis in Gebäude- und Grundanteil. Der Bodenwert wird aus
 * Grundstücksfläche × Bodenrichtwert ermittelt; der Rest entfällt auf das
 * (abschreibbare) Gebäude. Nur der Gebäudeanteil ist AfA-Basis (§ 7 EStG).
 */
export function kaufpreisAufteilung(
  gesamtkaufpreis: number,
  grundstuecksflaeche: number | null,
  bodenrichtwert: number | null,
): KaufpreisAufteilung | null {
  if (!(gesamtkaufpreis > 0)) return null;
  const bodenwertRoh = (grundstuecksflaeche ?? 0) > 0 && (bodenrichtwert ?? 0) > 0
    ? (grundstuecksflaeche as number) * (bodenrichtwert as number)
    : 0;
  const bodenwert = r2(Math.min(bodenwertRoh, gesamtkaufpreis));
  const gebaeudewert = r2(gesamtkaufpreis - bodenwert);
  const gebaeudeanteilProzent = r2((gebaeudewert / gesamtkaufpreis) * 100);
  return {
    bodenwert,
    gebaeudewert,
    gebaeudeanteilProzent,
    grundanteilProzent: r2(100 - gebaeudeanteilProzent),
    hinweis:
      bodenwertRoh > 0
        ? "Bodenwert aus Fläche × Bodenrichtwert. Halte die Aufteilung möglichst schon im notariellen Kaufvertrag fest — eine plausible Vertragsaufteilung akzeptiert das Finanzamt i. d. R."
        : "Ohne Grundstücksfläche und Bodenrichtwert wird der volle Kaufpreis als Gebäude angesetzt — bitte Bodenwert ergänzen (BMF-Arbeitshilfe zur Kaufpreisaufteilung).",
  };
}
