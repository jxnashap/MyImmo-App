import { TopbarSkeleton, KpiGridSkeleton, CardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="fade-up">
      <TopbarSkeleton />
      <KpiGridSkeleton n={3} />
      <CardSkeleton rows={5} />
    </div>
  );
}
