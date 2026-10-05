// „Neu seit deinem letzten Besuch“ im Service-Portal (05.10.2026). Reine Funktion: Was hat sich
// an einem Auftrag getan, seit der Partner zuletzt hineingeschaut hat? Die Seite reicht den
// Zeitpunkt aus `service_zugaenge.zuletzt_gesehen_am` herein.
//
// Nur Dinge, die der VERMIETER getan hat — die eigenen Notizen des Partners sind nie „neu“.
import { rueckfrageOffen, type AuftragNotiz } from "@/lib/auftragNotizen";

export type NeuGrund = "Rückfrage" | "Neuer Auftrag" | "Freigegeben" | "Nicht freigegeben" | "Nachricht";

/** Erstbesuch (noch nie gesehen): als neu gilt, was in den letzten 7 Tagen kam. */
export const ERSTBESUCH_TAGE = 7;

export function seitFuerVergleich(zuletzt: string | null | undefined, heuteISO: string): string {
  if (zuletzt) return zuletzt;
  const [j, m, t] = heuteISO.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t - ERSTBESUCH_TAGE)).toISOString();
}

export function neuSeit(
  a: { status: string; erstellt_von?: string | null; created_at: string; updated_at?: string | null; notizen?: AuftragNotiz[] },
  seit: string,
): NeuGrund | null {
  const nach = (zeit: string | null | undefined) => !!zeit && zeit > seit;
  const notizen = a.notizen ?? [];
  const frage = rueckfrageOffen(notizen);
  if (frage && nach(frage.created_at)) return "Rückfrage";
  if (a.erstellt_von !== "service" && nach(a.created_at)) return "Neuer Auftrag";
  if (a.status === "nicht_freigegeben" && nach(a.updated_at)) return "Nicht freigegeben";
  // Freigabe eines Antrags oder eines Fachbetrieb-Vorschlags: Status steht wieder auf offen.
  if ((a.status === "offen" || a.status === "angenommen") && nach(a.updated_at) && (a.erstellt_von === "service" || notizen.some((n) => n.art === "fachbetrieb"))) {
    return "Freigegeben";
  }
  if (notizen.some((n) => n.autor_rolle === "vermieter" && nach(n.created_at))) return "Nachricht";
  return null;
}
