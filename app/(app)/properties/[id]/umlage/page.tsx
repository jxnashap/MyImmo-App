import { redirect } from "next/navigation";

// Der alte Nebenkosten-Verteiler (schrieb fertige Anteile je Mieter, ohne Gesamtkosten) ist seit
// NK Stufe 1 (07.10.2026) durch /properties/<id>/nebenkosten ersetzt. Die Adresse bleibt für alte
// Links und Lesezeichen erhalten.
export default async function UmlagePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/properties/${id}/nebenkosten`);
}
