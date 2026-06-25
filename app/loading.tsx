import { TopbarSkeleton, KpiGridSkeleton, CardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="fade-up">
      <TopbarSkeleton />
      <KpiGridSkeleton n={4} />
      <div className="grid-2">
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
      </div>
    </div>
  );
}
