// Fristen-Logik aus der ursprünglichen App — typisiert für das Supabase-Schema.

export type Frist = { label: string; datum: string | null; typ: "info" | "warn" | "ok" };

type MieterFristInput = {
  mietbeginn: string | null;
  mietende: string | null;
  kuendigung: number | null;
  letzte_erhoehung: string | null;
};

const iso = (d: Date) => d.toISOString().split("T")[0];

// Abgeleitete Fristen eines Mieters (Mietbeginn, -ende, Kündigungsfrist, nächste Erhöhung).
export function mieterFristen(m: MieterFristInput): Frist[] {
  const fristen: Frist[] = [];
  const heute = new Date();

  if (m.mietbeginn) fristen.push({ label: "Mietbeginn", datum: m.mietbeginn, typ: "info" });

  if (m.mietende) {
    const ende = new Date(m.mietende);
    const tage = Math.ceil((ende.getTime() - heute.getTime()) / 86400000);
    fristen.push({ label: "Mietende", datum: m.mietende, typ: tage < 90 ? "warn" : "info" });
    if (m.kuendigung) {
      const kFrist = new Date(ende);
      kFrist.setMonth(kFrist.getMonth() - m.kuendigung);
      const kTage = Math.ceil((kFrist.getTime() - heute.getTime()) / 86400000);
      if (kTage > 0) fristen.push({ label: `Kündigungsfrist (${m.kuendigung} Mo. vorher)`, datum: iso(kFrist), typ: kTage < 60 ? "warn" : "info" });
    }
  }

  // Nächste mögliche Mieterhöhung: 12 Monate nach letzter (Kappungsgrenze §558)
  if (m.letzte_erhoehung) {
    const next = new Date(m.letzte_erhoehung);
    next.setMonth(next.getMonth() + 12);
    const nTage = Math.ceil((next.getTime() - heute.getTime()) / 86400000);
    fristen.push({ label: "Nächste Mieterhöhung möglich", datum: iso(next), typ: nTage <= 0 ? "ok" : "info" });
  } else if (m.mietbeginn) {
    const next = new Date(m.mietbeginn);
    next.setMonth(next.getMonth() + 12);
    if (next < heute) fristen.push({ label: "Mieterhöhung möglich (keine bisher)", datum: null, typ: "ok" });
  }

  return fristen;
}

export type RefinanzWarnung = {
  level: "abgelaufen" | "kritisch" | "warnung";
  months: number;
  label: string;
  color: string;
  bg: string;
};

// Warnung, wenn die Zinsbindung eines Darlehens bald (<=24 Mon.) ausläuft.
export function getRefinanzWarning(zinsbindung: string | null): RefinanzWarnung | null {
  if (!zinsbindung) return null;
  const zb = new Date(zinsbindung);
  const now = new Date();
  const diffMonths = Math.round((zb.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (diffMonths < 0) return { level: "abgelaufen", months: diffMonths, label: "Abgelaufen!", color: "var(--red)", bg: "var(--red-dim)" };
  if (diffMonths <= 12) return { level: "kritisch", months: diffMonths, label: `In ${diffMonths} Monat${diffMonths === 1 ? "" : "en"}`, color: "var(--red)", bg: "var(--red-dim)" };
  if (diffMonths <= 24) return { level: "warnung", months: diffMonths, label: `In ${diffMonths} Monaten`, color: "var(--amber)", bg: "rgba(240,160,48,0.1)" };
  return null;
}
