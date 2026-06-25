import { TopbarSkeleton, CardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="fade-up">
      <TopbarSkeleton />
      <CardSkeleton rows={6} />
    </div>
  );
}
