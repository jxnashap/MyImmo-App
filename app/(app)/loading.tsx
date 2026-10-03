import { TopbarSkeleton, KpiGridSkeleton, CardSkeleton, ChartSkeleton } from "@/components/Skeleton";

// Spiegelt das Dashboard (03.10.2026): fünf Kennzahlen mit Verlaufslinie, darunter
// `.dash-haupt` — links zwei Diagramme, rechts Neuigkeiten und Aufgaben. Vorher
// standen hier vier Kacheln und ein 50:50-Raster; beim Fertigladen sprang alles.
export default function Loading() {
  return (
    <div className="fade-up">
      <TopbarSkeleton />
      <KpiGridSkeleton n={5} verlauf />
      <div className="dash-haupt">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <CardSkeleton rows={2} />
          <CardSkeleton rows={5} />
        </div>
      </div>
    </div>
  );
}
