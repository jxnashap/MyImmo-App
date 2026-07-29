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

/**
 * IPv6-Adresse in acht 16-Bit-Gruppen ausschreiben.
 *
 * Ohne diesen Schritt prüfte die Funktion nur String-Präfixe — und dieselbe
 * Adresse hat in IPv6 mehrere gültige Schreibweisen. `::1` wurde geblockt,
 * `0:0:0:0:0:0:0:1` und `0::1` dagegen nicht, obwohl beides der Loopback ist.
 * Ein Exposé-Link auf `http://[0:0:0:0:0:0:0:1]:3000/` hätte den Server damit
 * auf sich selbst zeigen lassen.
 */
function ipv6Gruppen(ip: string): number[] | null {
  let k = ip.toLowerCase().split("%")[0]; // Zonen-Index abschneiden

  // Eingebettete IPv4-Notation (::ffff:127.0.0.1) in zwei Gruppen umrechnen.
  const v4 = k.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return null;
    k = k.slice(0, v4.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }

  const [links, rechts] = k.split("::") as [string, string | undefined];
  const l = links ? links.split(":").filter(Boolean) : [];
  const r = rechts !== undefined ? (rechts ? rechts.split(":").filter(Boolean) : []) : null;

  let teile: string[];
  if (r === null) {
    teile = l;
  } else {
    const luecke = 8 - l.length - r.length;
    if (luecke < 0) return null;
    teile = [...l, ...Array(luecke).fill("0"), ...r];
  }
  if (teile.length !== 8) return null;

  const zahlen = teile.map((t) => parseInt(t, 16));
  return zahlen.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffff) ? null : zahlen;
}

function istPrivateIpv6(ip: string): boolean {
  const g = ipv6Gruppen(ip);
  if (!g) return true; // nicht auswertbar → im Zweifel blocken

  const alleNull = g.every((n) => n === 0);
  if (alleNull) return true;                                   // :: unspezifiziert
  if (g.slice(0, 7).every((n) => n === 0) && g[7] === 1) return true; // ::1 Loopback

  const [h] = g;
  if ((h & 0xffc0) === 0xfe80) return true; // Link-local fe80::/10
  if ((h & 0xffc0) === 0xfec0) return true; // Site-local fec0::/10 (veraltet, aber nicht global)
  if ((h & 0xfe00) === 0xfc00) return true; // Unique local fc00::/7
  if ((h & 0xff00) === 0xff00) return true; // Multicast ff00::/8
  if (h === 0x0064 && g[1] === 0xff9b) return true; // NAT64 64:ff9b::/96
  if (h === 0x2001 && (g[1] & 0xfffe) === 0x0000) return true; // Teredo/IETF 2001::/23

  // IPv4-mapped/-compatible (::ffff:a.b.c.d bzw. ::a.b.c.d) auf die
  // IPv4-Regeln zurückführen — sonst käme ::ffff:169.254.169.254 durch.
  const eingebettet =
    g.slice(0, 5).every((n) => n === 0) && (g[5] === 0xffff || g[5] === 0);
  if (eingebettet) {
    const a = (g[6] >> 8) & 0xff, b = g[6] & 0xff, c = (g[7] >> 8) & 0xff, d = g[7] & 0xff;
    return istPrivateIpv4(`${a}.${b}.${c}.${d}`);
  }
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
