// Binnennavigation für lange Seiten: eine horizontal scrollbare Chip-Reihe,
// die unter der mobilen Kopfleiste klebt und zu den Abschnitten der Seite
// springt. Nur unter 860px sichtbar (CSS) — auf dem Desktop überblickt man die
// Seite ohnehin, und die Chips wären dort nur Rauschen.
//
// Die Ziele brauchen `id` UND `data-anker` (letzteres setzt scroll-margin-top,
// damit der Abschnitt nicht unter der Kopfleiste landet). Abschnitte, die es
// auf der konkreten Seite nicht gibt, werden vom Aufrufer herausgefiltert —
// eine Marke, die ins Leere springt, ist schlimmer als keine.

export type Sprungmarke = { id: string; label: string };

export default function Sprungmarken({ marken }: { marken: Sprungmarke[] }) {
  if (marken.length < 3) return null; // lohnt erst ab ein paar Abschnitten
  return (
    <nav className="sprungmarken" aria-label="Abschnitte dieser Seite">
      {marken.map((m) => (
        <a key={m.id} href={`#${m.id}`}>
          {m.label}
        </a>
      ))}
    </nav>
  );
}
