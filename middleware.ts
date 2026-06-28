import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// CSP zunächst als Report-Only ausrollen (blockt nichts, meldet nur Verstöße).
// Nach Prüfung im Browser-Log auf "false" setzen → scharf schalten.
const CSP_REPORT_ONLY = true;

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // Skripte nur vom eigenen Origin + per Nonce (kein 'unsafe-inline').
    `script-src 'self' 'nonce-${nonce}'`,
    // Inline-Styles (style={{}}) + Google-Fonts-Stylesheet.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Charts (SVG), hochgeladene Belege (base64/blob), PDF-Vorschau.
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
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
  await supabase.auth.getUser();

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
