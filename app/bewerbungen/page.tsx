// Bewerbungen leben jetzt im Mieterportal (Tab "Bewerbungen") —
// alte Route bleibt als Weiterleitung erhalten.
import { redirect } from "next/navigation";

export default function BewerbungenPage() {
  redirect("/anliegen?tab=bewerbungen");
}
