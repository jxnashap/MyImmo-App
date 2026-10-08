import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { istDemoKonto, demoDarfRoute, demoHeim } from "@/lib/demo";
import { istOeffentlicheSeite } from "@/lib/oeffentlich";
import { FAKTOR_COOKIE, FAKTOR_SEKUNDEN, faktorNachweisGueltig, hatBestaetigtenFaktor, mfaAusgenommen, stelleFaktorNachweisAus } from "@/lib/auth/faktorNachweis";

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
    // Karten-Tiles (Portfolio-Karte, dunkler CARTO-Stil) sind reine Bilder.
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com",
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

// Next 16 (30.09.2026): `middleware.ts` heißt jetzt `proxy.ts`, die Funktion
// `proxy`. Laufzeit ist Node statt Edge — für diese Datei ohne Folgen:
// `btoa`/`crypto.randomUUID` gibt es dort auch, und Funktionen wie Datenbank
// liegen in Frankfurt (vorher lief die Edge-Middleware beim Besucher und
// fragte Supabase von dort aus).
export async function proxy(request: NextRequest) {
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
  // `getClaims` statt `getUser` (30.09.2026): prüft die Signatur des Tokens
  // LOKAL gegen den öffentlichen Schlüssel des Projekts (ES256, Schlüsselsatz
  // modulweit 10 min zwischengespeichert) — statt bei JEDER Anfrage den
  // Auth-Server zu fragen. Anlass: Ein einziger Seitenaufruf erzeugte in den
  // Supabase-Logs rund 40 `GET /user` in zwei Sekunden (Vorab-Laden der Links).
  //
  // Bewusst in Kauf genommen: Eine anderswo beendete Sitzung erkennt der Proxy
  // erst, wenn das Token abläuft (≤ 1 h). Die Datenbank nimmt dasselbe Token
  // bis dahin ohnehin an (RLS prüft nur die Signatur); die Seiten fragen über
  // `aktuellerNutzer()` weiterhin beim Auth-Server nach.
  //
  // Fail-closed: Ungültige Signatur, abgelaufenes Token oder nicht erreichbarer
  // Schlüsselsatz → `claims` fehlt → Besucher gilt als nicht angemeldet.
  // `getClaims` frischt über `getSession` ein abgelaufenes Token auf und
  // schreibt die Cookies über `setAll` — wie vorher `getUser`.
  const { data: claimsDaten } = await supabase.auth.getClaims();
  const claims = claimsDaten?.claims;
  const user = claims?.sub ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined } : null;

  // Nicht eingeloggte Nutzer auf /login leiten — außer auf öffentlichen
  // Seiten (Login/Auth-Callback, Bank-Freigabe, Impressum/Datenschutz).
  // API-/Datei-Routen prüfen Auth selbst (eigene Redirects/Fehlercodes).
  const { pathname } = request.nextUrl;

  // RÜCKFALL für den „Passwort vergessen"-Link (09.09.2026).
  //
  // `resetPasswordForEmail` bekommt zwar `/auth/passwort` als Ziel mit — aber
  // Supabase nimmt dieses Ziel NUR, wenn es wörtlich in der Redirect-URL-
  // Weißliste des Projekts steht (Authentication → URL Configuration). Fehlt
  // es dort, wird es stillschweigend verworfen und die **Site URL** genommen.
  // Steht die noch auf `http://localhost:3000`, führt der Link ins Nichts —
  // genau so gemeldet.
  //
  // Deshalb hier: Wo auch immer die Reset-Merkmale landen, sie werden zur
  // Einlöse-Route weitergereicht. Damit hängt der Rückweg ins Konto nicht mehr
  // an einer Einstellung, die im Code nicht sichtbar ist.
  //
  // `/auth/` ist ausgenommen: Dort liegen die Einlöse-Route selbst und der
  // Google-Callback, der `code` ebenfalls benutzt — sonst entstünde eine
  // Endlosschleife bzw. der OAuth-Login würde gekapert.
  if (!pathname.startsWith("/auth")) {
    const p = request.nextUrl.searchParams;
    const istReset =
      (p.get("type") === "recovery" && p.get("token_hash")) ||
      (p.has("code") && (pathname === "/" || pathname === "/login"));
    if (istReset) {
      const ziel = new URL("/auth/passwort", request.url);
      ziel.search = request.nextUrl.search;
      return NextResponse.redirect(ziel);
    }
  }
  // Liste in lib/oeffentlich.ts — dieselbe, die der Demo-Klick-Abfang nutzt.
  // `/api/` zählt hier mit, weil die Routen ihre Anmeldung selbst prüfen.
  const istOeffentlich = istOeffentlicheSeite(pathname) || pathname.startsWith("/api/");
  if (!user && !istOeffentlich && request.method === "GET") {
    // Ziel mitgeben, damit der Nutzer nach dem Login DORT landet, wo er hin
    // wollte. Die Login-Seite wertet `?next=` laengst aus — nur geschickt hat
    // es ihr nie jemand: Wer einen Deep-Link aus einer E-Mail oeffnete und
    // nicht eingeloggt war, stand danach auf dem Dashboard und musste den
    // Mieter/Beleg/Termin von Hand wiederfinden.
    const ziel = new URL("/login", request.url);
    const gewollt = `${pathname}${request.nextUrl.search}`;
    if (pathname !== "/") ziel.searchParams.set("next", gewollt);
    // Lag ein Sitzungs-Cookie vor, das nicht mehr gilt (abgelaufen, Auffrischen
    // gescheitert, anderswo beendet), sagt die Login-Seite das — statt den
    // Nutzer kommentarlos vor das Formular zu stellen (Audit B30). Nur ein
    // Hinweistext; die Anmeldung selbst haengt nicht daran.
    if (request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))) {
      ziel.searchParams.set("grund", "abgelaufen");
    }
    const redirectResponse = NextResponse.redirect(ziel);
    redirectResponse.headers.set(
      CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
      csp
    );
    redirectResponse.headers.set("X-Content-Type-Options", "nosniff");
    return redirectResponse;
  }

  // ---- Zwei-Faktor-Schranke für ALLE Wege (Audit 01.10.2026, A3) ----
  //
  // Bis dahin saß das 2FA-Gate nur im Seiten-Layout: Server-Actions (POST),
  // API-Routen und Vorab-Ladungen liefen mit einer aal1-Sitzung (Passwort
  // allein) daran vorbei. Hier passiert jede Anfrage — außer den Pfaden, auf
  // denen der zweite Schritt nachgeholt wird (`mfaAusgenommen`).
  //
  // `aal` kommt aus dem SIGNIERTEN Token. Ob das Konto einen Faktor hat, weiß
  // nur der Auth-Server; das Ergebnis „keiner" wird zehn Minuten signiert im
  // Cookie gemerkt (lib/auth/faktorNachweis.ts), „einer" nie.
  // Fail-closed: Antwortet der Auth-Server nicht, gilt die Sitzung als beendet.
  let faktorNachweisSetzen: string | null = null;
  if (user && !mfaAusgenommen(pathname) && claims?.aal !== "aal2") {
    const nachweis = request.cookies.get(FAKTOR_COOKIE)?.value;
    if (!faktorNachweisGueltig(nachweis, user.id)) {
      const {
        data: { user: geprueft },
        error: nutzerFehler,
      } = await supabase.auth.getUser();
      const sperren = nutzerFehler || !geprueft || geprueft.id !== user.id || hatBestaetigtenFaktor(geprueft.factors);
      if (sperren) {
        const grund = nutzerFehler || !geprueft ? "abgelaufen" : "mfa";
        if (request.method !== "GET" || pathname.startsWith("/api/")) {
          const text =
            grund === "mfa"
              ? "Zweiter Faktor erforderlich — bitte melde dich neu an und bestätige den Code."
              : "Sitzung abgelaufen — bitte neu anmelden.";
          const abgelehnt = NextResponse.json({ error: text, fehler: text, mfa: grund === "mfa" }, { status: 403 });
          abgelehnt.headers.set(
            CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
            csp,
          );
          abgelehnt.headers.set("X-Content-Type-Options", "nosniff");
          return abgelehnt;
        }
        const ziel = new URL("/login", request.url);
        if (grund === "mfa") ziel.searchParams.set("mfa", "1");
        else ziel.searchParams.set("grund", "abgelaufen");
        if (pathname !== "/") ziel.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
        const weiter = NextResponse.redirect(ziel);
        weiter.headers.set(
          CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
          csp,
        );
        weiter.headers.set("X-Content-Type-Options", "nosniff");
        // Ein alter Nachweis darf eine jetzt gesperrte Sitzung nicht wiederbeleben.
        weiter.cookies.set({ name: FAKTOR_COOKIE, value: "", maxAge: 0, path: "/" });
        return weiter;
      }
      try {
        faktorNachweisSetzen = stelleFaktorNachweisAus(user.id);
      } catch {
        faktorNachweisSetzen = null; // ohne DATA_ENCRYPTION_KEY: jedes Mal nachfragen
      }
    }
  }

  // Demo-Konto: nur der freigegebene Ausschnitt. Die Seitenleiste graut den
  // Rest zwar aus, aber wer die Adresse kennt, tippt sie ein — deshalb hier
  // serverseitig abweisen.
  //
  // `istOeffentlich` zaehlt ALLE `/api/`-Routen mit, weil sie ihre Auth selbst
  // pruefen. Fuer die Demo-Sperre darf das nicht gelten: sonst laeuft die
  // Pruefung an genau den Routen vorbei, die Geld kosten (`/api/nk-ocr`,
  // `/api/import-url` rufen Anthropic auf). Die Auswahl der erlaubten
  // API-Routen trifft `demoDarfRoute`.
  const oeffentlichFuerDemo = istOeffentlicheSeite(pathname);
  if (user && istDemoKonto(user.email) && !oeffentlichFuerDemo && !demoDarfRoute(pathname)) {
    // Frueher galt die Sperre nur fuer GET — die teuren Routen sind aber POST.
    // Jetzt gilt sie fuer jede Methode.
    //
    // Bei einem Schreibzugriff ist eine Weiterleitung die falsche Antwort — ein
    // fetch() bekaeme eine HTML-Seite mit Status 200 zurueck und haelt das fuer
    // Erfolg. Deshalb hier ein klares 403 mit Begruendung.
    if (request.method !== "GET") {
      // `error` UND `fehler`: Die Formulare mit KI-Auslese (ImportWizard,
      // KalkImport, NkOcrUpload, UmlageAssistent) lesen alle `json.error`.
      // Stand hier nur `fehler`, zeigten sie „Fehler beim Analysieren." — der
      // Besucher hielt die KI für kaputt statt für abgeschaltet (Review 30.09.).
      const kostetGeld = pathname === "/api/nk-ocr" || pathname === "/api/import-url";
      const text = kostetGeld
        ? "In der Demo abgeschaltet, weil jede KI-Auswertung Kosten verursacht. Nach der Anmeldung steht sie bereit."
        : "In der Demo nicht verfügbar. Nach der Anmeldung steht die Funktion bereit.";
      const abgelehnt = NextResponse.json({ error: text, fehler: text }, { status: 403 });
      abgelehnt.headers.set(
        CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
        csp,
      );
      abgelehnt.headers.set("X-Content-Type-Options", "nosniff");
      return abgelehnt;
    }
    // `bereich` nennt dem Dashboard, WAS gesperrt war — es zeigt daraufhin den
    // Sperr-Dialog. Vorher las niemand `demo=gesperrt`, und der Besucher stand
    // ohne Erklärung wieder auf dem Dashboard. Der Wert wird nur als Schlüssel
    // für einen festen Text benutzt (`demoBereich`), nie als Ziel.
    // Startseite DIESES Demo-Kontos (B55): Mieter und Service kamen vorher über `/` und die
    // Weiterleitung des Layouts auf ihr Portal — `bereich` ging dabei verloren.
    const ziel = new URL(demoHeim(user.email), request.url);
    ziel.searchParams.set("demo", "gesperrt");
    ziel.searchParams.set("bereich", pathname);
    const gesperrt = NextResponse.redirect(ziel);
    gesperrt.headers.set(
      CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
      csp
    );
    gesperrt.headers.set("X-Content-Type-Options", "nosniff");
    return gesperrt;
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
  if (faktorNachweisSetzen) {
    response.cookies.set({
      name: FAKTOR_COOKIE,
      value: faktorNachweisSetzen,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: FAKTOR_SEKUNDEN,
    });
  }

  return response;
}

export const config = {
  // Die rein oeffentliche Strecke (app/(pub)/…) ist bewusst ausgenommen: dort
  // laeuft weder die Session-Auffrischung noch die Nonce-CSP. Nur so bleiben
  // diese Seiten statisch und am Edge cachebar. Ihre Security-Header setzt
  // stattdessen next.config.mjs — beide Listen muessen zusammen gepflegt
  // werden (Kommentar dort).
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|theme\\.js|(?:funktionen|ratgeber|vision|preise|vorlagen|agb|avv|datenschutz|impressum)(?:/|$)).*)",
  ],
};
