import { timingSafeEqual } from "node:crypto";

// Gemeinsamer Vergleich für Bearer-Geheimnisse (CRON_SECRET & Co.).
// Lag vorher als Kopie in `app/api/cron/wert-refresh/route.ts`. Eine
// Sicherheits-Primitive in zwei Dateien ist der Weg, auf dem die eine
// gehärtet wird und die andere nicht — deshalb eine Stelle.

/** Vergleich in konstanter Zeit — die Länge verrät sonst schon etwas. */
export function geheimnisGleich(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Prüft den `Authorization: Bearer <secret>`-Kopf gegen das Geheimnis.
 *
 * **Bewusst NUR der Header.** Ein `?secret=`-Parameter in der URL landet in
 * den Vercel-Zugriffslogs und damit dauerhaft im Klartext — genau deshalb
 * wurde er am 08.09.2026 aus der Cron-Route entfernt. Nicht wieder einbauen.
 */
export function bearerStimmt(req: Request, secret: string): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  return geheimnisGleich(bearer, secret);
}
