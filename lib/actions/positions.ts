"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addPosition(mieterId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const betragRaw = formData.get("betrag");
  const betrag =
    betragRaw == null || betragRaw === ""
      ? null
      : Number(String(betragRaw).replace(",", "."));

  const jahrRaw = formData.get("jahr");
  const jahr = jahrRaw ? Number(jahrRaw) : null;

  const { error } = await supabase.from("mieter_positionen").insert({
    user_id: user.id,
    mieter_id: mieterId,
    bezeichnung: String(formData.get("bezeichnung") ?? ""),
    betrag: betrag != null && Number.isNaN(betrag) ? null : betrag,
    jahr: jahr != null && Number.isNaN(jahr) ? null : jahr,
    umlageschluessel: (formData.get("umlageschluessel") as string) || null,
    umlagefaehig: formData.get("umlagefaehig") === "on",
    aufteilung: formData.get("aufteilung") === "zeit" ? "zeit" : "voll",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/tenants/${mieterId}/edit`);
}

// Mehrere per OCR erkannte Positionen auf einmal anlegen (umlagefähig, aktuelles Jahr).
export async function addPositionsBulk(mieterId: string, positionenJson: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let items: { name?: string; betrag?: number }[] = [];
  try { items = JSON.parse(positionenJson); } catch { items = []; }
  const jahr = new Date().getFullYear();

  const rows = items
    .filter((p) => p && p.name)
    .map((p) => ({
      user_id: user.id,
      mieter_id: mieterId,
      bezeichnung: String(p.name),
      betrag: typeof p.betrag === "number" && !Number.isNaN(p.betrag) ? p.betrag : null,
      jahr,
      umlagefaehig: true,
    }));
  if (rows.length === 0) return;

  const { error } = await supabase.from("mieter_positionen").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath(`/tenants/${mieterId}/edit`);
}

// Eine bestehende Position inline aktualisieren (Autosave im PositionsManager).
export async function updatePosition(
  id: string,
  mieterId: string,
  f: {
    bezeichnung: string;
    betrag: number | null;
    jahr: number | null;
    umlageschluessel: string | null;
    umlagefaehig: boolean;
    aufteilung?: string;
  },
): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("mieter_positionen")
    .update({
      bezeichnung: f.bezeichnung,
      betrag: f.betrag,
      jahr: f.jahr,
      umlageschluessel: f.umlageschluessel,
      umlagefaehig: f.umlagefaehig,
      aufteilung: f.aufteilung === "zeit" ? "zeit" : "voll",
    })
    .eq("id", id);

  revalidatePath(`/tenants/${mieterId}/edit`);
  return { ok: !error };
}

export async function deletePosition(id: string, mieterId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("mieter_positionen").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/tenants/${mieterId}/edit`);
}
