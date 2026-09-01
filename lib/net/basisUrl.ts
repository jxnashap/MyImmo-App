import "server-only";
import { headers } from "next/headers";

// Absolute Basis-URL der laufenden Instanz, aus den Proxy-Headern.
// Gebraucht fuer Links in E-Mails (Double-Opt-in, Abmeldung) — dort geht ein
// relativer Pfad nicht.
//
// Lag bis zur Next-15-Migration in `app/api/newsletter/route.ts`. Route-Dateien
// duerfen dort aber nur noch die HTTP-Methoden und die bekannte Segment-Konfig
// exportieren; ein zusaetzlicher Export ist ein Typfehler. Die Funktion war
// ohnehin von drei Routen importiert und damit an der falschen Stelle.
export async function basisUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "https://www.myimmoapp.de";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
