// Zusammengelegt: Einnahmen leben jetzt im Reiter „Ein- & Ausgaben".
import { redirect } from "next/navigation";

export default function EinnahmenRedirect() {
  redirect("/cashflow?typ=einnahme");
}
