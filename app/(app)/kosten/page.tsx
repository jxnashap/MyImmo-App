// Zusammengelegt: Kosten leben jetzt im Reiter „Ein- & Ausgaben".
import { redirect } from "next/navigation";

export default function KostenRedirect() {
  redirect("/cashflow?typ=ausgabe");
}
