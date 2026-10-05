import { PLAENE } from "@/components/landing/data";
import { ABSETZBAR_TITEL, ABSETZBAR_VORBEHALT, absetzbarText, preisAusText } from "@/lib/absetzbar";

// Hinweis „als Werbungskosten absetzbar" bei den Preisen. Wortlaut und Rechnung:
// lib/absetzbar.ts. Rechnet mit dem hervorgehobenen Tarif (heute „MyImmo Privat"),
// damit Beispiel und Preistabelle nie auseinanderlaufen.
export default function AbsetzbarHinweis() {
  const tarif = PLAENE.find((p) => p.highlight && preisAusText(p.preis) !== null);
  const brutto = tarif ? preisAusText(tarif.preis) : null;
  if (!tarif || brutto === null) return null;
  return (
    <div className="lp-absetzbar" style={{ maxWidth: 680, margin: "32px auto 0", textAlign: "left" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{ABSETZBAR_TITEL}</h3>
      {absetzbarText(tarif.name, brutto).map((absatz) => (
        <p key={absatz} className="lp-section-sub" style={{ margin: "0 0 10px", textAlign: "left" }}>{absatz}</p>
      ))}
      <p style={{ fontSize: 12, opacity: 0.75, margin: 0 }}>{ABSETZBAR_VORBEHALT}</p>
    </div>
  );
}
