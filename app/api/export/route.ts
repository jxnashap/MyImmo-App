import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptIbanRow } from "@/lib/ibanData";

export const dynamic = "force-dynamic";

// DSGVO Art. 20 "Recht auf Datenübertragbarkeit": exportiert alle Daten des
// eingeloggten Nutzers (inkl. der von ihm erfassten Mieterdaten) als JSON.
// RLS sorgt dafür, dass nur die eigenen Zeilen geliefert werden.
const TABLES = [
  "vermieter_profil",
  "ibans",
  "properties",
  "mieter",
  "mieter_positionen",
  "einnahmen",
  "kosten",
  "wiederkehrende_buchungen",
  "kredite",
  "verbrauch",
  "termine",
  "notizen",
  "dokument_vorlagen",
] as const;

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const daten: Record<string, unknown> = {};
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      daten[table] = { fehler: error.message };
      continue;
    }
    // Bankdaten liegen verschlüsselt in der DB → für den Export (DSGVO-Recht
    // auf Datenübertragbarkeit muss nutzbar sein) entschlüsseln.
    daten[table] =
      table === "ibans"
        ? (data ?? []).map((r) =>
            decryptIbanRow(r as { iban?: string | null; inhaber?: string | null; iban_bidx?: string | null }),
          )
        : data ?? [];
  }

  const payload = {
    export_erstellt_am: new Date().toISOString(),
    konto: { id: user.id, email: user.email },
    hinweis:
      "Dieser Export enthält alle in MyImmo zu Ihrem Konto gespeicherten Daten. " +
      "Dokumente/Belege sind als Base64 in den jeweiligen Datensätzen enthalten.",
    daten,
  };

  const datum = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="myimmo-export-${datum}.json"`,
    },
  });
}
