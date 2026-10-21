// Fotos im Browser verkleinern, bevor sie hochgeladen werden (21.10.2026, lib/anhaenge.ts).
//
// Ein Handyfoto hat 2–6 MB; für „was ist kaputt?“ reichen 2000 px an der langen Kante. Als
// JPEG mit Qualität 0,82 sind das meist 300–700 KB. Nebenbei fallen die Metadaten weg (auch
// der GPS-Standort, den Kameras in Fotos schreiben) — das Bild wird neu gezeichnet.
//
// Klappt das Verkleinern nicht (Format, das der Browser nicht dekodiert, z. B. HEIC in
// Chrome), bleibt die Originaldatei — die Größenprüfung entscheidet dann.

const OHNE_VERKLEINERN = new Set(["image/gif", "image/svg+xml"]);
const KLEIN_GENUG = 900 * 1024;

export async function verkleinereBild(datei: File, maxKante = 2000, qualitaet = 0.82): Promise<File> {
  if (!datei.type.startsWith("image/") || OHNE_VERKLEINERN.has(datei.type) || datei.size <= KLEIN_GENUG) return datei;
  if (typeof document === "undefined") return datei;
  const url = URL.createObjectURL(datei);
  try {
    const bild = new Image();
    bild.src = url;
    await bild.decode();
    const faktor = Math.min(1, maxKante / Math.max(bild.naturalWidth, bild.naturalHeight));
    const breite = Math.max(1, Math.round(bild.naturalWidth * faktor));
    const hoehe = Math.max(1, Math.round(bild.naturalHeight * faktor));
    const leinwand = document.createElement("canvas");
    leinwand.width = breite;
    leinwand.height = hoehe;
    const ctx = leinwand.getContext("2d");
    if (!ctx) return datei;
    ctx.drawImage(bild, 0, 0, breite, hoehe);
    const blob = await new Promise<Blob | null>((ok) => leinwand.toBlob(ok, "image/jpeg", qualitaet));
    if (!blob || blob.size >= datei.size) return datei;
    const name = datei.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: datei.lastModified });
  } catch {
    return datei;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Mehrere Dateien nacheinander (Handys haben wenig Speicher — nicht parallel). */
export async function verkleinereAlle(dateien: File[]): Promise<File[]> {
  const fertig: File[] = [];
  for (const d of dateien) fertig.push(await verkleinereBild(d));
  return fertig;
}
