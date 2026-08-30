import NichtGefunden from "@/components/NichtGefunden";

export const metadata = {
  title: "Seite nicht gefunden — MyImmo",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NichtGefunden />;
}
