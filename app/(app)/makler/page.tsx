// Makler-Ordner (buyer-level): Käufer-Checkliste + Upload/Abhaken/Fortschritt.
// Nicht objektabhängig — pro Nutzer. Gegenstück zum Bank-/Beleihungsordner.
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import MaklerOrdner from "@/components/MaklerOrdner";
import WegKopf from "@/components/aufbau/WegKopf";
import type { MaklerDok } from "@/lib/makler";
import type { MaklerFreigabe } from "@/lib/actions/makler";
import { ABRUF_SPALTEN, type Abruf } from "@/lib/freigabeAbrufe";
import FreigabeEingang from "@/components/FreigabeEingang";
import { EINGANG_SPALTEN, type EingangZeile } from "@/lib/freigabeEingang";

export const dynamic = "force-dynamic";

export default async function MaklerPage() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();

  // Existenz der Selbstauskunft prüfen (für den „Aus MyImmo erzeugen"-Button) —
  // ohne den verschlüsselten Blob zu entschlüsseln.
  const [{ data: docs }, { data: sa }, { data: freigaben }, { data: abrufe }, { data: eingang }] = await Promise.all([
    supabase.from("makler_dokumente").select("item_key,status,notiz,datum,datei_name,datei_type,datei_size"),
    user
      ? supabase.from("selbstauskunft").select("user_id").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Makler-Links + Abruf-Protokoll (05.10.2026). RLS: nur eigene; der Filter steht trotzdem da.
    user
      ? supabase.from("makler_freigaben").select("token,item_keys,ablauf,aktiv,created_at,empfaenger_email")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from("freigabe_abrufe").select(ABRUF_SPALTEN)
          .eq("user_id", user.id).eq("art", "makler").order("abgerufen_am", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
    // Eingang (06.10.2026): Dateien, die der Makler über seinen Link geschickt hat.
    user
      ? supabase.from("freigabe_eingang").select(EINGANG_SPALTEN)
          .eq("user_id", user.id).eq("art", "makler").order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
  ]);
  const eingangZeilen = (eingang ?? []) as EingangZeile[];
  const eingangNeu = eingangZeilen.some((z) => z.status === "neu");
  const eingangBlock = (freigaben ?? []).length
    ? <FreigabeEingang zeilen={eingangZeilen} wer="dem Makler" werNom="der Makler" />
    : null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 0 40px" }}>
      {/* Kaufweg Schritt 4 (Umbau 06.10.2026): Angebot & Unterlagen. */}
      <WegKopf schritt="unterlagen" />
      {eingangNeu && eingangBlock}
      <MaklerOrdner
        initialDocs={(docs ?? []) as MaklerDok[]}
        hatSelbstauskunft={!!sa}
        freigaben={(freigaben ?? []) as MaklerFreigabe[]}
        abrufe={(abrufe ?? []) as Abruf[]}
        jetzt={new Date().toISOString()}
      />
      {!eingangNeu && eingangBlock}
    </div>
  );
}
