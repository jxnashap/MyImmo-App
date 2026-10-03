import "server-only";

// Wer das Betreiber-Cockpit sehen darf.
//
// Genau EIN Konto: das in der Vercel-Env `OWNER_USER_ID` (die existiert schon
// für den Wert-Refresh-Cron). Kein neues Geheimnis, keine neue Rolle.
//
// **Fail-closed:** Ist `OWNER_USER_ID` nicht gesetzt, darf NIEMAND hinein —
// auch nicht der erste Angemeldete. Eine Seite, die Geschäftszahlen,
// Trichter und offene Rechtslücken zeigt, ist bei fehlender Konfiguration
// zu schließen, nicht zu öffnen (Projektregel: fehlende Env = Route aus).
//
// Die Seite antwortet für alle anderen mit 404, nicht 403: Ein 403 bestätigt,
// dass es die Seite gibt.
export function istBetreiber(userId: string | null | undefined): boolean {
  const owner = process.env.OWNER_USER_ID?.trim();
  if (!owner) return false;
  if (!userId) return false;
  return userId === owner;
}
