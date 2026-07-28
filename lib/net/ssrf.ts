// Serverseitig — die node:dns-/node:net-Importe funktionieren nur dort.
// Bewusst OHNE `import "server-only"`, damit die reinen Prüffunktionen in
// tests/ssrf.test.ts direkt getestet werden können.
import { lookup } from "node:dns/promises";
import net from "node:net";

// Schutz gegen SSRF beim serverseitigen Laden fremder URLs (Exposé-Link-Import).
//
// Warum der alte Regex-Filter nicht reichte: Er prüfte nur den HOSTNAMEN der
// eingegebenen URL gegen eine Liste privater IPv4-Präfixe. Damit ließ sich
// alles Folgende ungehindert erreichen:
//
//   http://[::1]/                → IPv6-Loopback, vom Regex nicht erfasst
//   http://2130706433/           → 127.0.0.1 dezimal kodiert
//   http://0x7f000001/           → dieselbe Adresse hexadezimal
//   http://interner.name.test/   → öffentlicher DNS-Name, der auf 169.254.169.254
//                                  (Cloud-Metadaten) oder ein internes Netz zeigt
//   https://harmlos.example/x    → antwortet mit 302 auf http://169.254.169.254/…
//                                  (`fetch` folgte Weiterleitungen automatisch)
//
// Der einzige verlässliche Weg ist, die Adresse AUFZULÖSEN und die IP zu prüfen —
// und das für jeden einzelnen Sprung einer Weiterleitungskette zu wiederholen.

/** Ist die IP-Adresse privat, lokal oder anderweitig nicht öffentlich routbar? */
export function istPrivateIp(ip: string): boolean {
  const art = net.isIP(ip);
  if (art === 4) return istPrivateIpv4(ip);
  if (art === 6) return istPrivateIpv6(ip);
  return true; // unbekanntes Format → im Zweifel blocken
}

function istPrivateIpv4(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;
  if (a === 0) return true;                       // 0.0.0.0/8 "dieses Netz"
  if (a === 10) return true;                      // privat
  if (a === 127) return true;                     // Loopback
  if (a === 169 && b === 254) return true;        // Link-local + Cloud-Metadaten
  if (a === 172 && b >= 16 && b <= 31) return true; // privat
  if (a === 192 && b === 168) return true;        // privat
  if (a === 192 && b === 0) return true;          // IETF-Protokollzuweisungen
  if (a === 198 && (b === 18 || b === 19)) return true; // Benchmark-Netz
  if (a === 100 && b >= 64 && b <= 127) return true;    // Carrier-Grade NAT
  if (a >= 224) return true;                      // Multicast + reserviert + 255.x
  return false;
}

function istPrivateIpv6(ip: string): boolean {
  const k = ip.toLowerCase().split("%")[0]; // Zonen-Index abschneiden
  if (k === "::" || k === "::1") return true;                 // unspezifiziert / Loopback
  if (k.startsWith("fe8") || k.startsWith("fe9") ||
      k.startsWith("fea") || k.startsWith("feb")) return true; // Link-local fe80::/10
  if (k.startsWith("fc") || k.startsWith("fd")) return true;   // Unique local fc00::/7
  if (k.startsWith("ff")) return true;                         // Multicast
  // IPv4-mapped/-compatible (::ffff:127.0.0.1) auf die IPv4-Regeln zurückführen.
  const v4 = k.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) return istPrivateIpv4(v4[1]);
  if (k.startsWith("64:ff9b::")) return true; // NAT64
  return false;
}

export class ZielNichtErlaubtFehler extends Error {
  constructor(grund: string) {
    super(grund);
    this.name = "ZielNichtErlaubtFehler";
  }
}

/**
 * Prüft eine einzelne URL: nur http/https, und JEDE aufgelöste Adresse muss
 * öffentlich routbar sein. Schlägt die Auflösung fehl, gilt das Ziel als
 * nicht erlaubt.
 */
export async function pruefeZielUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ZielNichtErlaubtFehler("Nur http/https-Links werden unterstützt.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");

  // Ist der Host bereits eine IP-Literal-Angabe, gar nicht erst auflösen.
  if (net.isIP(host)) {
    if (istPrivateIp(host)) throw new ZielNichtErlaubtFehler("Dieser Link wird nicht unterstützt.");
    return;
  }

  let adressen: { address: string }[];
  try {
    adressen = await lookup(host, { all: true });
  } catch {
    throw new ZielNichtErlaubtFehler("Der Host konnte nicht aufgelöst werden.");
  }
  if (adressen.length === 0) throw new ZielNichtErlaubtFehler("Der Host konnte nicht aufgelöst werden.");
  // ALLE Adressen müssen sauber sein — sonst könnte ein Host mit gemischten
  // Einträgen (eine öffentliche, eine private) die Prüfung umgehen.
  if (adressen.some((a) => istPrivateIp(a.address))) {
    throw new ZielNichtErlaubtFehler("Dieser Link wird nicht unterstützt.");
  }
}

const MAX_WEITERLEITUNGEN = 5;

/**
 * `fetch` mit SSRF-Prüfung vor jedem Sprung.
 *
 * Weiterleitungen werden NICHT automatisch verfolgt (`redirect: "manual"`),
 * sondern einzeln eingesammelt und jeweils neu geprüft — sonst wäre die
 * Eingangsprüfung wertlos, sobald das Ziel mit einem 302 auf eine interne
 * Adresse antwortet.
 */
export async function sicheresFetch(
  start: URL,
  init: { accept: string; timeoutMs: number; userAgent: string },
): Promise<{ response: Response; endUrl: URL }> {
  let aktuell = start;

  for (let sprung = 0; sprung <= MAX_WEITERLEITUNGEN; sprung++) {
    await pruefeZielUrl(aktuell);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs);
    let antwort: Response;
    try {
      antwort = await fetch(aktuell.href, {
        redirect: "manual",
        headers: {
          "User-Agent": init.userAgent,
          Accept: init.accept,
          "Accept-Language": "de-DE,de;q=0.9",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const istWeiterleitung = antwort.status >= 300 && antwort.status < 400;
    const ziel = antwort.headers.get("location");
    if (!istWeiterleitung || !ziel) return { response: antwort, endUrl: aktuell };

    try {
      aktuell = new URL(ziel, aktuell); // relative Location auflösen
    } catch {
      throw new ZielNichtErlaubtFehler("Ungültige Weiterleitung.");
    }
  }

  throw new ZielNichtErlaubtFehler("Zu viele Weiterleitungen.");
}
