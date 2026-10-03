import { TopbarSkeleton, KpiGridSkeleton, CardSkeleton } from "@/components/Skeleton";

// Das Cockpit holt vier Quellen parallel, zwei davon fremde APIs mit eigenem
// Zeitlimit — hier ist ein Lade-Zustand nicht Kosmetik.
export default function Loading() {
  return (
    <div className="fade-up">
      <TopbarSkeleton />
      <KpiGridSkeleton n={5} />
      <CardSkeleton rows={6} />
      <CardSkeleton rows={4} />
    </div>
  );
}
