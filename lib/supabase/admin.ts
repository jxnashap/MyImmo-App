import { createClient } from "@supabase/supabase-js";

// Service-Role-Client für Server-Jobs OHNE Nutzer-Session (z. B. der Wert-
// Refresh-Cron). Umgeht RLS — deshalb NUR in geschützten Server-Routen nutzen,
// nie im Client. Env `SUPABASE_SERVICE_ROLE_KEY` (Vercel, nie ins Repo/Logs).
// Gibt null zurück, wenn nicht konfiguriert → Aufrufer antwortet mit 503.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
