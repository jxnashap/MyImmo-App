import { redirect } from "next/navigation";

// Verwaiste Seite (Gesamtprüfung C49): Verbrauch wird seit dem Umbau der Listen im Dialog auf
// /verbrauch bearbeitet (components/lists/VerbrauchListe.tsx). Kein Link führte mehr hierher —
// alte Lesezeichen landen jetzt auf der Liste statt auf einem zweiten, ungepflegten Formular.
export default function VerbrauchEditAlt() {
  redirect("/verbrauch");
}
