import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// CSP zunächst als Report-Only ausrollen (blockt nichts, meldet nur Verstöße).
// Nach Prüfung im Browser-Log auf "false" setzen → scharf schalten.
const CSP_REPORT_ONLY = false;

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // Skripte nur vom eigenen Origin + per Nonce (kein 'unsafe-inline').
    `script-src 'self' 'nonce-${nonce}'`,
    // Inline-Styles (style={{}}); Schriften sind selbst gehostet.
    "style-src 'self' 'unsafe-inline'",
    // Charts (SVG), hochgeladene Belege (base64/blob), PDF-Vorschau.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Supabase REST + Realtime.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  // Pro Request eine Nonce; an Next weitergeben (Request-Header), damit Next
  // seine eigenen Inline-Skripte automatisch mit der Nonce versieht.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Pfad für das Root-Layout (Rollen-Weiche Mieter ↔ Vermieter).
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Supabase-Session über Server-Requests hinweg aktuell halten.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options })
          );
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Nicht eingeloggte Nutzer auf /login leiten — außer auf öffentlichen
  // Seiten (Login/Auth-Callback, Bank-Freigabe, Impressum/Datenschutz).
  // API-/Datei-Routen prüfen Auth selbst (eigene Redirects/Fehlercodes).
  const { pathname } = request.nextUrl;
  const istOeffentlich =
    pathname === "/" || // eigene Willkommens-Ansicht für Ausgeloggte
    pathname === "/funktionen" || // Landing-Unterseiten (Marketing, öffentlich)
    pathname === "/preise" ||
    pathname === "/vision" ||
    pathname === "/ratgeber" || // SEO-Ratgeber (öffentlich)
    pathname.startsWith("/ratgeber/") ||
    pathname === "/vorlagen" || // Vorlagen-Übersicht (öffentlich)
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/login" ||
    pathname === "/anmelden" || // Rollen-Auswahl vor dem Login
    pathname.startsWith("/auth") ||
    pathname.startsWith("/beleihung/") ||
    pathname.startsWith("/bewerben/") || // öffentliche Bewerber-Selbstauskunft
    pathname.startsWith("/auftrag/") || // öffentlicher Firmen-Link (Terminabsprache)

    pathname === "/impressum" ||
    pathname === "/agb" ||
    pathname === "/avv" || // im Login-Consent verlinkt — muss ohne Login lesbar sein
    pathname === "/datenschutz" ||
    pathname.startsWith("/landing/") || // statische Landingpage-Screenshots (public/)
    pathname.startsWith("/fonts/") || // selbst gehostete Schriften (public/fonts/)
    pathname === "/icon.svg" || // Favicon (app/icon.svg)
    pathname.startsWith("/api/");
  if (!user && !istOeffentlich && request.method === "GET") {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    redirectResponse.headers.set(
      CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
      csp
    );
    redirectResponse.headers.set("X-Content-Type-Options", "nosniff");
    return redirectResponse;
  }

  // ---- Security-Header zentral für alle Routen ----
  response.headers.set(
    CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    csp
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
