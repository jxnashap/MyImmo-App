import { Skeleton, CardSkeleton } from "@/components/Skeleton";

// Kein Topbar-Skelett: Die Seite läuft ohne App-Rahmen (eigener Auth-Bildschirm).
// `getUser()` geht über das Netz zu Supabase — ohne diesen Zustand sähe der
// Nutzer nach dem Klick auf den Reset-Link eine leere Fläche.
export default function Loading() {
  return (
    <div className="fade-up" style={{ maxWidth: 420, margin: "0 auto", padding: "56px 20px" }}>
      <Skeleton w={140} h={30} style={{ margin: "0 auto 28px", display: "block" }} />
      <CardSkeleton rows={3} />
    </div>
  );
}
