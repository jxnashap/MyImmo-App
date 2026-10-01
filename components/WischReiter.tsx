"use client";

// Wischen über den Inhalt = nächster/voriger Reiter (01.10.2026, zweite
// Fassung: „viel flüssiger"). Der Inhalt folgt dem Finger, der Nachbar-Reiter
// gleitet daneben herein, beim Loslassen gleitet er zu Ende (oder zurück).
// Erst DANN wird navigiert — die Adresse zieht mit, „Zurück" im Browser bleibt
// heil. Die Entscheidung steckt in lib/wischen.ts.
//
// Jeder Reiter bringt seinen Inhalt mit (`inhalt`). Fehlt er — der Vermieter-
// Bereich lädt nur den aktiven Reiter —, gleitet ein Platzhalter mit dem Namen
// herein, bis der Server die Seite liefert.
//
// Kein Wisch, wenn er …
//   - in einem Eingabefeld beginnt (Text markieren, Cursor setzen),
//   - in einem waagerecht scrollbaren Bereich beginnt (Tabellen, Leisten,
//     Diagramme) — der braucht die Geste selbst,
//   - in einem Bereich mit `data-kein-wischen` beginnt,
//   - am Bildschirmrand beginnt (System-Zurück-Geste),
//   - zuerst senkrecht läuft (dann scrollt der Browser; `touch-action: pan-y`).
// Verschachtelt (Ansicht Mieter im Vermieter-Portal): Der innere Bereich
// nimmt die Geste und hält sie an, der äußere sieht sie nicht.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RAND_PX, wischAchse, wischRichtung, wischVersatz, zielReiter } from "@/lib/wischen";

export type Reiter = { href: string; label: string; inhalt?: ReactNode };

/** Dauer des Gleitens nach dem Loslassen — UI unter 300 ms, Austritts-Kurve. */
export const GLEIT_MS = 260;

function blockiert(ziel: EventTarget | null, wurzel: HTMLElement): boolean {
  let el = ziel instanceof Element ? ziel : null;
  while (el && el !== wurzel) {
    if (el.matches("input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-kein-wischen]")) return true;
    if (el instanceof HTMLElement) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
    }
    el = el.parentElement;
  }
  return false;
}

function reduzierteBewegung(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Zug = { x: number; y: number; t: number; achse: "x" | "y" | null };

export default function WischReiter({ reiter, aktuell }: { reiter: Reiter[]; aktuell: number }) {
  const router = useRouter();
  const wurzel = useRef<HTMLDivElement>(null);
  const zug = useRef<Zug | null>(null);
  // Der Reiter, der gerade in der Fläche liegt. Nach einem Wisch steht er
  // schon auf dem Ziel, BEVOR der Server die Seite neu liefert — so springt
  // beim Eintreffen nichts.
  const [angezeigt, setAngezeigt] = useState(aktuell);
  const [vonServer, setVonServer] = useState(aktuell);
  const [versatz, setVersatz] = useState(0);
  const [phase, setPhase] = useState<"ruhe" | "zieht" | "gleitet">("ruhe");
  const [gleitZiel, setGleitZiel] = useState<number | null>(null);

  // Der Server hat einen anderen Reiter geliefert (Tipp auf die Leiste,
  // „Zurück" im Browser): übernehmen, ohne Bewegung.
  if (vonServer !== aktuell) {
    setVonServer(aktuell);
    setAngezeigt(aktuell);
    setVersatz(0);
    setPhase("ruhe");
    setGleitZiel(null);
  }

  // Rückfall, falls `transitionend` ausbleibt (Tab im Hintergrund, Transition
  // ohne Weg): Das Gleiten darf nie hängen bleiben.
  useEffect(() => {
    if (phase !== "gleitet") return;
    const t = window.setTimeout(() => abschliessen(gleitZiel ?? angezeigt), GLEIT_MS + 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gleitZiel]);

  const breite = () => wurzel.current?.clientWidth || window.innerWidth;
  const richtungVon = (v: number): -1 | 0 | 1 => (v < 0 ? 1 : v > 0 ? -1 : 0);

  function abschliessen(ziel: number) {
    setPhase("ruhe");
    setVersatz(0);
    setGleitZiel(null);
    if (ziel !== angezeigt) {
      setAngezeigt(ziel);
      router.push(reiter[ziel].href, { scroll: false });
    }
  }

  return (
    <div
      ref={wurzel}
      style={{ position: "relative", overflowX: "clip", overflowY: "visible", touchAction: "pan-y" }}
      onTouchStart={(e) => {
        if (e.touches.length !== 1 || phase === "gleitet" || !wurzel.current || blockiert(e.target, wurzel.current)) {
          zug.current = null;
          return;
        }
        const p = e.touches[0];
        // Am Rand nicht einmal anfangen — iOS/Android ziehen dort selbst.
        if (p.clientX < RAND_PX || p.clientX > window.innerWidth - RAND_PX) {
          zug.current = null;
          return;
        }
        e.stopPropagation();
        zug.current = { x: p.clientX, y: p.clientY, t: e.timeStamp, achse: null };
      }}
      onTouchMove={(e) => {
        const z = zug.current;
        if (!z) return;
        e.stopPropagation();
        const p = e.touches[0];
        const dx = p.clientX - z.x;
        const dy = p.clientY - z.y;
        if (z.achse === null) z.achse = wischAchse(dx, dy);
        if (z.achse !== "x") return;
        const ziel = zielReiter(reiter, angezeigt, richtungVon(dx));
        if (phase !== "zieht") setPhase("zieht");
        setVersatz(wischVersatz(dx, ziel !== null));
      }}
      onTouchEnd={(e) => {
        const z = zug.current;
        zug.current = null;
        if (!z) return;
        e.stopPropagation();
        if (z.achse !== "x") return;
        const p = e.changedTouches[0];
        const dx = p.clientX - z.x;
        const b = breite();
        const richtung = wischRichtung({ dx, dy: p.clientY - z.y, ms: e.timeStamp - z.t, startX: z.x, breite: b });
        const ziel = zielReiter(reiter.map((_, i) => i), angezeigt, richtung);
        if (reduzierteBewegung()) {
          abschliessen(ziel ?? angezeigt);
          return;
        }
        // Zu Ende gleiten: zum Nachbarn (volle Breite) oder zurück auf 0.
        // Beides über die CSS-Transition; `onTransitionEnd` schließt ab.
        const zielVersatz = ziel === null ? 0 : -richtung * b;
        if (zielVersatz === versatz) {
          abschliessen(ziel ?? angezeigt); // kein Weg → keine Transition, kein transitionend
          return;
        }
        setPhase("gleitet");
        setGleitZiel(ziel ?? angezeigt);
        setVersatz(zielVersatz);
      }}
      onTouchCancel={() => {
        zug.current = null;
        if (phase === "zieht") {
          setPhase("gleitet");
          setGleitZiel(angezeigt);
          setVersatz(0);
        }
      }}
    >
      <div
        style={{
          position: "relative",
          transform: `translate3d(${versatz}px, 0, 0)`,
          transition: phase === "gleitet" ? `transform ${GLEIT_MS}ms var(--ease-out-stark)` : "none",
          willChange: phase === "ruhe" ? undefined : "transform",
        }}
        onTransitionEnd={(e) => {
          if (e.target !== e.currentTarget || phase !== "gleitet") return;
          abschliessen(gleitZiel ?? angezeigt);
        }}
      >
        {reiter.map((r, i) => {
          const rel = i - angezeigt;
          // Nur der Nachbar in Zugrichtung wird gezeigt; alle anderen bleiben
          // unsichtbar und für Tastatur/Vorleser gesperrt (`inert`).
          const nachbar = Math.abs(rel) === 1 && phase !== "ruhe" && Math.sign(rel) === -Math.sign(versatz);
          const stil: CSSProperties | undefined = rel === 0
            ? undefined
            : { position: "absolute", top: 0, left: `${rel * 100}%`, width: "100%", visibility: nachbar ? "visible" : "hidden" };
          return (
            <div key={r.href} style={stil} inert={rel !== 0} aria-hidden={rel !== 0}>
              {r.inhalt ?? (
                <div className="section">
                  <div className="section-body" style={{ textAlign: "center", padding: "36px 20px", color: "var(--muted)", fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>{r.label}</div>
                    <div style={{ marginTop: 6, fontSize: 12 }}>wird geladen …</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
