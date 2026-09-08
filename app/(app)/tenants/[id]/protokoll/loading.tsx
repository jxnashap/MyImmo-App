import { TopbarSkeleton, FormSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="fade-up">
      <TopbarSkeleton />
      <FormSkeleton felder={8} spalten={2} />
    </div>
  );
}
