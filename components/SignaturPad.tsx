"use client";

// Zeichenfeld für eine handschriftliche Unterschrift (Maus/Finger/Stift).
// Liefert die Unterschrift als PNG-Data-URL (transparenter Hintergrund).
import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export default function SignaturPad({
  onChange,
  hoehe = 140,
}: {
  onChange: (dataUrl: string | null) => void;
  hoehe?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const [leer, setLeer] = useState(true);

  // Canvas in physischer Auflösung an die CSS-Breite anpassen (scharfe Linien).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    c.width = Math.round(w * dpr);
    c.height = Math.round(hoehe * dpr);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a1a66";
    }
  }, [hoehe]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const p = pos(e);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!zeichnet.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    const p = pos(e);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
    if (leer) setLeer(false);
  };
  const ende = () => {
    if (!zeichnet.current) return;
    zeichnet.current = false;
    const c = canvasRef.current;
    if (c) onChange(leerPruefen(c) ? null : c.toDataURL("image/png"));
  };
  const leerPruefen = (c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d");
    if (!ctx) return true;
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) return false;
    return true;
  };
  const loeschen = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    setLeer(true);
    onChange(null);
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%", height: hoehe, borderRadius: 10, touchAction: "none",
          border: "1px dashed var(--line)", background: "var(--bg3)", cursor: "crosshair",
        }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={ende}
        onPointerLeave={ende}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--faint)" }}>
          {leer ? "Hier mit Maus oder Finger unterschreiben" : "Unterschrift erfasst"}
        </span>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={loeschen}>
          <Eraser size={12} style={{ verticalAlign: "-2px" }} /> Löschen
        </button>
      </div>
    </div>
  );
}
