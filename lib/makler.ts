// Makler-Ordner: schlanke Checkliste der Dokumente, mit denen sich ein
// Kaufinteressent gegenüber Makler/Verkäufer als seriöser, finanzierungs-
// sicherer Käufer zeigt. Bewusst nur 6 Kern-Dokumente — und mit
// Datensparsamkeit: Rohdaten (Gehalt, Kontoauszüge) gehören an die Bank,
// NICHT an den Makler. Nicht objektabhängig (buyer-level), alle Items sichtbar.

export type MaklerItem = {
  key: string;
  label: string;
  hinweis: string;
  // datensparsam: dem Makler nur zeigen / über die Bank belegen, nicht als Rohdaten geben.
  datensparsam?: boolean;
};

export const MAKLER_CHECKLISTE: MaklerItem[] = [
  {
    key: "finanzierungsbestaetigung",
    label: "Finanzierungsbestätigung der Bank",
    hinweis: "Der Trumpf: allgemein (objektunabhängig) oder objektbezogen. Belegt, dass die Bank bis Höhe X finanziert — am besten früh eine allgemeine Bestätigung holen.",
  },
  {
    key: "eigenkapitalnachweis",
    label: "Eigenkapitalnachweis",
    hinweis: "Dem Makler NICHT die rohen Konto-/Depotauszüge geben — die Eigenkapitalstärke über die Finanzierungsbestätigung der Bank belegen.",
    datensparsam: true,
  },
  {
    key: "kaeufer_selbstauskunft",
    label: "Käufer-Selbstauskunft",
    hinweis: "Formular (oft vom Makler): Name, Beruf, Haushaltseinkommen, geplantes Eigenkapital, Nutzung. NICHT die SCHUFA-Selbstauskunft. Vollständig + ehrlich ausfüllen.",
  },
  {
    key: "schufa_bonitaet",
    label: "SCHUFA-BonitätsCheck",
    hinweis: "Zur Vorlage bei Dritten (~30 €, mit Verifizierungscode) ODER kostenlose SCHUFA-Datenkopie (Art. 15 DSGVO, 1×/Jahr gratis) — inhaltlich gleichwertig.",
  },
  {
    key: "einkommensnachweise",
    label: "Einkommensnachweise",
    hinweis: "Letzte 3 Gehaltsabrechnungen (Selbstständige: Steuerbescheide/BWA). Gehören in den BANK-Ordner — dem Makler i. d. R. NICHT vorlegen (über die Finanzierungsbestätigung abgedeckt).",
    datensparsam: true,
  },
  {
    key: "ausweis",
    label: "Personalausweis",
    hinweis: "Dem Makler nur ZEIGEN, nicht ungefragt als Kopie herausgeben. Kopie ggf. mit „Nur zur Vorlage bei …“ beschriften und Ausweisnummer teilschwärzen. Der Notar braucht später das Original.",
    datensparsam: true,
  },
];

// Persistierter Zustand eines Items (ohne datei_data — die Datei kommt über die
// geschützte Datei-Route).
export type MaklerDok = {
  item_key: string;
  status: "offen" | "hochgeladen" | "erledigt";
  notiz: string | null;
  datum: string | null;
  datei_name: string | null;
  datei_type: string | null;
  datei_size: number | null;
};

export function istMaklerKey(key: string): boolean {
  return MAKLER_CHECKLISTE.some((i) => i.key === key);
}
