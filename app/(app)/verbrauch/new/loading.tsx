import { TopbarSkeleton, FormSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="fade-up">
      <TopbarSkeleton />
      <FormSkeleton felder={6} spalten={2} />
    </div>
  );
}
