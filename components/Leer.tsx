import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Leerzustände (Woche 4, 08.09.2026, Feedback).
//
// WARUM DIESER BAUSTEIN
// Zwanzig Stellen der App zeigen etwas an, wenn eine Liste leer ist. Etwa die
// Hälfte war eine Sackgasse: ein Symbol und „Noch keine Daten". Für einen
// neuen Nutzer ist das die häufigste Ansicht der ganzen App — sie ist am
// Anfang ÜBERALL leer — und ausgerechnet dort stand nirgends, was der
// nächste Schritt ist.
//
// DIE ZWEI SORTEN LEER, die man nicht verwechseln darf
//   1. `art="nichts"` — es wurde noch nichts angelegt. Hier gehört hin, wozu
//      der Bereich gut ist und ein Knopf, der ihn füllt.
//   2. `art="filter"` — es GIBT Daten, nur passt keine zur Suche. Hier wäre
//      „Lege deine erste Buchung an" falsch und verwirrend: Der Nutzer hat
//      Buchungen, er sieht sie nur gerade nicht. Kein Anlegen-Knopf.
// Genau diese Verwechslung steckte an mehreren Stellen im Code.
//
// Der Text ist Pflicht, nicht optional. Ein Leerzustand ohne Satz ist wieder
// das, was hier abgeschafft werden sollte — deshalb ist `text` kein `?`.

export default function Leer({
  icon: Icon,
  titel,
  text,
  art = "nichts",
  aktion,
}: {
  icon: LucideIcon;
  /** Was fehlt — kurz, in der Sprache des Nutzers. */
  titel: string;
  /** Ein Satz: wozu der Bereich gut ist bzw. was jetzt zu tun ist. Pflicht. */
  text: string;
  art?: "nichts" | "filter";
  /** Nur bei `art="nichts"` sinnvoll — bei einer Filter-Leere gibt es nichts anzulegen. */
  aktion?: { href: string; label: string };
}) {
  return (
    <div className="empty">
      <Icon className="empty-icon" size={36} color="var(--faint)" aria-hidden />
      <h4>{titel}</h4>
      <p>{text}</p>
      {art === "nichts" && aktion && (
        <Link href={aktion.href} className="btn btn-ghost">
          {aktion.label}
        </Link>
      )}
    </div>
  );
}
