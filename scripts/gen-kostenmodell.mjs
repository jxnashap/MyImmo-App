#!/usr/bin/env node
/**
 * Kostenmodell MyImmo — erzeugt docs/business/KOSTENMODELL.md
 *
 * Zweck: Die Frage "was kostet der Betrieb bei X Nutzern?" beantwortbar machen,
 * ohne zu raten. JEDE Zahl kommt aus PREISE (nachgelesen, mit Datum und Quelle)
 * oder ANNAHMEN (offen deklariert, einzeln angreifbar).
 *
 * Aufruf:  node scripts/gen-kostenmodell.mjs
 * Regel:   Zahlen NUR hier ändern, dann neu erzeugen — nie im Markdown.
 */
import { writeFileSync } from "node:fs";

const STAND = "30.09.2026";
const USD_EUR = 0.88067; // frankfurter.dev, 30.09.2026

const eur = (usd) => usd * USD_EUR;
const f = (n, d = 2) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const f0 = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
const GB = 1024; // MB
const VERMIETER_DE = 5_500_000; // private Vermieter in Deutschland (Businessplan Kap. 3)

// ───────────────────────── PREISE (nachgelesen am 30.09.2026) ─────────────────
const PREISE = {
  supabase: {
    basis: 25,              // $/Monat Pro, inkl. $10 Compute-Guthaben
    dbFrei: 8,              // GB Disk inklusive
    dbGB: 0.125,            // $ je weiterem GB
    egressFrei: 250,        // GB inklusive
    egressGB: 0.09,         // $ je weiterem GB
    mauFrei: 100_000,
    mau: 0.00325,           // $ je weiterem MAU
  },
  vercel: {
    basis: 20,              // $/Monat Pro je Sitz
    transferFrei: 1024,     // GB (1 TB) inklusive
    transferGB: 0.15,       // $ je weiterem GB
    cdnFrei: 10,            // Mio. Anfragen inklusive
    cdnMio: 2,              // $ je weiterer Mio.
    funktionMio: 0.60,      // $ je Mio. Aufrufe
  },
  // Sonnet 5.5 (claude.com/pricing, 30.09.2026). Der Code pinnt noch
  // claude-sonnet-4-6 — Preis dient als vorwärtsgerichtete Näherung.
  ki: { inMTok: 2, outMTok: 10 },
  paddle: { prozent: 0.05, fix: 0.50 }, // $ — Produkte unter 10 $ brauchen lt. Paddle Sonderkondition
  brevo: { freiProTag: 300, starter: 9 },
  apple: 99 / 12,           // $/Monat (99 $/Jahr)
  domains: 45 / 12,         // €/Monat (.de + .com + .store, grob)
};

// ───────────────────────── ANNAHMEN (angreifbar) ──────────────────────────────
const A = {
  // Gemessen am 30.09.2026 in der Produktionsdatenbank:
  //   22 Konten, 11 mit Objekt, 4 mit Login in 30 Tagen, 9 je wiedergekehrt.
  konversion: 0.04,         // Gratis → zahlend. Plan-Annahme 3–5 %.
  aktivQuote: 0.35,         // Anteil der Gratis-Konten, der monatlich wirklich kommt.

  strukturMB: 0.40,         // MB DB je aktivem Portfolio — GEMESSEN (4,03 MB / 11 Portfolios)
  dokMBjahrZahlend: 20,     // MB/Jahr Dokumente je zahlendem Konto (Base64, +33 %)
  dokMBjahrGratis: 2,

  seitenProAktivMonat: 120, // Seitenaufrufe
  kbProSeite: 220,          // KB übertragen je Aufruf (nach Cache)
  funktionenProSeite: 2.5,  // Serverless-Aufrufe je Seitenaufruf

  kiAufrufeProZahlendJahr: 6, // NK-OCR + Objekt-Import
  kiInTok: 9000,              // Eingabe-Token je Aufruf (mehrseitiges PDF)
  kiOutTok: 2000,             // max_tokens 2500, real darunter

  // Tarifmix (Anteile der zahlenden Nutzer)
  mix: [
    { name: "Privat monatlich", preis: 7.99,  jahr: false, anteil: 0.35 },
    { name: "Privat jährlich",  preis: 79,    jahr: true,  anteil: 0.30 },
    { name: "Plus monatlich",   preis: 12.99, jahr: false, anteil: 0.20 },
    { name: "Plus jährlich",    preis: 129,   jahr: true,  anteil: 0.15 },
  ],
};

// ───────────────────────── Erlösseite ─────────────────────────────────────────
// Paddle: 5 % + 0,50 $ JE TRANSAKTION. Monatsabos zahlen die Fixgebühr 12×.
function erloes() {
  let brutto = 0, gebuehr = 0;
  const zeilen = A.mix.map((t) => {
    const jahresumsatz = t.jahr ? t.preis : t.preis * 12;
    const transaktionen = t.jahr ? 1 : 12;
    const g = jahresumsatz * PREISE.paddle.prozent + transaktionen * eur(PREISE.paddle.fix);
    brutto += jahresumsatz * t.anteil;
    gebuehr += g * t.anteil;
    return { ...t, jahresumsatz, transaktionen, gebuehr: g, quote: g / jahresumsatz };
  });
  return { zeilen, bruttoJahr: brutto, gebuehrJahr: gebuehr, nettoJahr: brutto - gebuehr };
}

// ───────────────────────── Kostenseite je Szenario ────────────────────────────
function szenario(zahlend) {
  const konten = zahlend / A.konversion;
  const gratis = konten - zahlend;
  const aktiv = zahlend + gratis * A.aktivQuote; // monatlich aktive Konten

  // Speicher (kumuliert nach 1 Jahr Betrieb auf diesem Niveau)
  const dbMB =
    aktiv * A.strukturMB +
    zahlend * A.dokMBjahrZahlend +
    gratis * A.dokMBjahrGratis;
  const dbGB = dbMB / GB;

  // Übertragung: Seitenauslieferung + Dokument-Abrufe.
  // WICHTIG: Dateien liegen als Base64 in Postgres und werden über eine
  // Next.js-Route ausgeliefert → jeder Abruf zahlt Supabase-Egress UND
  // Vercel-Transfer. Die Doppelzählung ist Absicht, nicht Fehler.
  const seiten = aktiv * A.seitenProAktivMonat;
  const seitenGB = (seiten * A.kbProSeite) / 1024 / 1024;
  const dokAbrufeGB = (zahlend * A.dokMBjahrZahlend * 0.5) / GB; // halber Bestand/Monat gelesen
  const vercelGB = seitenGB + dokAbrufeGB;
  const supaEgressGB = dokAbrufeGB + seitenGB * 0.35; // DB-Antworten für die Seiten

  const funktionenMio = (seiten * A.funktionenProSeite) / 1e6;
  const cdnMio = (seiten * 8) / 1e6; // Assets je Seitenaufruf

  // ── Kosten in $ ──
  const p = PREISE;
  const supabase =
    p.supabase.basis +
    Math.max(0, dbGB - p.supabase.dbFrei) * p.supabase.dbGB +
    Math.max(0, supaEgressGB - p.supabase.egressFrei) * p.supabase.egressGB +
    Math.max(0, aktiv - p.supabase.mauFrei) * p.supabase.mau;

  const vercel =
    p.vercel.basis +
    Math.max(0, vercelGB - p.vercel.transferFrei) * p.vercel.transferGB +
    Math.max(0, cdnMio - p.vercel.cdnFrei) * p.vercel.cdnMio +
    funktionenMio * p.vercel.funktionMio;

  const kiAufrufe = (zahlend * A.kiAufrufeProZahlendJahr) / 12;
  const ki =
    (kiAufrufe * A.kiInTok * p.ki.inMTok) / 1e6 +
    (kiAufrufe * A.kiOutTok * p.ki.outMTok) / 1e6;

  const mailsProTag = (aktiv * 3) / 30;
  const brevo = mailsProTag > p.brevo.freiProTag ? p.brevo.starter * Math.ceil(mailsProTag / 3000) : 0;

  const infraUSD = supabase + vercel + ki + brevo + p.apple;
  const infraEUR = eur(infraUSD) + PREISE.domains;

  // Erlöse
  const e = erloes();
  const umsatzMonat = (zahlend * e.bruttoJahr) / 12;
  const gebuehrMonat = (zahlend * e.gebuehrJahr) / 12;
  const nettoMonat = umsatzMonat - gebuehrMonat;

  return {
    zahlend, konten, gratis, aktiv, dbGB, vercelGB, supaEgressGB, funktionenMio, cdnMio,
    supabase, vercel, ki, brevo, infraUSD, infraEUR,
    umsatzMonat, gebuehrMonat, nettoMonat,
    deckung: nettoMonat - infraEUR,
    infraProZahlend: infraEUR / zahlend,
    marge: (nettoMonat - infraEUR) / umsatzMonat,
  };
}

const A_KONVERSION = A.konversion;
const E = erloes();
const STUFEN = [100, 500, 1000, 5000, 10000].map(szenario);

// Deckungspunkt: ab wie vielen zahlenden Nutzern trägt sich der Betrieb?
let breakEven = null;
for (let n = 1; n <= 2000; n++) {
  if (szenario(n).deckung > 0) { breakEven = n; break; }
}

// ───────────────────────── Ausgabe ────────────────────────────────────────────
const t = (rows) => rows.map((r) => "| " + r.join(" | ") + " |").join("\n");

const md = `# Kostenmodell MyImmo — was der Betrieb bei welcher Nutzerzahl kostet

> **Erzeugt aus \`scripts/gen-kostenmodell.mjs\` am ${STAND}.** Zahlen nicht hier
> ändern, sondern im Skript — dann \`node scripts/gen-kostenmodell.mjs\`.
> Wechselkurs 1 USD = ${f(USD_EUR, 5)} EUR (frankfurter.dev, ${STAND}).

Dieses Dokument beantwortet eine Frage, die im Businessplan fehlt: **Was kostet
der Betrieb, wenn es läuft?** Jede Eingangsgröße steht unten einzeln und ist
angreifbar. Wer eine Annahme für falsch hält, ändert sie im Skript und sieht
sofort, was sie bewegt.

---

## 1. Die kurze Antwort

| Zahlende Nutzer | Konten gesamt | = Anteil aller dt. Vermieter | Infrastruktur/Monat | Netto-Umsatz/Monat | Deckung/Monat | Kosten je zahlendem Nutzer |
|---|---|---|---|---|---|---|
${t(STUFEN.map((s) => [
  f0(s.zahlend), f0(s.konten), f(s.konten / VERMIETER_DE * 100, 2) + " %",
  f(s.infraEUR) + " €", f(s.nettoMonat) + " €",
  (s.deckung >= 0 ? "+" : "") + f(s.deckung) + " €", f(s.infraProZahlend) + " €",
]))}

> **Die dritte Spalte ist die Realitätsprobe.** Sie sagt, wie viele der rund
> 5,5 Mio. privaten Vermieter ein Konto angelegt haben müssten. Die Zeile mit
> 10.000 zahlenden Nutzern verlangt ${f(STUFEN.at(-1).konten / VERMIETER_DE * 100, 1)} % des
> Gesamtmarktes — das ist kein Planwert, sondern eine Obergrenzen-Rechnung.
> Der Businessplan-Zielwert für Jahr 3 (1.200 zahlend) entspricht
> ${f(1200 / A_KONVERSION / VERMIETER_DE * 100, 2)} % und ist damit die einzige Zeile,
> die man ohne Marktführerschaft erreichen kann.

**Der Betrieb trägt sich ab rund ${f0(breakEven)} zahlenden Nutzern.**
Das ist die ehrliche Antwort auf „wie tief wird das Loch?" — und sie lautet:
**flach.** Nicht, weil das Geschäft leicht wäre, sondern weil die laufenden
Serverkosten in dieser Größenordnung schlicht klein sind. Die Spalte „Deckung"
ist **kein Gewinn** — Arbeitszeit, Recht, Steuerberatung, Support und Marketing
stehen nicht darin (Abschnitt 5).
Darunter ist die Differenz aus eigener Tasche zu tragen — bei null zahlenden
Nutzern sind das die Grundgebühren von rund **${f(eur(PREISE.supabase.basis + PREISE.vercel.basis + PREISE.apple) + PREISE.domains)} € im Monat**.

**Das Entscheidende an dieser Tabelle:** Die Kosten je zahlendem Nutzer *fallen*
mit der Größe (von ${f(STUFEN[0].infraProZahlend)} € auf ${f(STUFEN.at(-1).infraProZahlend)} €), weil
die Grundgebühren fix sind. Das Geschäftsmodell skaliert also — der Engpass ist
nicht die Technik, sondern die Zahl der Nutzer.

---

## 2. Was an den Erlösen hängen bleibt (Paddle)

Paddle nimmt **${PREISE.paddle.prozent * 100} % + ${f(PREISE.paddle.fix)} $ je Transaktion**. Die Fixgebühr
ist der Punkt, den man übersieht: Ein Monatsabo zahlt sie **zwölfmal im Jahr**.

| Tarif | Jahresumsatz | Transaktionen | Paddle-Gebühr | davon Anteil |
|---|---|---|---|---|
${t(E.zeilen.map((z) => [
  z.name, f(z.jahresumsatz) + " €", String(z.transaktionen),
  f(z.gebuehr) + " €", f(z.quote * 100, 1) + " %",
]))}

**Ein Monatsabo für 7,99 € verliert ${f(E.zeilen[0].quote * 100, 1)} % an Paddle, ein Jahresabo nur ${f(E.zeilen[1].quote * 100, 1)} %.**
Daraus folgt unmittelbar: **Jahresabos aktiv bewerben.** Sie senken nicht nur die
Abwanderung, sie sind auch strukturell billiger.

⚠️ **Offener Punkt:** Paddle schreibt auf der eigenen Preisseite, dass Produkte
**unter 10 $** eine Sonderkondition brauchen. Der Einstiegstarif liegt bei 7,99 €.
Das ist vor dem Scharfschalten zu klären — es kann die Zahlen oben verschlechtern.

Über den Tarifmix ergibt sich ein Umsatz von **${f(E.bruttoJahr)} € je zahlendem Nutzer und Jahr**
(Businessplan rechnet mit ~96 €), nach Paddle **${f(E.nettoJahr)} €**.

---

## 3. Woraus die Infrastrukturkosten bestehen

| Zahlende | Supabase | Vercel | KI (OCR/Import) | Brevo | Summe $ | Summe € |
|---|---|---|---|---|---|---|
${t(STUFEN.map((s) => [
  f0(s.zahlend), f(s.supabase) + " $", f(s.vercel) + " $", f(s.ki) + " $",
  f(s.brevo) + " $", f(s.infraUSD) + " $", f(s.infraEUR) + " €",
]))}

### Was dahinter steckt

| Zahlende | Datenbank | Vercel-Transfer | Supabase-Egress | Funktionsaufrufe |
|---|---|---|---|---|
${t(STUFEN.map((s) => [
  f0(s.zahlend), f(s.dbGB, 1) + " GB", f(s.vercelGB, 1) + " GB",
  f(s.supaEgressGB, 1) + " GB", f(s.funktionenMio, 2) + " Mio.",
]))}

**Zwei Dinge, die man kennen muss:**

1. **Dateien liegen als Base64 in Postgres-Spalten, nicht in einem Objektspeicher.**
   Jeder Dokumentabruf zahlt deshalb **zweimal** Übertragung: einmal Supabase-Egress
   (Datenbank → Serverfunktion), einmal Vercel-Transfer (Funktion → Browser). Base64
   bläht die Datei zusätzlich um 33 % auf. Das ist heute folgenlos — **gemessen am
   ${STAND} liegen ganze 15 Dateien mit zusammen 183 KB im System** —, wird aber zum
   größten Einzelposten, sobald Vermieter ihr Belegarchiv wirklich füllen.
   Gegenmittel (nicht gebaut): Umzug auf Supabase Storage, dort kostet das GB
   ${f(PREISE.supabase.egressGB)} $ statt Datenbank-Disk zu ${f(PREISE.supabase.dbGB)} $ — und der doppelte
   Transfer entfällt.
2. **Gratis-Nutzer kosten Geld.** Bei ${A.konversion * 100} % Konversion stehen hinter
   ${f0(STUFEN[2].zahlend)} zahlenden Nutzern ${f0(STUFEN[2].konten)} Konten. Sie erzeugen Speicher,
   Seitenaufrufe und Funktionsaufrufe, ohne etwas einzubringen. Im Businessplan
   taucht diese Zahl nirgends auf.

---

## 4. Alle Annahmen auf einen Blick

| Größe | Wert | Herkunft |
|---|---|---|
| Konversion Gratis → zahlend | ${A.konversion * 100} % | Businessplan-Annahme (3–5 %), **unbelegt** |
| Monatlich aktive Gratis-Konten | ${A.aktivQuote * 100} % | Schätzung. **Gemessen sind es heute 18 %** (4 von 22) |
| DB je aktivem Portfolio | ${f(A.strukturMB, 2)} MB | **gemessen** (4,03 MB Nutzdaten / 11 Portfolios) |
| Dokumente je zahlendem Konto/Jahr | ${A.dokMBjahrZahlend} MB | Schätzung — **nie gemessen**, heute 183 KB im ganzen System |
| Seitenaufrufe je aktivem Konto/Monat | ${A.seitenProAktivMonat} | Schätzung — **keine Analytics installiert** |
| Übertragung je Seitenaufruf | ${A.kbProSeite} KB | Schätzung |
| KI-Aufrufe je zahlendem Konto/Jahr | ${A.kiAufrufeProZahlendJahr} | Schätzung (NK-OCR + Import) |
| Token je KI-Aufruf | ${f0(A.kiInTok)} ein / ${f0(A.kiOutTok)} aus | Aus dem Code (\`max_tokens: 2500\`), Eingabe geschätzt |

### Was daran ehrlicherweise unsicher ist

- **Die Seitenaufrufe sind geraten.** Speed Insights wurde am 08.09.2026 entfernt,
  weil die Datenschutzerklärung „keine Analyse-Tools" zusagt. Es gibt derzeit
  **keine Messung des Verkehrs**. Das ist die größte Lücke im Modell.
- **Die Dokumentmenge ist geraten.** Sie ist zugleich der Posten mit dem
  größten Hebel — verzehnfacht sie sich, verschiebt sich die Datenbankzeile
  deutlich.
- **Die Konversion ist geraten.** Sie stammt aus dem Businessplan und ist durch
  nichts belegt, weil noch nie jemand etwas bezahlt hat.

**Robust ist das Modell trotzdem in einer Hinsicht:** Selbst wenn sich die
variablen Posten verdoppeln, bleibt der Betrieb bei ${f0(STUFEN[2].zahlend)} zahlenden Nutzern
klar profitabel — weil die Grundgebühren mit rund ${f(eur(PREISE.supabase.basis + PREISE.vercel.basis))} € den Löwenanteil
ausmachen und nicht mitwachsen.

---

## 5. Was NICHT in diesen Zahlen steckt

| Posten | Warum nicht | Größenordnung |
|---|---|---|
| Eigene Arbeitszeit | Bootstrapped, nicht eingepreist | bei 1.500 €/M kalkulatorisch = größter Posten überhaupt |
| Anwaltliche Prüfung | Einmalig, vor dem Bezahlstart fällig | 2.000–5.000 € |
| Steuerberatung | Ab Bezahlbetrieb nötig | 600–1.800 €/Jahr |
| Apple Developer Program | Erst beim iOS-Start | 99 $/Jahr |
| Apple In-App-Kauf-Provision | Erst beim iOS-Start | 15–30 % auf iOS-Abos — **deutlich teurer als Paddle** |
| Marketing | Der eigentliche Engpass | offen |
| Support | Skaliert mit Nutzern, heute null | offen |

**Der wichtigste Satz dieses Dokuments:** Die Infrastruktur ist nicht das Problem.
Bei ${f0(STUFEN[2].zahlend)} zahlenden Nutzern kostet sie ${f(STUFEN[2].infraEUR)} € im Monat gegen
${f(STUFEN[2].nettoMonat)} € Netto-Umsatz. Das Geschäft entscheidet sich **nicht an den
Serverkosten, sondern daran, ob die Nutzer kommen und bleiben.**
`;

writeFileSync("docs/business/KOSTENMODELL.md", md);
console.log("docs/business/KOSTENMODELL.md geschrieben.");
console.log(`Break-even: ${breakEven} zahlende Nutzer`);
for (const s of STUFEN) {
  console.log(
    `${String(s.zahlend).padStart(6)} zahlend | ${f0(s.konten).padStart(7)} Konten | ` +
    `Infra ${f(s.infraEUR).padStart(9)} € | Netto ${f(s.nettoMonat).padStart(10)} € | ` +
    `Deckung ${f(s.deckung).padStart(10)} € | je Nutzer ${f(s.infraProZahlend)} €`
  );
}
