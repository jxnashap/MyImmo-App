// Rückweg der Bank-Autorisierung (Enable Banking): tauscht den Code gegen
// eine Session und legt die verbundenen Konten an. Der state-Parameter
// stammt aus bank_auth_anfragen und bindet den Callback an den Nutzer.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/secure";
import {
  erstelleSession,
  accountUids,
  holeKontoDetails,
} from "@/lib/banking/enableBanking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const zurueck = (q: string) => NextResponse.redirect(new URL(`/banking?${q}`, req.url));

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const fehler = url.searchParams.get("error");
  if (fehler || !code || !state || !/^[0-9a-f-]{36}$/i.test(state)) {
    return zurueck("fehler=abgebrochen");
  }

  // state muss zu einer offenen Anfrage DIESES Nutzers gehören (RLS + Filter).
  const { data: anfrage } = await supabase
    .from("bank_auth_anfragen")
    .select("state,prop_id,aspsp_name,aspsp_country")
    .eq("state", state)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!anfrage) return zurueck("fehler=state");

  try {
    const session = await erstelleSession(code);
    const uids = accountUids(session);
    if (uids.length === 0) return zurueck("fehler=keine_konten");

    const gueltigBis =
      session.access?.valid_until ??
      new Date(Date.now() + 89 * 24 * 60 * 60 * 1000).toISOString();

    for (const uid of uids) {
      const details = await holeKontoDetails(uid);
      const iban = details?.account_id?.iban ?? null;
      await supabase.from("bankverbindungen").upsert(
        {
          user_id: user.id,
          prop_id: anfrage.prop_id,
          session_id: session.session_id,
          account_uid: uid,
          aspsp_name: session.aspsp?.name ?? anfrage.aspsp_name,
          aspsp_country: session.aspsp?.country ?? anfrage.aspsp_country,
          iban: iban ? encrypt(iban) : null,
          konto_name: details?.name ?? details?.product ?? null,
          waehrung: details?.currency ?? "EUR",
          gueltig_bis: gueltigBis,
        },
        { onConflict: "user_id,account_uid" },
      );
    }

    await supabase.from("bank_auth_anfragen").delete().eq("state", state).eq("user_id", user.id);
    return zurueck(`verbunden=${uids.length}`);
  } catch (e) {
    console.error("Banking-Callback fehlgeschlagen:", e instanceof Error ? e.message : e);
    return zurueck("fehler=session");
  }
}
