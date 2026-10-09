// Neue Buchung (Einnahme ODER Ausgabe) — gemeinsames Formular mit Umschalter.
import { heuteBerlin } from "@/lib/zeitraum";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BuchungForm from "@/components/BuchungForm";
import { EINNAHME_KATEGORIEN, KOSTEN_KATEGORIEN } from "@/lib/kategorien";
import type { Property, Tenant } from "@/lib/types";

export default async function NeueBuchungPage(
  props0: {
    searchParams: Promise<{ typ?: string; prop?: string; kategorie?: string; betrag?: string; mieter?: string; text?: string }>;
  }
) {
  const searchParams = await props0.searchParams;
  const supabase = await createClient();
  const [{ data: props }, { data: miet }] = await Promise.all([
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname,prop_id").order("nachname"),
  ]);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/cashflow" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>← Zurück</Link>
          <div><div className="topbar-title">Neue Buchung</div></div>
        </div>
      </div>

      <BuchungForm
        properties={(props ?? []) as Pick<Property, "id" | "bezeichnung">[]}
        tenants={(miet ?? []) as (Pick<Tenant, "id" | "vorname" | "nachname"> & { prop_id: string | null })[]}
        back="/cashflow"
        typInitial={searchParams.typ === "ausgabe" ? "ausgabe" : "einnahme"}
        propInitial={searchParams.prop ?? ""}
        datumInitial={heuteBerlin()}
        // Vorbelegung aus Links (z. B. „Nachzahlung buchen“ auf der NK-Seite). Nur bekannte
        // Kategorien, ein Betrag als Zahl und ein eigener Mieter — sonst leer wie bisher.
        kategorieInitial={([...EINNAHME_KATEGORIEN, ...KOSTEN_KATEGORIEN] as readonly string[]).includes(searchParams.kategorie ?? "") ? searchParams.kategorie : undefined}
        betragInitial={/^\d{1,7}(\.\d{1,2})?$/.test(searchParams.betrag ?? "") ? searchParams.betrag : undefined}
        mieterInitial={(miet ?? []).some((m) => m.id === searchParams.mieter) ? searchParams.mieter : undefined}
        beschreibungInitial={(searchParams.text ?? "").slice(0, 120) || undefined}
      />
    </div>
  );
}
