// Willkommens-/Freischaltungs-Gate: Zielseite für eingeloggte, aber noch nicht
// freigeschaltete Konten (z. B. neu via Google). Ohne Freischaltung kein Zugriff
// auf die App — das Root-Layout leitet hierher um.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { istFreigeschaltet } from "@/lib/freischaltung";
import FreischaltForm from "@/components/FreischaltForm";

export const dynamic = "force-dynamic";

export default async function WillkommenPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (await istFreigeschaltet(supabase, user.id)) redirect("/");
  return <FreischaltForm email={user.email} />;
}
