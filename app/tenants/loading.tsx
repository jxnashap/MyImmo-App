import { TopbarSkeleton, CardGridSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="fade-up">
      <TopbarSkeleton />
      <CardGridSkeleton n={6} />
    </div>
  );
}
