import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { KAUFWEG, naechsterSchritt, wegSchritt, type WegSchrittId } from "@/lib/kaufweg";

// Schritt-Kopf des Kaufwegs (BuyImmo, 06.10.2026): steht oben auf jeder Schritt-Seite — wo bin ich
// (1 bis 5), was passiert hier, worauf muss ich achten, wohin geht es weiter. Ein Anfänger soll
// sich von Schritt zu Schritt durchklicken können, ohne den Weg zu kennen. Server-Komponente,
// „Worauf achten“ ist ein <details> (ohne JavaScript bedienbar). Texte: lib/kaufweg.ts.

export default function WegKopf({ schritt }: { schritt: WegSchrittId }) {
  const s = wegSchritt(schritt);
  const weiter = naechsterSchritt(schritt);
  return (
    <nav className="weg-kopf no-print" aria-label="Dein Weg zum Kauf">
      <ol className="weg-punkte">
        {KAUFWEG.map((w) => (
          <li key={w.id} className={`weg-punkt${w.id === schritt ? " aktiv" : ""}`}>
            {w.id === schritt ? (
              <span aria-current="step">
                <b>{w.nr}</b>
                <span className="weg-punkt-titel">{w.titel}</span>
              </span>
            ) : (
              <Link href={w.href} title={`Schritt ${w.nr}: ${w.titel}`}>
                <b>{w.nr}</b>
                <span className="weg-punkt-titel">{w.titel}</span>
              </Link>
            )}
          </li>
        ))}
      </ol>
      <div className="weg-zeile">
        <p>
          <strong>Schritt {s.nr} von {KAUFWEG.length}:</strong> {s.satz}
        </p>
        {weiter ? (
          <Link href={weiter.href} className="weg-weiter">
            Weiter: {weiter.nr} · {weiter.titel} <ArrowRight size={14} aria-hidden />
          </Link>
        ) : (
          <Link href="/aufbau" className="weg-weiter">
            Zum Cockpit <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>
      <details className="weg-achten">
        <summary>Worauf du in diesem Schritt achten musst</summary>
        <ul>
          {s.achten.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
