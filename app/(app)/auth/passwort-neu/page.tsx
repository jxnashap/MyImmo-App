import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { NACHWEIS_COOKIE, nachweisGueltig } from "@/lib/auth/resetNachweis";
import PasswortNeu from "@/components/PasswortNeu";
import BrandMark from "@/components/BrandMark";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Neues Passwort — MyImmo",
  robots: { index: false, follow: false },
};

// Formular für ein neues Passwort nach „Passwort vergessen".
//
// ZWEI BEDINGUNGEN, BEIDE NÖTIG:
//   1. Eine gültige Sitzung (die Route /auth/passwort hat den Token eingelöst).
//   2. Der kurzlebige Nachweis aus derselben Route.
// Ohne (2) wäre diese Seite die Hintertür an `wechslePasswort` vorbei: Wer eine
// fremde offene Sitzung vorfindet, könnte hier ohne Kenntnis des alten
// Passworts eines setzen und den Inhaber aussperren.
//
// Die Seite liegt unter /auth/, weil dieser Pfad in der Middleware öffentlich
// ist UND vom Zwei-Faktor-Gate im Layout ausgenommen — ein Konto mit 2FA soll
// sein Passwort auch dann zurücksetzen können, wenn der zweite Faktor in dieser
// Sitzung noch nicht bestätigt ist. Sonst wäre der Rückweg erneut versperrt.
export default async function PasswortNeuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const nachweis = (await cookies()).get(NACHWEIS_COOKIE)?.value;
  const darf = nachweisGueltig(nachweis, user?.id);

  return (
    <div className="auth-wrap" style={{ maxWidth: 420, margin: "0 auto", padding: "56px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <BrandMark />
      </div>

      {darf ? (
        <PasswortNeu />
      ) : (
        <div className="section">
          <div className="section-body">
            <h3 style={{ marginBottom: 8 }}>Link nicht mehr gültig</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
              Der Link zum Zurücksetzen ist abgelaufen oder wurde schon benutzt. Aus
              Sicherheitsgründen gilt er nur kurze Zeit und nur einmal. Fordere auf der
              Anmeldeseite einen neuen an — das geht beliebig oft.
            </p>
            <Link href="/login" className="btn btn-primary">
              Zur Anmeldung
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
