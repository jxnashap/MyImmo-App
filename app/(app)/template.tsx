// Seitenübergang für ALLE Routen.
//
// `template.tsx` ist ein Next-Bordmittel: Anders als `layout.tsx` wird es bei
// jeder Navigation NEU gemountet. Genau das braucht eine Enter-Animation — sie
// startet dadurch bei jedem Seitenwechsel von vorn, ohne dass irgendwo eine
// Route-Change-Erkennung nachgebaut werden müsste.
//
// Bewusst NICHT framer-motion: 63 der 65 Seiten dieser App sind Server-
// Komponenten. Ein `<motion.div>` um die Seite würde jede einzelne davon zur
// Client-Komponente machen — Server-Rendering weg, Bundle deutlich größer.
// Dazu kommt, dass `AnimatePresence` im App Router keine verlässlichen
// Exit-Animationen liefert, weil die alte Seite unmountet, bevor animiert
// werden kann. Eine CSS-Klasse leistet hier dasselbe zum Nulltarif und
// verändert an der Architektur nichts.
//
// Die Animation ist absichtlich nur ein Aufblenden mit minimalem Versatz:
// Viele Seiten tragen bereits `.fade-up` (8px). Beides zusammen ergibt die
// ~12px, die sich weich anfühlen, ohne dass die Seite sichtbar springt.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
