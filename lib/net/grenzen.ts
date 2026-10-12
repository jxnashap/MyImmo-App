// Größen- und Zeitgrenzen für Daten, die von außen kommen (B16, Prüfstand 11.10.2026).
//
// BEFUND: Der Link-Import las fremde PDFs/HTML-Seiten VOLLSTÄNDIG in den Speicher und prüfte erst
// danach die Größe (`arrayBuffer()`/`text()`); die KI-Routen lasen den Anfrage-Body ganz (`req.json()`)
// vor jeder Grenze. Der Zeitgeber endete, sobald die KOPFZEILEN da waren — ein Server, der den Body
// langsam tröpfeln lässt, hielt die Funktion bis zum Plattform-Abbruch fest.
//
// JETZT: `liesBegrenzt()` prüft `Content-Length` vorab und bricht das Lesen ab, sobald mehr als die
// Grenze ankommt. Wer liest, tut es innerhalb seines Zeitgebers (die Aufrufer lesen den Body in
// demselben `try`, bevor sie den Zeitgeber löschen).

/** Der Inhalt ist größer als erlaubt — es wurde nicht weitergelesen. */
export class ZuGrossFehler extends Error {
  constructor(public readonly grenze: number) {
    super(`Inhalt größer als ${Math.round(grenze / (1024 * 1024))} MB.`);
    this.name = "ZuGrossFehler";
  }
}

type MitBody = { headers: Headers; body: ReadableStream<Uint8Array> | null };

/**
 * Liest höchstens `maxBytes`; mehr → `ZuGrossFehler` (der Rest wird verworfen, nicht gelesen).
 * Mit `abschneiden` liefert es stattdessen die ersten `maxBytes` (für HTML-Text, wo der Anfang genügt).
 */
export async function liesBegrenzt(quelle: MitBody, maxBytes: number, opts: { abschneiden?: boolean } = {}): Promise<Uint8Array<ArrayBuffer>> {
  const angegeben = Number(quelle.headers.get("content-length"));
  if (!opts.abschneiden && Number.isFinite(angegeben) && angegeben > maxBytes) {
    await quelle.body?.cancel().catch(() => {});
    throw new ZuGrossFehler(maxBytes);
  }
  if (!quelle.body) return new Uint8Array(0);
  const leser = quelle.body.getReader();
  const teile: Uint8Array[] = [];
  let gesamt = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    if (gesamt + value.byteLength > maxBytes) {
      await leser.cancel().catch(() => {});
      if (!opts.abschneiden) throw new ZuGrossFehler(maxBytes);
      teile.push(value.subarray(0, maxBytes - gesamt));
      gesamt = maxBytes;
      break;
    }
    gesamt += value.byteLength;
    teile.push(value);
  }
  const aus = new Uint8Array(gesamt);
  let pos = 0;
  for (const t of teile) {
    aus.set(t, pos);
    pos += t.byteLength;
  }
  return aus;
}

/** JSON-Body einer Anfrage mit Größengrenze. Ungültiges JSON → `SyntaxError`. */
export async function jsonBegrenzt(req: Request, maxBytes: number): Promise<unknown> {
  const bytes = await liesBegrenzt(req, maxBytes);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Größe eines Base64-Inhalts nach dem Dekodieren → nötige Grenze für den JSON-Body (mit Rand). */
export const jsonGrenzeFuerBase64 = (rohBytes: number) => Math.ceil((rohBytes * 4) / 3) + 64 * 1024;
