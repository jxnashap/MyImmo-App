"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Archiv = zentrale Dokumentenablage. Dateien werden (wie bei Notizen/Rechnungen)
// inline als base64 in der Tabelle `notizen` gespeichert; `kategorie` = Art,
// zusätzlich prop_id (Objekt) und mieter_id (Mieter) für die Filterung.

async function uid() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

const str = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  return v == null || v === "" ? null : String(v);
};

async function dateiFelder(fd: FormData) {
  const f = fd.get("datei");
  if (!f || typeof f === "string" || (f as File).size === 0) return {};
  const file = f as File;
  if (file.size > 8 * 1024 * 1024) throw new Error("Datei zu groß (max. 8 MB).");
  const mime = file.type || "application/octet-stream";
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return {
    datei_name: file.name || "Dokument",
    datei_type: mime,
    datei_size: file.size,
    datei_data: `data:${mime};base64,${base64}`,
  };
}

export async function createDokument(fd: FormData) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("notizen").insert({
    user_id: userId,
    prop_id: str(fd, "prop_id"),
    mieter_id: str(fd, "mieter_id"),
    titel: str(fd, "titel") ?? "Dokument",
    kategorie: str(fd, "kategorie") ?? "Sonstiges",
    inhalt: str(fd, "inhalt"),
    ...(await dateiFelder(fd)),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/archiv");
}

export async function updateDokument(id: string, fd: FormData) {
  const { supabase } = await uid();
  const datei = await dateiFelder(fd); // nur ersetzen, wenn neue Datei gewählt
  const { error } = await supabase
    .from("notizen")
    .update({
      prop_id: str(fd, "prop_id"),
      mieter_id: str(fd, "mieter_id"),
      titel: str(fd, "titel") ?? "Dokument",
      kategorie: str(fd, "kategorie") ?? "Sonstiges",
      inhalt: str(fd, "inhalt"),
      ...datei,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/archiv");
}

export async function deleteDokument(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("notizen").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/archiv");
}
