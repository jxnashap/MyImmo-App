"use client";

// Hero-Video-Ladelogik nach Baukasten (js/script.js): Das Video lädt verzögert
// und blendet erst bei `canplay` über dem Poster ein — kein schwarzes Loch,
// kein Ruckeln. Quelle nach Gerät und Sparmodus: ab 960 px Viewport (und ohne
// Data-Saver) die 4K-Fassung, sonst HD; WebM bevorzugt (AV1/VP9, deutlich
// kleiner), MP4/H.264 als Rückfall. prefers-reduced-motion lässt das Poster
// stehen.

import { useEffect, useRef } from "react";

export default function QlxVideo({
  hd,
  vierK,
  poster,
}: {
  /** HD-Quelle (~1080–1440p) ohne Endung, z. B. "/landing/hero/start-hd" */
  hd: { webm?: string; mp4?: string };
  vierK?: { webm?: string; mp4?: string };
  poster?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    type MitVerbindung = Navigator & { connection?: { saveData?: boolean } };
    const sparen = (navigator as MitVerbindung).connection?.saveData === true;
    const gross = window.innerWidth > 960 && !sparen;
    const quelle = (gross && vierK ? vierK : hd) ?? hd;

    const kannWebm =
      v.canPlayType('video/webm; codecs="av01.0.08M.08"') !== "" ||
      v.canPlayType('video/webm; codecs="vp9"') !== "";
    const src = kannWebm && quelle.webm ? quelle.webm : quelle.mp4 ?? quelle.webm;
    if (!src) return;

    const anspielen = () => {
      v.closest(".qlx-hero-medium")?.classList.add("qlx-playing");
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    v.addEventListener("canplay", anspielen, { once: true });
    v.src = src;
    v.load();
    return () => v.removeEventListener("canplay", anspielen);
  }, [hd, vierK]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
      aria-hidden
    />
  );
}
