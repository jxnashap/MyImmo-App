"use client";

// Portfolio-Karte mit Verortung im Hintergrund (01.10.2026). Die Seite rendert
// sofort mit allem, was schon Koordinaten hat; offene Objekte schickt der
// Browser EINZELN an /api/karte/verorten, mit der Nominatim-Pause dazwischen.
// Jeder Treffer erscheint sofort als Marker. Meldet der Server „gedrosselt",
// hört die Schleife für diesen Aufruf auf — kein Nachbohren.
//
// Unter der Karte steht ehrlich, was NICHT drauf ist und warum: keine Adresse,
// Adresse nicht gefunden (mit Link zum Korrigieren), oder Suche pausiert.

import Link from "next/link";
import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import PortfolioKarte, { type KartenObjekt } from "@/components/PortfolioKarte";
import { GEOCODE_PAUSE_MS } from "@/lib/geocode";

export type OffenesObjekt = Omit<KartenObjekt, "lat" | "lng">;
export type FehlendesObjekt = { id: string; name: string };

export default function KarteVerortung({
  verortet,
  offen,
  nichtGefunden,
  ohneAdresse,
  pausiert,
}: {
  verortet: KartenObjekt[];
  offen: OffenesObjekt[];
  nichtGefunden: FehlendesObjekt[];
  ohneAdresse: FehlendesObjekt[];
  /** Objekte, deren letzte Suche gedrosselt wurde und deren Pause noch läuft. */
  pausiert: FehlendesObjekt[];
}) {
  const [objekte, setObjekte] = useState(verortet);
  const [warteschlange, setWarteschlange] = useState(offen);
  const [neuNichtGefunden, setNeuNichtGefunden] = useState<FehlendesObjekt[]>([]);
  const [gedrosselt, setGedrosselt] = useState(false);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      for (let i = 0; i < offen.length && aktiv; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, GEOCODE_PAUSE_MS));
        if (!aktiv) return;
        const o = offen[i];
        let art = "gedrosselt";
        let punkt: { lat: number; lng: number } | null = null;
        try {
          const res = await fetch("/api/karte/verorten", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: o.id }),
          });
          const j = (await res.json()) as { art?: string; lat?: number; lng?: number };
          art = res.ok ? (j.art ?? "gedrosselt") : "gedrosselt";
          if (art === "treffer" && typeof j.lat === "number" && typeof j.lng === "number") punkt = { lat: j.lat, lng: j.lng };
        } catch {
          art = "gedrosselt";
        }
        if (!aktiv) return;
        setWarteschlange((w) => w.filter((x) => x.id !== o.id));
        if (punkt) setObjekte((alt) => [...alt, { ...o, ...punkt }]);
        else if (art === "leer") setNeuNichtGefunden((n) => [...n, { id: o.id, name: o.name }]);
        else if (art === "gedrosselt") {
          setGedrosselt(true);
          return;
        }
      }
    })();
    return () => {
      aktiv = false;
    };
    // Nur beim Laden der Seite — die Liste kommt vom Server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alleNichtGefunden = [...nichtGefunden, ...neuNichtGefunden];
  const wartend = gedrosselt ? [...warteschlange, ...pausiert] : pausiert;
  const sucht = !gedrosselt && warteschlange.length > 0;

  return (
    <>
      <PortfolioKarte objekte={objekte} />
      <div aria-live="polite" style={{ display: "grid", gap: 6, marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
        {sucht && (
          <div>
            Suche {warteschlange.length === 1 ? "1 weiteren Standort" : `${warteschlange.length} weitere Standorte`} …
            Marker erscheinen nacheinander (höchstens eine Adresssuche pro Sekunde).
          </div>
        )}
        {alleNichtGefunden.length > 0 && (
          <Zeile>
            Adresse nicht gefunden: {verlinkt(alleNichtGefunden)}. Prüfe Straße, Hausnummer und PLZ — nach dem
            Speichern wird neu gesucht.
          </Zeile>
        )}
        {ohneAdresse.length > 0 && (
          <Zeile>Ohne Adresse: {verlinkt(ohneAdresse)} — trage sie in den Objektdaten nach.</Zeile>
        )}
        {wartend.length > 0 && (
          <Zeile>
            Der Kartendienst bremst gerade ({wartend.length} {wartend.length === 1 ? "Objekt" : "Objekte"} offen). Die
            Suche läuft beim nächsten Öffnen der Karte weiter, spätestens nach einigen Stunden.
          </Zeile>
        )}
      </div>
    </>
  );
}

function Zeile({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

function verlinkt(liste: FehlendesObjekt[]) {
  return liste.map((o, i) => (
    <span key={o.id}>
      {i > 0 && ", "}
      <Link href={`/properties/${o.id}/edit`} style={{ color: "var(--gold)" }}>{o.name}</Link>
    </span>
  ));
}
