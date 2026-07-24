import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";

const GOLD = rgb(0.722, 0.565, 0.169);
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);
const LINE = rgb(0.82, 0.8, 0.76);
const BOX = rgb(0.97, 0.96, 0.94);
const A4 = { w: 595.28, h: 841.89 };
const ML = 56, MR = 56, RIGHT = A4.w - MR;

function sanitize(s) {
  return (s ?? "").replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/ /g, " ")
    .split("").map((c) => {
      if (c.charCodeAt(0) <= 255 || c === "€") return c;
      const b = c.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      return b.length && b.charCodeAt(0) <= 255 ? b : "?";
    }).join("");
}
const tracked = (s) => s.split("").join(" ");

// Inhaltsblöcke: h=Überschrift, p=Absatz, b=Fettabsatz-Vorspann, ul=Liste, note=Kasten, sign=Unterschrift
const AVV = [
  { h: "1. Parteien, Gegenstand und Dauer" },
  { kv: [["Verantwortlicher:", "die Nutzerin / der Nutzer des jeweiligen MyImmo-Kontos (Vermieter)."],
         ["Auftragsverarbeiter:", "Jonas Scharp (MyImmo), Ludwig-Jahn-Straße 42, 23611 Bad Schwartau („Betreiber“)."]] },
  { p: "Gegenstand ist die Bereitstellung der Web-Anwendung MyImmo zur Immobilien- und Mietverwaltung, in der der Verantwortliche personenbezogene Daten Dritter (insbesondere seiner Mieter und Mietinteressenten) speichert und verarbeitet. Die Vereinbarung gilt für die Dauer des Nutzungsverhältnisses und endet mit der Löschung des Kontos." },
  { note: "Nicht Gegenstand dieser Fassung: Die treuhänderische Verwaltung fremder Immobilienbestände durch gewerbliche Hausverwaltungen (Mehrmandanten-Verwaltung) wird - vor ihrer produktiven Nutzung - durch eine gesonderte Ergänzung dieses Vertrags geregelt." },

  { h: "2. Art und Zweck der Verarbeitung" },
  { p: "Hosting, Speicherung, Anzeige, Auswertung und Ausgabe (z. B. Abrechnungen, Briefe, Exporte) der vom Verantwortlichen erfassten Daten. Hinzu kommen - jeweils auf Veranlassung des Verantwortlichen - Selbstbedienungs-Funktionen für die von ihm eingeladenen Mieter (Meldung von Zählerständen mit Foto-Beleg, Schadens- und sonstige Anliegen mit Foto-/Dokumentanhängen, Terminabstimmung sowie die Beantwortung von Anfragen des Verantwortlichen), die Erfassung und Auswertung von Mietbewerbungen (Selbstauskünfte von Mietinteressenten), die Abwicklung von Aufträgen mit vom Verantwortlichen beauftragten Service-Partnern (Handwerkern, Hausmeistern) - einschließlich der hierfür erforderlichen Weitergabe von Objekt- und Mieterkontaktdaten zur Termin- und Leistungsabstimmung -, KI-gestützte Dokumentauswertung sowie zeitlich begrenzte Freigaben an vom Verantwortlichen benannte Empfänger (z. B. Banken). Eine Verarbeitung zu eigenen Zwecken des Betreibers findet nicht statt." },

  { h: "3. Art der Daten und Kategorien betroffener Personen" },
  { b: "Datenarten:" },
  { ul: [
    "Stammdaten (Name, Anschrift, Kontaktdaten);",
    "Vertragsdaten des Mietverhältnisses (Mietbeginn/-ende, Miete, Kaution, Einheit);",
    "Abrechnungs- und Zahlungsdaten einschließlich Bankverbindung (letztere anwendungsseitig verschlüsselt);",
    "Verbrauchsdaten, einschließlich der vom Mieter selbst gemeldeten Zählerstände nebst Foto-Belegen;",
    "Anliegen- und Kommunikationsdaten: vom Mieter gemeldete Schäden, Fragen und Dokumentanfragen mit Freitext und Foto-/PDF-Anhängen; Anfragen des Verantwortlichen und Antworten des Mieters; Daten zur Terminkoordination;",
    "Dokumente, Belege und Übergabeprotokolle;",
    "Bewerbungsdaten von Mietinteressenten: selbst angegebene Angaben zu Beruf, Arbeitgeber, Netto-Einkommen, Bonität/SCHUFA, Haushaltsgröße, Haustieren/Rauchen, eine Freitext-Nachricht sowie eine elektronische Unterschrift;",
    "Auftrags- und Dienstleisterdaten: Aufträge an Service-Partner (Titel, Beschreibung, Objekt- und Vermietername, Termin, Betrag, Lohnanteil nach § 35a EStG), zugehörige Rechnungen sowie Kontaktdaten beauftragter Handwerks- und Dienstleistungsbetriebe;",
    "Notizen des Verantwortlichen.",
  ] },
  { note: "Besondere Kategorien personenbezogener Daten (Art. 9 DSGVO) sind nicht Gegenstand der Verarbeitung; der Verantwortliche trägt dafür Sorge, keine solchen Daten in Freitext- oder Upload-Feldern einzugeben." },
  { b: "Betroffene Personen:" },
  { ul: [
    "Mieter und ehemalige Mieter des Verantwortlichen, die die App teilweise selbst nutzen (eigener, per Einladung erstellter Zugang);",
    "Mietinteressenten und Bewerber;",
    "weitere im Haushalt lebende oder im Mietverhältnis auftretende Personen (z. B. Mitbewohner, Bürgen);",
    "vom Verantwortlichen beauftragte Service-Partner (Handwerker, Hausmeister) und deren Ansprechpartner;",
    "Ansprechpartner von Banken bei Freigabe-Rückmeldungen.",
  ] },

  { h: "4. Weisungsbindung (Art. 28 Abs. 3 lit. a)" },
  { p: "Der Betreiber verarbeitet die Daten ausschließlich auf dokumentierte Weisung des Verantwortlichen; Weisungen werden über die Funktionen der App erteilt (Anlegen, Ändern, Freigeben, Löschen). Auch Eingaben, die vom Verantwortlichen eingeladene Mieter oder Mietinteressenten über die von ihm freigeschalteten Funktionen selbst vornehmen (z. B. Zählerstände, Anliegen, Bewerbungen), gelten als im Auftrag und auf Veranlassung des Verantwortlichen erfolgt. Hält der Betreiber eine Weisung für rechtswidrig, informiert er den Verantwortlichen unverzüglich. Eine Verarbeitung nach dem Recht der Union oder eines Mitgliedstaats bleibt vorbehalten; in diesem Fall wird der Verantwortliche vorab informiert, soweit rechtlich zulässig." },

  { h: "5. Vertraulichkeit (lit. b)" },
  { p: "Zum Zugriff befugte Personen sind zur Vertraulichkeit verpflichtet. Der Betreiber greift auf Inhaltsdaten nur zu, soweit dies für Betrieb, Fehlerbehebung oder auf Wunsch des Verantwortlichen erforderlich ist." },

  { h: "6. Sicherheit der Verarbeitung (lit. c, Art. 32)" },
  { p: "Der Betreiber trifft die in der Anlage TOM (unten) beschriebenen technischen und organisatorischen Maßnahmen und entwickelt sie entsprechend dem Stand der Technik fort." },

  { h: "7. Subauftragsverarbeiter (lit. d)" },
  { p: "Der Verantwortliche erteilt die allgemeine Genehmigung zum Einsatz folgender Subauftragsverarbeiter:" },
  { ul: [
    "Supabase Inc. - Datenbank, Authentifizierung, Datei-Speicher; Datenhaltung Frankfurt (AWS eu-central-1); DPA mit EU-Standardvertragsklauseln.",
    "Vercel Inc. (USA) - Hosting/Auslieferung; DPA mit EU-Standardvertragsklauseln.",
    "Anthropic PBC (USA) - KI-Auswertung, nur bei aktiver Nutzung durch den Verantwortlichen; DPA mit EU-Standardvertragsklauseln; kein Modell-Training mit API-Daten.",
    "Google Ireland Ltd. - nur „Login mit Google“ und Schriftarten-Auslieferung.",
    "Enable Banking Oy (Finnland/EU) - Kontoinformationsdienst (Open Banking, nur bei aktiver Konto-Anbindung); lizenzierter AISP unter Aufsicht der FIN-FSA; Verarbeitung in der EU.",
  ] },
  { p: "Über beabsichtigte Änderungen (Hinzufügen/Ersetzen) informiert der Betreiber vorab in der App oder per E-Mail; der Verantwortliche kann innerhalb von 14 Tagen aus wichtigem Grund widersprechen. Bei Widerspruch steht beiden Parteien die Kündigung des Nutzungsverhältnisses offen. Der Betreiber verpflichtet Subauftragsverarbeiter auf mindestens gleichwertige Datenschutzpflichten und haftet für sie wie für eigenes Handeln. Übermittlungen in Drittländer erfolgen nur mit Garantien nach Kap. V DSGVO (Standardvertragsklauseln bzw. Angemessenheitsbeschluss)." },
  { p: "Von Subauftragsverarbeitern zu unterscheiden sind Empfänger, an die der Verantwortliche über die App bewusst Daten weitergibt - etwa Banken bei Dokumentfreigaben oder von ihm beauftragte Service-Partner (Handwerker, Hausmeister) zur Auftrags- und Terminabwicklung. Diese Weitergabe erfolgt ausschließlich auf Veranlassung des Verantwortlichen; die Empfänger verarbeiten die Daten für ihre eigenen Zwecke in eigener datenschutzrechtlicher Verantwortung." },

  { h: "8. Unterstützung bei Betroffenenrechten (lit. e)" },
  { p: "Der Betreiber unterstützt den Verantwortlichen mit geeigneten Mitteln bei der Beantwortung von Anträgen betroffener Personen (Art. 12-23 DSGVO) - insbesondere durch die Auskunfts-, Export-, Berichtigungs- und Löschfunktionen der App. Anträge, die beim Betreiber eingehen, leitet er unverzüglich an den Verantwortlichen weiter." },

  { h: "9. Meldepflichten und weitere Unterstützung (lit. f)" },
  { p: "Der Betreiber meldet dem Verantwortlichen Verletzungen des Schutzes personenbezogener Daten unverzüglich nach Bekanntwerden mit den Informationen nach Art. 33 Abs. 3 DSGVO und unterstützt ihn bei seinen Pflichten aus Art. 32-36 DSGVO (Sicherheit, Meldungen, ggf. Datenschutz-Folgenabschätzung) unter Berücksichtigung der verfügbaren Informationen." },

  { h: "10. Löschung und Rückgabe (lit. g)" },
  { p: "Nach Ende des Nutzungsverhältnisses - insbesondere bei Kontolöschung durch den Verantwortlichen - werden sämtliche personenbezogenen Daten einschließlich der Dateien im Datei-Speicher unwiderruflich gelöscht, soweit keine gesetzliche Aufbewahrungspflicht des Betreibers entgegensteht. Der Verantwortliche kann seine Daten zuvor über die Export-Funktionen der App sichern. Restkopien in technischen Backups werden turnusmäßig überschrieben." },

  { h: "11. Nachweise und Kontrollen (lit. h)" },
  { p: "Der Betreiber stellt dem Verantwortlichen alle zum Nachweis der Einhaltung dieses Vertrags erforderlichen Informationen zur Verfügung (insbesondere diese Vereinbarung, die Anlage TOM und die Zertifizierungen/DPAs der Subauftragsverarbeiter) und ermöglicht angemessene Überprüfungen. Kontrollen erfolgen in der Regel durch Auskünfte und Vorlage geeigneter Nachweise; Vor-Ort-Kontrollen nur bei konkretem Anlass und nach Ankündigung." },

  { h: "12. Schlussbestimmungen" },
  { p: "Es gilt deutsches Recht. Die Haftung richtet sich nach Art. 82 DSGVO und den gesetzlichen Regeln. Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam. Bei Widersprüchen zu den allgemeinen Nutzungsbedingungen geht dieser AVV in Datenschutzfragen vor." },

  { h: "Anlage: Technische und organisatorische Maßnahmen (TOM)" },
  { ul: [
    "Zugangs-/Zugriffskontrolle: Anmeldung mit E-Mail/Passwort (bcrypt-Hash) oder Google-OAuth; strikte Mandantentrennung je Konto auf Datenbankebene (Row Level Security); private Datei-Speicher mit Zugriff nur über kurzlebige signierte Links bzw. eigentümergebundene Richtlinien.",
    "Übertragungskontrolle: ausschließlich TLS-verschlüsselte Verbindungen; Content-Security-Policy und Sicherheits-Header.",
    "Verschlüsselung: Speicherung bei Anbietern mit Verschlüsselung „at rest“; zusätzlich anwendungsseitige AES-256-GCM-Verschlüsselung von Bankverbindungsdaten mit Schlüssel außerhalb der Datenbank.",
    "Verfügbarkeitskontrolle: Betrieb bei professionellen Cloud-Anbietern mit redundanter Infrastruktur und turnusmäßigen Backups.",
    "Trennungsgebot: Row Level Security stellt sicher, dass jedes Konto ausschließlich eigene Datensätze lesen und schreiben kann; Bank-Freigaben liefern nur explizit ausgewählte Dokumente über ablaufende, widerrufbare Token aus.",
    "Eingabekontrolle: Änderungen erfolgen kontogebunden über authentifizierte Sitzungen; destruktive Aktionen erfordern Bestätigung. Selbstbedienungs-Eingaben von Mietern und Mietinteressenten (Zählerstände, Anliegen, Bewerbungen, Datei-Uploads) sind dem einladenden Verantwortlichen zugeordnet und nur diesem zugänglich.",
    "Organisatorisches: Zugriff auf Produktionssysteme nur durch den Betreiber; Geheimnisse (API-Schlüssel, Verschlüsselungsschlüssel) werden außerhalb des Quellcodes in der Hosting-Umgebung verwaltet.",
  ] },
  { sign: true },
];

const doc = await PDFDocument.create();
doc.setTitle("Auftragsverarbeitungsvertrag (AVV) - MyImmo");
doc.setCreator("MyImmo");
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const serif = await doc.embedFont(StandardFonts.TimesRoman);
const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);

const pages = [];
let page, y;

function kopf(first) {
  page = doc.addPage([A4.w, A4.h]); pages.push(page);
  const yTop = A4.h - 52;
  page.drawText("My", { x: ML, y: yTop, size: first ? 22 : 14, font: serif, color: INK });
  const wMy = serif.widthOfTextAtSize("My", first ? 22 : 14);
  page.drawText("Immo", { x: ML + wMy, y: yTop, size: first ? 22 : 14, font: serifI, color: GOLD });
  if (first) {
    page.drawText(sanitize(tracked("PRIVATES IMMOBILIEN-MANAGEMENT")), { x: ML, y: yTop - 16, size: 6.5, font, color: MUTED });
    const nm = "Jonas Scharp (MyImmo)";
    page.drawText(nm, { x: RIGHT - bold.widthOfTextAtSize(nm, 10), y: yTop - 2, size: 10, font: bold, color: INK });
    const ad = "Ludwig-Jahn-Straße 42 · 23611 Bad Schwartau";
    page.drawText(sanitize(ad), { x: RIGHT - font.widthOfTextAtSize(sanitize(ad), 8.5), y: yTop - 16, size: 8.5, font, color: MUTED });
    const em = "info@myimmoapp.de";
    page.drawText(em, { x: RIGHT - font.widthOfTextAtSize(em, 8.5), y: yTop - 29, size: 8.5, font, color: MUTED });
    page.drawLine({ start: { x: 372, y: A4.h - 44 }, end: { x: 372, y: A4.h - 82 }, thickness: 1, color: GOLD });
  } else {
    const rt = "Auftragsverarbeitungsvertrag (AVV)";
    page.drawText(rt, { x: RIGHT - font.widthOfTextAtSize(rt, 8.5), y: yTop - 2, size: 8.5, font, color: MUTED });
  }
  page.drawLine({ start: { x: ML, y: A4.h - 96 }, end: { x: RIGHT, y: A4.h - 96 }, thickness: 0.8, color: GOLD });
  y = A4.h - 118;
}

function raum(need) { if (y - need < 84) kopf(false); }

function wrap(s, size, maxW, f) {
  const words = sanitize(s).split(" "); const lines = []; let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function para(s, { size = 10, f = font, color = INK, x = ML, maxW = RIGHT - ML, lh = 13.5, gap = 7 } = {}) {
  for (const ln of wrap(s, size, maxW, f)) { raum(lh); page.drawText(ln, { x, y, size, font: f, color }); y -= lh; }
  y -= gap;
}

kopf(true);
// Titelzeile
page.drawText("Auftragsverarbeitungsvertrag (AVV)", { x: ML, y, size: 16, font: bold, color: INK }); y -= 16;
page.drawText(sanitize("Vereinbarung nach Art. 28 Abs. 3 DSGVO · Stand 24. Juli 2026"), { x: ML, y, size: 9, font, color: MUTED }); y -= 8;
page.drawLine({ start: { x: ML, y }, end: { x: ML + 300, y }, thickness: 1, color: GOLD }); y -= 18;
// Entwurfs-Hinweis-Kasten
{
  const t = "Entwurf zur anwaltlichen Prüfung. Dieses Dokument dient der rechtlichen Durchsicht und ist noch nicht final freigegeben. Keine Rechtsberatung.";
  const lines = wrap(t, 8.5, RIGHT - ML - 24, font);
  const h = lines.length * 11 + 16;
  page.drawRectangle({ x: ML, y: y - h + 8, width: RIGHT - ML, height: h, color: BOX });
  page.drawRectangle({ x: ML, y: y - h + 8, width: 3, height: h, color: GOLD });
  let yy = y - 6;
  for (const ln of lines) { page.drawText(ln, { x: ML + 14, y: yy, size: 8.5, font, color: MUTED }); yy -= 11; }
  y = y - h - 4;
}

for (const blk of AVV) {
  if (blk.h) {
    raum(30);
    y -= 6;
    page.drawText(sanitize(blk.h), { x: ML, y, size: 11.5, font: bold, color: INK }); y -= 4;
    page.drawLine({ start: { x: ML, y }, end: { x: RIGHT, y }, thickness: 1.2, color: GOLD }); y -= 14;
  } else if (blk.b) {
    raum(16); page.drawText(sanitize(blk.b), { x: ML, y, size: 10, font: bold, color: INK }); y -= 15;
  } else if (blk.p) {
    para(blk.p);
  } else if (blk.kv) {
    for (const [k, v] of blk.kv) {
      raum(14);
      const lines = wrap(v, 10, RIGHT - ML - 118, font);
      page.drawText(sanitize(k), { x: ML, y, size: 10, font: bold, color: INK });
      lines.forEach((ln, i) => { page.drawText(ln, { x: ML + 118, y: y - i * 13.5, size: 10, font, color: INK }); });
      y -= lines.length * 13.5 + 4;
    }
    y -= 4;
  } else if (blk.ul) {
    for (const it of blk.ul) {
      const lines = wrap(it, 10, RIGHT - ML - 16, font);
      raum(lines.length * 13.5);
      page.drawText("•", { x: ML + 2, y, size: 10, font, color: GOLD });
      lines.forEach((ln, i) => page.drawText(ln, { x: ML + 16, y: y - i * 13.5, size: 10, font, color: INK }));
      y -= lines.length * 13.5 + 3;
    }
    y -= 5;
  } else if (blk.note) {
    const lines = wrap(blk.note, 9.5, RIGHT - ML - 26, font);
    const h = lines.length * 12 + 14;
    raum(h + 6);
    page.drawRectangle({ x: ML, y: y - h + 9, width: RIGHT - ML, height: h, color: BOX });
    page.drawRectangle({ x: ML, y: y - h + 9, width: 3, height: h, color: GOLD });
    let yy = y - 4;
    for (const ln of lines) { page.drawText(ln, { x: ML + 14, y: yy, size: 9.5, font, color: MUTED }); yy -= 12; }
    y = y - h - 2;
  } else if (blk.sign) {
    raum(150);
    y -= 8;
    page.drawText("Unterzeichnung", { x: ML, y, size: 11.5, font: bold, color: INK }); y -= 16;
    para("In der App wird dieser Vertrag mit der Registrierung bzw. der weiteren Nutzung wirksam. Für die schriftliche Vorlage:", { size: 9.5, color: MUTED });
    y -= 18;
    const colW = (RIGHT - ML - 30) / 2;
    const cols = [{ x: ML, label: "Verantwortlicher (Vermieter)", who: "Name / Unterschrift" },
                  { x: ML + colW + 30, label: "Auftragsverarbeiter (MyImmo)", who: "Jonas Scharp" }];
    for (const c of cols) {
      page.drawText(c.label, { x: c.x, y, size: 9, font: bold, color: MUTED });
    }
    y -= 34;
    for (const c of cols) { page.drawLine({ start: { x: c.x, y }, end: { x: c.x + colW, y }, thickness: 0.8, color: rgb(0.72,0.7,0.64) }); page.drawText("Ort, Datum", { x: c.x, y: y - 11, size: 8, font, color: MUTED }); }
    y -= 46;
    for (const c of cols) { page.drawLine({ start: { x: c.x, y }, end: { x: c.x + colW, y }, thickness: 0.8, color: rgb(0.72,0.7,0.64) }); page.drawText(c.who, { x: c.x, y: y - 11, size: 8, font, color: MUTED }); }
  }
}

// Fußzeilen
pages.forEach((pg, i) => {
  pg.drawLine({ start: { x: ML, y: 64 }, end: { x: RIGHT, y: 64 }, thickness: 0.6, color: LINE });
  pg.drawText("MyImmo", { x: ML, y: 52, size: 7.5, font, color: MUTED });
  const mid = `Seite ${i + 1} von ${pages.length}`;
  pg.drawText(mid, { x: (A4.w - font.widthOfTextAtSize(mid, 7.5)) / 2, y: 52, size: 7.5, font, color: MUTED });
  const r = sanitize("AVV · Art. 28 DSGVO · Stand 24.07.2026");
  pg.drawText(r, { x: RIGHT - font.widthOfTextAtSize(r, 7.5), y: 52, size: 7.5, font, color: MUTED });
});

fs.writeFileSync("docs/compliance/avv-nutzer-vertrag-2026-07-24.pdf", await doc.save());
console.log("fertig:", pages.length, "Seiten");
