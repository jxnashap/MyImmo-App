import { TopbarSkeleton, KpiGridSkeleton, CardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="fade-up">
      <TopbarSkeleton />
      <KpiGridSkeleton n={4} />
      <CardSkeleton rows={5} />
    </div>
  );
}
