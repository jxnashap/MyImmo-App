// Alt-Adresse (21.10.2026): EIN Buchungsformular statt drei. Dieses Formular kannte weder Mietmonat
// noch Objekt-Übernahme aus dem Mieter; Links von außen (Lesezeichen) landen jetzt im gemeinsamen.
import { redirect } from "next/navigation";
import { sicheresZiel } from "@/lib/flash";

export default async function AltesBuchungsformular(props0: { searchParams: Promise<{ prop?: string; back?: string }> }) {
  const searchParams = await props0.searchParams;
  const q = new URLSearchParams({ typ: "einnahme" });
  if (searchParams.prop) q.set("prop", searchParams.prop);
  if (searchParams.back) q.set("back", sicheresZiel(searchParams.back, "/cashflow"));
  redirect(`/cashflow/neu?${q.toString()}`);
}
