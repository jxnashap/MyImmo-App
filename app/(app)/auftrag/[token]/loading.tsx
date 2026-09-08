import { PublicSkeleton } from "@/components/Skeleton";

// Öffentliche Token-Seite: kein App-Rahmen, deshalb keine Topbar.
export default function Loading() {
  return <PublicSkeleton />;
}
