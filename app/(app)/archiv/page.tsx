import { createClient } from "@/lib/supabase/server";
import ArchivManager from "@/components/ArchivManager";
import type { Property, Tenant } from "@/lib/types";

export const dynamic = "force-dynamic";

export type ArchivDoc = {
  id: string;
  prop_id: string | null;
  mieter_id: string | null;
  titel: string | null;
  kategorie: string | null;
  inhalt: string | null;
  datei_name: string | null;
  datei_type: string | null;
  datei_size: number | null;
  created_at: string | null;
};

export default async function ArchivPage() {
  const supabase = createClient();
  const [{ data: docs }, { data: props }, { data: miet }] = await Promise.all([
    supabase
      .from("notizen")
      .select("id,prop_id,mieter_id,titel,kategorie,inhalt,datei_name,datei_type,datei_size,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);

  return (
    <ArchivManager
      docs={(docs ?? []) as ArchivDoc[]}
      properties={(props ?? []) as Pick<Property, "id" | "bezeichnung">[]}
      mieter={(miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[]}
    />
  );
}
