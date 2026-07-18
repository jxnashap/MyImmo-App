import { ShieldCheck, TriangleAlert, XCircle, Info } from "lucide-react";
import type { MachbarkeitErgebnis, Ampel } from "@/lib/kauf/machbarkeit";

const FARBE: Record<Ampel, string> = {
  gruen: "var(--green)", gelb: "var(--amber)", rot: "var(--red)", grau: "var(--faint)",
};
const TEXT: Record<Ampel, string> = {
  gruen: "Sieht machbar aus", gelb: "Machbar — ein Punkt genauer prüfen", rot: "Genauer anschauen", grau: "Noch keine Einschätzung",
};

function AmpelIcon({ a, size = 16 }: { a: Ampel; size?: number }) {
  if (a === "gruen") return <ShieldCheck size={size} color={FARBE.gruen} />;
  if (a === "gelb") return <TriangleAlert size={size} color={FARBE.gelb} />;
  if (a === "rot") return <XCircle size={size} color={FARBE.rot} />;
  return <Info size={size} color={FARBE.grau} />;
}

export default function MachbarkeitKarte({ ergebnis }: { ergebnis: MachbarkeitErgebnis }) {
  const { gesamt, checks, hatDaten } = ergebnis;

  return (
    <div style={{ border: `1px solid ${FARBE[gesamt]}`, borderRadius: 10, padding: 14, marginBottom: 14, background: "var(--bg2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: hatDaten ? 12 : 6 }}>
        <AmpelIcon a={gesamt} size={18} />
        <strong style={{ fontSize: 13.5 }}>Machbarkeit: {TEXT[gesamt]}</strong>
      </div>

      {!hatDaten ? (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          Fülle im Schritt davor die Selbstauskunft aus (Einkommen, Ausgaben, Eigenkapital) — dann
          rechnen wir dir hier aus, ob die Rate tragbar ist, wie hoch der Beleihungsauslauf liegt und
          ob dein Eigenkapital reicht.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {checks.map((c) => (
            <div key={c.key} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <div style={{ marginTop: 1, flexShrink: 0 }}><AmpelIcon a={c.ampel} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                  <span style={{ color: FARBE[c.ampel], fontWeight: 600 }}>{c.wert}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{c.hinweis}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 12 }}>
        Marktübliche Faustwerte, keine Zusage und keine Finanzberatung — jede Bank rechnet anders.
      </div>
    </div>
  );
}
