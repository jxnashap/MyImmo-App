"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function num(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return v == null || v === "" ? null : String(v);
}

// Übernimmt ein Kalkulations-Ergebnis als Immobilie (+ optional Darlehen) ins Portfolio.
export async function saveKalkulationAlsImmobilie(fd: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = str(fd, "name") || "Kalkulierte Immobilie";
  const kaufpreis = num(fd, "kaufpreis");

  const { data: prop, error } = await supabase
    .from("properties")
    .insert({
      user_id: user.id,
      bezeichnung: name,
      typ: str(fd, "typ") || "Eigentumswohnung",
      kaufpreis,
      wert: num(fd, "wert") ?? kaufpreis,
      flaeche: num(fd, "flaeche"),
      miete: num(fd, "miete"),
      obj_status: "Vermietet",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const propId = (prop as { id: string }).id;

  if (str(fd, "mit_darlehen") === "1") {
    const darlehen = num(fd, "darlehen");
    const { error: kErr } = await supabase.from("kredite").insert({
      user_id: user.id,
      prop_id: propId,
      bezeichnung: `Finanzierung ${name}`,
      betrag: darlehen,
      restschuld: darlehen,
      zinssatz: num(fd, "zinssatz"),
      tilgungssatz: num(fd, "tilgungssatz"),
      monatsrate: num(fd, "monatsrate"),
    });
    if (kErr) throw new Error(kErr.message);
  }

  revalidatePath("/", "layout");
  redirect(`/properties/${propId}`);
}
