import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { nkAmObjekt } from "@/lib/nkPositionen";
import { createClient } from "@/lib/supabase/server";
import UmlageAssistent from "@/components/UmlageAssistent";
import { zeigeVerteiler } from "@/lib/umlage";

export const dynamic = "force-dynamic";

export default async function UmlagePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const id = params.id;

  const [{ data: prop }, { data: mieter }, { data: kosten }] = await Promise.all([
    supabase.from("properties").select("id,bezeichnung,flaeche,typ,einheiten_anzahl").eq("id", id).single(),
    supabase
      .from("mieter")
      .select("id,vorname,nachname,einheit,flaeche,mietbeginn,mietende")
      .eq("prop_id", id)
      .order("mietbeginn"),
    // Paket C: gebuchte Kosten des Objekts — umlagefähige bietet der Verteiler zur Übernahme an.
    supabase.from("kosten").select("prop_id,buchungsdatum,kategorie,betrag").eq("prop_id", id),
  ]);

  if (!prop) notFound();

  // Stufe 1 (07.10.2026): Beim Mehrfamilienhaus stehen die Nebenkosten jetzt am Objekt. Der alte
  // Verteiler (schrieb fertige Anteile je Mieter, ohne Gesamtkosten) bleibt nur, solange die
  // Tabellen fehlen — sonst gäbe es zwei Wege für dieselben Kosten.
  if (await nkAmObjekt(supabase, id)) redirect(`/properties/${id}/nebenkosten`);

  // Der Verteiler lohnt nur bei mehreren Mietparteien — bei einer einzelnen
  // Einheit (ETW/EFH) gibt es nichts aufzuteilen. Direktaufrufe landen daher
  // bei einem Hinweis statt bei einem sinnlosen Formular.
  const sichtbar = zeigeVerteiler({
    typ: prop.typ,
    einheiten_anzahl: prop.einheiten_anzahl ?? null,
    mieterAnzahl: (mieter ?? []).length,
  });
  if (!sichtbar) {
    return (
      <div className="fade-up">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href={`/properties/${id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>← Zurück</Link>
            <div>
              <div className="topbar-title">Nebenkosten verteilen</div>
              <div className="topbar-sub">{prop.bezeichnung}</div>
            </div>
          </div>
        </div>
        <hr className="topbar-rule" />
        <div className="section">
          <div className="section-body">
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginTop: 0 }}>
              Dieses Objekt hat nur eine Mietpartei — da gibt es nichts aufzuteilen. Der Verteiler ist für
              Mehrfamilienhäuser und andere Objekte mit mehreren Einheiten gedacht.
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              Die Nebenkostenabrechnung erstellst du hier direkt beim Mieter — dort trägst du die Kosten
              ein und legst fest, was umlagefähig ist.
            </p>
            {/* Stufe 0: direkt zum einen Mieter statt zur Liste. */}
            <Link href={(mieter ?? []).length === 1 ? `/tenants/${(mieter ?? [])[0].id}/nk` : "/tenants"} className="btn btn-gold" style={{ fontSize: 12 }}>
              {(mieter ?? []).length === 1 ? "Zur Nebenkostenabrechnung" : "Zu den Mietern"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tenants = (mieter ?? []).map((m) => ({
    id: m.id,
    name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
    einheit: m.einheit,
    flaeche: m.flaeche,
    mietbeginn: m.mietbeginn,
    mietende: m.mietende,
  }));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/properties/${id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>
            ← Zurück
          </Link>
          <div>
            <div className="topbar-title">Nebenkosten verteilen</div>
            <div className="topbar-sub">
              {prop.bezeichnung} · Gesamtkosten einmal eingeben, automatisch nach m² auf alle Mieter aufteilen
            </div>
          </div>
        </div>
      </div>

      <UmlageAssistent
        propId={id}
        propName={prop.bezeichnung}
        propFlaeche={prop.flaeche}
        mieter={tenants}
        jahrDefault={new Date().getFullYear() - 1}
        gebuchteKosten={kosten ?? []}
      />
    </div>
  );
}
