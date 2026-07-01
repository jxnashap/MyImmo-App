import Cockpit from "@/components/kalkulator/Cockpit";
import { createClient } from "@/lib/supabase/server";
import type { Kalkulation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("kalkulationen")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="fade-up">
      <Cockpit gespeichert={(rows ?? []) as Kalkulation[]} />
    </div>
  );
}
