"use client";

// Wischen über den Inhalt = nächster/voriger Reiter (01.10.2026, dritte
// Fassung: „etwas langsamer, smooth" + Leiste gekoppelt). Der Inhalt folgt
// dem Finger, der Nachbar-Reiter gleitet daneben herein, beim Loslassen
// gleitet er zu Ende (oder zurück). Erst DANN wird navigiert — die Adresse
// zieht mit, „Zurück" im Browser bleibt heil. Die Entscheidung steckt in
// lib/wischen.ts.
//
// Flüssig, weil beim Ziehen KEIN React-Render je Fingerbewegung läuft: Der
// Versatz wird direkt ins `transform` des Gleisels geschrieben (Ref); React
// rendert nur beim Anfang des Zugs, beim Loslassen und beim Abschluss.
//
// Gekoppelt mit der Glas-Leiste: Sobald das Gleiten zum Ziel beginnt, meldet
// `WISCH_EREIGNIS` den Ziel-Link — GlassLeiste markiert ihn sofort und rückt
// ihn in die Mitte, statt auf die Antwort des Servers zu warten.
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

/** Dauer des Gleitens nach dem Loslassen. Bewusst über der 300-ms-Regel für
 *  Bedienelemente: Hier bewegt sich eine ganze Seite, und der Betreiber fand
 *  260 ms ruckartig — 380 ms mit weichem Austritt las sich am Gerät ruhiger. */
export const GLEIT_MS = 380;
/** Weiche Austrittskurve: zügig los, lang ausrollend — kein Anschlag am Ende. */
export const GLEIT_KURVE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Ereignis an `document`: `detail.href` ist der Link des Reiters, der jetzt gilt. */
export const WISCH_EREIGNIS = "myimmo:wisch";

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

function melde(href: string) {
  document.dispatchEvent(new CustomEvent(WISCH_EREIGNIS, { detail: { href } }));
}

type Zug = { x: number; y: number; t: number; achse: "x" | "y" | null };

export default function WischReiter({ reiter, aktuell }: { reiter: Reiter[]; aktuell: number }) {
  const router = useRouter();
  const wurzel = useRef<HTMLDivElement>(null);
  const gleis = useRef<HTMLDivElement>(null);
  const zug = useRef<Zug | null>(null);
  // Der Reiter, der gerade in der Fläche liegt. Nach einem Wisch steht er
  // schon auf dem Ziel, BEVOR der Server die Seite neu liefert — so springt
  // beim Eintreffen nichts.
  const [angezeigt, setAngezeigt] = useState(aktuell);
  const [vonServer, setVonServer] = useState(aktuell);
  const [phase, setPhase] = useState<"ruhe" | "zieht" | "gleitet">("ruhe");
  // Beim Ziehen: welcher Nachbar sichtbar ist (Vorzeichen des Zugs). Beim
  // Gleiten: der Ziel-Versatz in px (React setzt ihn, die Transition läuft).
  const [zugSeite, setZugSeite] = useState<-1 | 0 | 1>(0);
  const [gleitVersatz, setGleitVersatz] = useState(0);
  const [gleitZiel, setGleitZiel] = useState<number | null>(null);

  // Der Server hat einen anderen Reiter geliefert (Tipp auf die Leiste,
  // „Zurück" im Browser): übernehmen, ohne Bewegung.
  if (vonServer !== aktuell) {
    setVonServer(aktuell);
    setAngezeigt(aktuell);
    setPhase("ruhe");
    setZugSeite(0);
    setGleitVersatz(0);
    setGleitZiel(null);
  }

  // Rückfall, falls `transitionend` ausbleibt (Tab im Hintergrund): Das
  // Gleiten darf nie hängen bleiben.
  useEffect(() => {
    if (phase !== "gleitet") return;
    const t = window.setTimeout(() => abschliessen(gleitZiel ?? angezeigt), GLEIT_MS + 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gleitZiel]);

  const breite = () => wurzel.current?.clientWidth || window.innerWidth;
  const richtungVon = (v: number): -1 | 0 | 1 => (v < 0 ? 1 : v > 0 ? -1 : 0);
  const aktuellerVersatz = () => {
    const m = gleis.current ? new DOMMatrixReadOnly(getComputedStyle(gleis.current).transform) : null;
    return m ? m.m41 : 0;
  };

  function abschliessen(ziel: number) {
    setPhase("ruhe");
    setZugSeite(0);
    setGleitVersatz(0);
    setGleitZiel(null);
    if (ziel !== angezeigt) {
      setAngezeigt(ziel);
      router.push(reiter[ziel].href, { scroll: false });
    }
  }

  // Zum Nachbarn (volle Breite) oder zurück auf 0 gleiten — über die
  // CSS-Transition; `onTransitionEnd` schließt ab. Die Leiste erfährt das
  // Ziel sofort, nicht erst mit der Serverantwort.
  function gleiten(ziel: number | null, richtung: -1 | 0 | 1) {
    const zielIndex = ziel ?? angezeigt;
    melde(reiter[zielIndex].href);
    if (reduzierteBewegung()) {
      abschliessen(zielIndex);
      return;
    }
    const zielVersatz = ziel === null ? 0 : -richtung * breite();
    if (Math.abs(zielVersatz - aktuellerVersatz()) < 1) {
      abschliessen(zielIndex); // kein Weg → keine Transition, kein transitionend
      return;
    }
    setPhase("gleitet");
    setGleitZiel(zielIndex);
    setGleitVersatz(zielVersatz);
  }

  // Beim Ziehen bestimmt der Finger das transform direkt; React setzt es nur
  // in Ruhe (0) und beim Gleiten (Ziel) — sonst würde jeder Render den
  // Finger-Versatz überschreiben.
  const gleisStil: CSSProperties = {
    position: "relative",
    willChange: "transform",
    transition: phase === "gleitet" ? `transform ${GLEIT_MS}ms ${GLEIT_KURVE}` : "none",
    ...(phase === "zieht" ? {} : { transform: `translate3d(${phase === "gleitet" ? gleitVersatz : 0}px, 0, 0)` }),
  };

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
        const seite = richtungVon(dx);
        const ziel = zielReiter(reiter, angezeigt, seite);
        if (phase !== "zieht") setPhase("zieht");
        if (seite !== 0 && seite !== zugSeite) setZugSeite(seite);
        if (gleis.current) gleis.current.style.transform = `translate3d(${wischVersatz(dx, ziel !== null)}px, 0, 0)`;
      }}
      onTouchEnd={(e) => {
        const z = zug.current;
        zug.current = null;
        if (!z) return;
        e.stopPropagation();
        if (z.achse !== "x") return;
        const p = e.changedTouches[0];
        const dx = p.clientX - z.x;
        const richtung = wischRichtung({ dx, dy: p.clientY - z.y, ms: e.timeStamp - z.t, startX: z.x, breite: breite() });
        gleiten(zielReiter(reiter.map((_, i) => i), angezeigt, richtung), richtung);
      }}
      onTouchCancel={() => {
        zug.current = null;
        if (phase === "zieht") gleiten(null, 0);
      }}
    >
      <div
        ref={gleis}
        style={gleisStil}
        onTransitionEnd={(e) => {
          if (e.target !== e.currentTarget || phase !== "gleitet") return;
          abschliessen(gleitZiel ?? angezeigt);
        }}
      >
        {reiter.map((r, i) => {
          const rel = i - angezeigt;
          // Nur der Nachbar in Zugrichtung wird gezeigt; alle anderen bleiben
          // unsichtbar und für Tastatur/Vorleser gesperrt (`inert`).
          // `display: none` statt `visibility: hidden` (06.10.2026): Unsichtbare,
          // aber absolut positionierte Reiter bestimmten die Scrollhöhe mit —
          // unter kurzen Reitern lagen rund 1.000 px leere Fläche.
          const seite = phase === "gleitet" ? richtungVon(gleitVersatz) : zugSeite;
          const nachbar = Math.abs(rel) === 1 && phase !== "ruhe" && rel === seite;
          const stil: CSSProperties | undefined = rel === 0
            ? undefined
            : { position: "absolute", top: 0, left: `${rel * 100}%`, width: "100%", display: nachbar ? undefined : "none" };
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
