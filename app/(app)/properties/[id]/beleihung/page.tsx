// Beleihungsordner eines Objekts: Checkliste aller Bank-Unterlagen mit
// Upload/Abhaken/Fortschritt + „Aus MyImmo erzeugen" + Deckblatt-PDF +
// Freigabe-Links für die Bank (Phase 2) inkl. Rückmeldungen.
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BeleihungsOrdner from "@/components/BeleihungsOrdner";
import type { BelDok } from "@/lib/beleihung";
import type { Freigabe } from "@/lib/actions/beleihung";
import { ABRUF_SPALTEN, type Abruf } from "@/lib/freigabeAbrufe";
import FreigabeEingang from "@/components/FreigabeEingang";
import { EINGANG_SPALTEN, type EingangZeile } from "@/lib/freigabeEingang";

export const dynamic = "force-dynamic";

export default async function BeleihungPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const [{ data: prop }, { data: mieter }, { data: kredite }, { data: docs }, { data: freigaben }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id,bezeichnung,adresse,typ,baujahr,flaeche,kaufpreis,wert,miete")
        .eq("id", params.id)
        .single(),
      supabase.from("mieter").select("id,mietende").eq("prop_id", params.id),
      supabase
        .from("kredite")
        .select("betrag,restschuld,zinssatz,tilgungssatz,monatsrate")
        .eq("prop_id", params.id),
      supabase
        .from("beleihung_dokumente")
        .select("item_key,status,notiz,datum,datei_name,datei_type,datei_size")
        .eq("prop_id", params.id),
      supabase
        .from("beleihung_freigaben")
        .select("token,item_keys,ablauf,aktiv,created_at,empfaenger_email")
        .eq("prop_id", params.id)
        .order("created_at", { ascending: false }),
    ]);
  if (!prop) notFound();

  // Rückmeldungen der Bank zu den Freigaben dieses Objekts (RLS: nur eigene).
  const tokens = (freigaben ?? []).map((f) => f.token);
  // Dazu das Abruf-Protokoll (05.10.2026): wann welches Dokument über einen Link geladen wurde.
  // Und der Eingang (06.10.2026): Dateien, die die Bank über einen dieser Links geschickt hat.
  const [{ data: rueckmeldungen }, { data: abrufe }, { data: eingang }] = tokens.length
    ? await Promise.all([
        supabase
          .from("beleihung_rueckmeldungen")
          .select("id,token,name,bank,kontakt,nachricht,fehlend,created_at")
          .in("token", tokens)
          .order("created_at", { ascending: false }),
        supabase
          .from("freigabe_abrufe")
          .select(ABRUF_SPALTEN)
          .eq("art", "bank")
          .in("token", tokens)
          .order("abgerufen_am", { ascending: false })
          .limit(300),
        supabase
          .from("freigabe_eingang")
          .select(EINGANG_SPALTEN)
          .eq("art", "bank")
          .in("token", tokens)
          .order("created_at", { ascending: false })
          .limit(100),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const eingangZeilen = (eingang ?? []) as EingangZeile[];
  const eingangNeu = eingangZeilen.some((z) => z.status === "neu");
  // Nur zeigen, wenn es je einen Link gab — vorher kann nichts eingehen.
  const eingangBlock = tokens.length ? <FreigabeEingang zeilen={eingangZeilen} wer="der Bank" werNom="die Bank" /> : null;

  const hatMieter = (mieter ?? []).some((m) => !m.mietende || new Date(m.mietende) >= new Date());
  const restschuld = (kredite ?? []).reduce((s, k) => s + (k.restschuld ?? k.betrag ?? 0), 0);
  const rate = (kredite ?? []).reduce((s, k) => s + (k.monatsrate ?? 0), 0);

  return (
    <>
    {eingangNeu && eingangBlock}
    <BeleihungsOrdner
      propId={prop.id}
      objektName={prop.bezeichnung}
      istEtw={prop.typ === "Eigentumswohnung"}
      hatMieter={hatMieter}
      initialDocs={(docs ?? []) as BelDok[]}
      initialFreigaben={(freigaben ?? []) as Freigabe[]}
      rueckmeldungen={(rueckmeldungen ?? []) as never[]}
      abrufe={(abrufe ?? []) as Abruf[]}
      defaults={{
        darlehen: restschuld > 0 ? String(Math.round(restschuld)) : prop.kaufpreis ? String(Math.round(prop.kaufpreis)) : "",
        wunschrate: rate > 0 ? String(Math.round(rate)) : "",
        eigenkapital: "",
      }}
    />
    {!eingangNeu && eingangBlock}
    </>
  );
}
