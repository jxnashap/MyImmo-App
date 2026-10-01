"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Portfolio-Karte: alle Objekte mit Koordinaten auf einer CARTO-Basemap,
// die dem App-Theme folgt (hell: voyager, dunkel: dark_all). Marker in Gold,
// Popup mit Name/Adresse/Wert + Link zur Objektseite.
//
// Seit 01.10.2026 entsteht die Karte EINMAL; ändert sich die Objektliste (die
// Verortung im Hintergrund liefert Marker nach), wird nur die Marker-Ebene
// neu gezeichnet. Vorher baute jede Änderung die ganze Karte neu auf —
// mit Nachladen erschiene sie bei jedem neuen Marker flackernd und neu gezoomt.

export type KartenObjekt = {
  id: string;
  name: string;
  adresse: string;
  typ: string | null;
  wert: number | null;
  lat: number;
  lng: number;
};

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");

type Leaflet = typeof import("leaflet");

export default function PortfolioKarte({ objekte, hoehe }: { objekte: KartenObjekt[]; hoehe?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const karte = useRef<{ L: Leaflet; map: import("leaflet").Map; ebene: import("leaflet").LayerGroup } | null>(null);
  // Neueste Objektliste für den asynchronen Aufbau — im Effekt gesetzt, nicht
  // während des Renderns (React-Regel; der Aufbau liest sie erst danach).
  const aktuelle = useRef(objekte);
  useEffect(() => {
    aktuelle.current = objekte;
  });

  // Karte einmal aufbauen.
  useEffect(() => {
    let aktiv = true;
    let aufraeumen: (() => void) | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!aktiv || !ref.current) return;

      const map = L.map(ref.current, {
        center: [51.16, 10.45], // Mitte Deutschlands
        zoom: 6,
        scrollWheelZoom: true,
        attributionControl: true,
      });

      // Basemap folgt dem App-Theme: hell (voyager, dezente Beschriftung) im
      // Frosted-Paper-Hellmodus, dark_all im Dunkelmodus. Vorher lag immer die
      // dunkle Karte im hellen UI — das las sich wie ein Renderausfall.
      const tileFuerTheme = (dunkel: boolean) =>
        `https://{s}.basemaps.cartocdn.com/${dunkel ? "dark_all" : "rastertiles/voyager"}/{z}/{x}/{y}{r}.png`;
      const istDunkel = () => {
        const t = document.documentElement.getAttribute("data-theme");
        if (t === "dark") return true;
        if (t === "light") return false;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      };
      const tiles = L.tileLayer(tileFuerTheme(istDunkel()), {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      // Auf den Hell-/Dunkel-Umschalter reagieren (data-theme am <html>)
      const beobachter = new MutationObserver(() => {
        const neu = tileFuerTheme(istDunkel());
        if ((tiles as unknown as { _url?: string })._url !== neu) tiles.setUrl(neu);
      });
      beobachter.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      const ebene = L.layerGroup().addTo(map);
      karte.current = { L, map, ebene };
      zeichneMarker(karte.current, aktuelle.current, true);
      aufraeumen = () => {
        beobachter.disconnect();
        map.remove();
        karte.current = null;
      };
    })();

    return () => {
      aktiv = false;
      aufraeumen?.();
    };
  }, []);

  // Marker nachziehen, wenn Objekte dazukommen — ohne die Karte neu zu bauen.
  const schluessel = objekte.map((o) => o.id + o.lat + o.lng).join("|");
  useEffect(() => {
    if (karte.current) zeichneMarker(karte.current, aktuelle.current, false);
  }, [schluessel]);

  return (
    <div
      ref={ref}
      style={{
        height: hoehe ?? "min(72vh, 720px)",
        minHeight: 380,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--line)",
        background: "var(--bg3)",
      }}
    />
  );
}

function zeichneMarker(
  k: { L: Leaflet; map: import("leaflet").Map; ebene: import("leaflet").LayerGroup },
  objekte: KartenObjekt[],
  erstesMal: boolean,
) {
  const { L, map, ebene } = k;
  ebene.clearLayers();
  const bounds: [number, number][] = [];
  for (const o of objekte) {
    bounds.push([o.lat, o.lng]);
    L.circleMarker([o.lat, o.lng], {
      radius: 9,
      color: "#d4af5a",
      weight: 2,
      fillColor: "#d4af5a",
      fillOpacity: 0.55,
    })
      .bindPopup(
        `<div style="font-family:inherit;min-width:180px">
           <div style="font-weight:700;font-size:13px;margin-bottom:2px">${escapeHtml(o.name)}</div>
           <div style="font-size:11.5px;opacity:.75">${escapeHtml(o.adresse)}</div>
           ${o.typ ? `<div style="font-size:11px;opacity:.6;margin-top:2px">${escapeHtml(o.typ)}</div>` : ""}
           ${o.wert ? `<div style="font-size:12.5px;font-weight:700;color:var(--gold);margin-top:5px">${eur(o.wert)}</div>` : ""}
           <a href="/properties/${encodeURIComponent(o.id)}" style="display:inline-block;margin-top:7px;font-size:11.5px;color:var(--gold)">Zum Objekt →</a>
         </div>`,
      )
      .addTo(ebene);
  }
  // Ausschnitt anpassen — beim Nachladen weich, damit der neue Marker ins Bild gleitet.
  const animiert = !erstesMal && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (bounds.length === 1) {
    map.setView(bounds[0], 13, { animate: animiert });
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [45, 45], maxZoom: 13, animate: animiert });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
