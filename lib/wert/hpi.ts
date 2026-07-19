// Häuserpreisindex Deutschland (Destatis-Statistik 61262, gespiegelt bei
// Eurostat als Dataset prc_hpi_q; Index 2015=100, quartalsweise).
//
// holeIndexReihe() holt die Reihe live von der offenen Eurostat-API (kein
// Token; Next-Fetch-Cache 24 h → praktisch ein Abruf pro Tag und Deployment,
// egal wie viele Nutzer). Schlägt der Abruf fehl, greift der eingebettete
// Snapshot (echte Eurostat-Werte, Abruf 19.07.2026 verifiziert).
// Lizenz: Eurostat CC BY 4.0 — Quellenangabe in der UI ist Pflicht.

import type { IndexReihe } from "@/lib/wert/fortschreibung";

export const HPI_QUELLE = {
  name: "Eurostat prc_hpi_q (Datenbasis: Destatis 61262, Häuserpreisindex)",
  basis: "2015 = 100",
  lizenz: "CC BY 4.0 — © Eurostat",
  snapshotStand: "2026-Q1",
};

const EUROSTAT_URL =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_q?format=JSON&geo=DE&purchase=TOTAL&unit=I15_Q";

// Eingebetteter Snapshot — exakte Eurostat-Werte (Abruf 19.07.2026).
// 2026-Q1 ist vorläufig; die Live-Abfrage überschreibt den Snapshot ohnehin.
export const HPI_SNAPSHOT: IndexReihe = {
  "2005-Q1": 84.2, "2005-Q2": 82.7, "2005-Q3": 84.4, "2005-Q4": 82.0,
  "2006-Q1": 83.2, "2006-Q2": 83.5, "2006-Q3": 82.3, "2006-Q4": 83.0,
  "2007-Q1": 80.0, "2007-Q2": 81.7, "2007-Q3": 81.6, "2007-Q4": 81.6,
  "2008-Q1": 82.8, "2008-Q2": 83.1, "2008-Q3": 81.6, "2008-Q4": 81.8,
  "2009-Q1": 81.8, "2009-Q2": 83.1, "2009-Q3": 83.0, "2009-Q4": 84.2,
  "2010-Q1": 83.0, "2010-Q2": 84.3, "2010-Q3": 84.4, "2010-Q4": 83.7,
  "2011-Q1": 86.1, "2011-Q2": 87.1, "2011-Q3": 86.7, "2011-Q4": 87.3,
  "2012-Q1": 88.0, "2012-Q2": 89.1, "2012-Q3": 90.4, "2012-Q4": 91.6,
  "2013-Q1": 91.3, "2013-Q2": 93.1, "2013-Q3": 92.9, "2013-Q4": 93.0,
  "2014-Q1": 93.8, "2014-Q2": 95.7, "2014-Q3": 96.2, "2014-Q4": 96.2,
  "2015-Q1": 97.8, "2015-Q2": 99.9, "2015-Q3": 100.4, "2015-Q4": 101.8,
  "2016-Q1": 103.9, "2016-Q2": 106.9, "2016-Q3": 108.8, "2016-Q4": 110.4,
  "2017-Q1": 110.9, "2017-Q2": 113.1, "2017-Q3": 115.0, "2017-Q4": 117.3,
  "2018-Q1": 118.3, "2018-Q2": 120.6, "2018-Q3": 123.1, "2018-Q4": 124.6,
  "2019-Q1": 124.6, "2019-Q2": 127.8, "2019-Q3": 129.6, "2019-Q4": 132.7,
  "2020-Q1": 133.8, "2020-Q2": 136.2, "2020-Q3": 140.3, "2020-Q4": 144.3,
  "2021-Q1": 146.3, "2021-Q2": 151.8, "2021-Q3": 158.2, "2021-Q4": 162.5,
  "2022-Q1": 164.1, "2022-Q2": 167.4, "2022-Q3": 166.3, "2022-Q4": 158.5,
  "2023-Q1": 153.7, "2023-Q2": 151.6, "2023-Q3": 149.3, "2023-Q4": 146.4,
  "2024-Q1": 145.8, "2024-Q2": 147.8, "2024-Q3": 149.0, "2024-Q4": 149.2,
  "2025-Q1": 151.3, "2025-Q2": 152.6, "2025-Q3": 153.7, "2025-Q4": 153.0,
  "2026-Q1": 153.4,
};

// JSON-stat 2.0: dimension.time.category.index ("2020-Q1" → Position) und
// value (Position → Indexwert).
type JsonStat = {
  dimension?: { time?: { category?: { index?: Record<string, number> } } };
  value?: Record<string, number>;
};

export function parseEurostat(json: JsonStat): IndexReihe | null {
  const timeIndex = json?.dimension?.time?.category?.index;
  const values = json?.value;
  if (!timeIndex || !values) return null;
  const reihe: IndexReihe = {};
  for (const [quartal, pos] of Object.entries(timeIndex)) {
    const v = values[String(pos)];
    if (typeof v === "number" && /^\d{4}-Q[1-4]$/.test(quartal)) reihe[quartal] = v;
  }
  return Object.keys(reihe).length >= 4 ? reihe : null;
}

export async function holeIndexReihe(): Promise<{ reihe: IndexReihe; live: boolean }> {
  try {
    const res = await fetch(EUROSTAT_URL, { next: { revalidate: 86400 } });
    if (res.ok) {
      const reihe = parseEurostat((await res.json()) as JsonStat);
      if (reihe) return { reihe, live: true };
    }
  } catch { /* Fallback unten */ }
  return { reihe: HPI_SNAPSHOT, live: false };
}
