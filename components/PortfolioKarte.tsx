"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Portfolio-Karte: alle Objekte mit Koordinaten auf einer dunklen
// Deutschland-Karte (CARTO dark, passend zum App-Design). Marker in Gold,
// Popup mit Name/Adresse/Wert + Link zur Objektseite.

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

export default function PortfolioKarte({ objekte }: { objekte: KartenObjekt[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let aktiv = true;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!aktiv || !ref.current) return;

      map = L.map(ref.current, {
        center: [51.16, 10.45], // Mitte Deutschlands
        zoom: 6,
        scrollWheelZoom: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];
      for (const o of objekte) {
        bounds.push([o.lat, o.lng]);
        const marker = L.circleMarker([o.lat, o.lng], {
          radius: 9,
          color: "#d4af5a",
          weight: 2,
          fillColor: "#d4af5a",
          fillOpacity: 0.55,
        }).addTo(map);
        marker.bindPopup(
          `<div style="font-family:inherit;min-width:180px">
             <div style="font-weight:700;font-size:13px;margin-bottom:2px">${escapeHtml(o.name)}</div>
             <div style="font-size:11.5px;opacity:.75">${escapeHtml(o.adresse)}</div>
             ${o.typ ? `<div style="font-size:11px;opacity:.6;margin-top:2px">${escapeHtml(o.typ)}</div>` : ""}
             ${o.wert ? `<div style="font-size:12.5px;font-weight:700;color:#d4af5a;margin-top:5px">${eur(o.wert)}</div>` : ""}
             <a href="/properties/${o.id}" style="display:inline-block;margin-top:7px;font-size:11.5px;color:#d4af5a">Zum Objekt →</a>
           </div>`,
        );
      }
      if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 13 });
      }
    })();

    return () => {
      aktiv = false;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(objekte.map((o) => o.id + o.lat + o.lng))]);

  return (
    <div
      ref={ref}
      style={{
        height: "min(72vh, 720px)",
        minHeight: 380,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--line)",
        background: "#0b0e13",
      }}
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
