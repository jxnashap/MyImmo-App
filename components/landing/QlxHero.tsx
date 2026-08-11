import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import QlxParallax from "@/components/landing/QlxParallax";
import QlxVideo from "@/components/landing/QlxVideo";

// Cinematic-Hero je Reiter (Baukasten-Bauweise): Video-Bühne in Nachtblau mit
// Scrim, Kicker, großer Fraunces-Zeile und CTA.
//
// Codec-Wahl wie im Baukasten-Script, aber serverseitig: Statt im Browser zu
// raten, prüft die Komponente beim Rendern, welche Dateien wirklich in
// public/landing/hero/ liegen (<slug>.webm, <slug>.mp4, <slug>.jpg) und
// rendert nur existierende Quellen. Der Browser nimmt die erste, die er kann
// (webm/VP9 zuerst — kleiner; mp4/H.264 als Rückfall für Safari).
//
// Liegt (noch) kein Video, läuft der Hero mit Poster: erst <slug>.jpg, sonst
// der CSS-Verlauf. Die Seite ist damit nie kaputt — die Videos können nach
// und nach in public/landing/hero/ einziehen, ohne Codeänderung.

const HERO_DIR = path.join(process.cwd(), "public", "landing", "hero");

// Namensschema wie im Baukasten: <slug>-hd.* (~1080–1440p) und <slug>-4k.*;
// ein schlichtes <slug>.webm/.mp4 gilt als HD. Poster: <slug>.jpg.
function vorhandene(slug: string) {
  const da = (name: string) => {
    try {
      return fs.existsSync(path.join(HERO_DIR, name));
    } catch {
      return false;
    }
  };
  const pfad = (name: string) => `/landing/hero/${name}`;
  const hd = {
    webm: da(`${slug}-hd.webm`) ? pfad(`${slug}-hd.webm`) : da(`${slug}.webm`) ? pfad(`${slug}.webm`) : undefined,
    mp4: da(`${slug}-hd.mp4`) ? pfad(`${slug}-hd.mp4`) : da(`${slug}.mp4`) ? pfad(`${slug}.mp4`) : undefined,
  };
  const vierK = {
    webm: da(`${slug}-4k.webm`) ? pfad(`${slug}-4k.webm`) : undefined,
    mp4: da(`${slug}-4k.mp4`) ? pfad(`${slug}-4k.mp4`) : undefined,
  };
  return {
    hd,
    vierK: vierK.webm || vierK.mp4 ? vierK : undefined,
    poster: da(`${slug}.jpg`) ? pfad(`${slug}.jpg`) : undefined,
    hatVideo: !!(hd.webm || hd.mp4),
  };
}

export default function QlxHero({
  slug,
  kicker,
  titel,
  sub,
  kinder,
  kompakt = false,
}: {
  /** Dateiname unter public/landing/hero/ (ohne Endung), z. B. "start". */
  slug: string;
  kicker: string;
  titel: ReactNode;
  sub?: ReactNode;
  /** CTA-Zeile o. Ä. unterhalb des Subtexts. */
  kinder?: ReactNode;
  kompakt?: boolean;
}) {
  const q = vorhandene(slug);
  const poster = q.poster;

  return (
    <section className={`qlx-hero${kompakt ? " qlx-hero--kompakt" : ""}`}>
      <QlxParallax>
        {q.hatVideo ? (
          <QlxVideo hd={q.hd} vierK={q.vierK} poster={poster} />
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- Vollflächen-Hero, kein Layout-Shift
          <img src={poster} alt="" aria-hidden />
        ) : (
          <div className="qlx-hero-poster" aria-hidden />
        )}
      </QlxParallax>
      <div className="qlx-hero-scrim" aria-hidden />

      <div className="lp-inner qlx-hero-inhalt">
        <div className="qlx-kicker">{kicker}</div>
        <h1>{titel}</h1>
        {sub && <p className="qlx-hero-sub">{sub}</p>}
        {kinder}
      </div>
      <div className="qlx-scrollhint" aria-hidden />
    </section>
  );
}
