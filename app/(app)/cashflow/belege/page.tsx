// Belegeingang (Ablauf B, Prüfstand 11.10.2026): Belege hochladen, KI-Vorschlag prüfen, Prüfliste
// abarbeiten, GENAU EINMAL buchen — als neue Kosten oder angehängt an schon gebuchte Kosten ohne
// Beleg (z. B. eine wiederkehrende Grundsteuer). Regeln: lib/belegEingang.ts.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { alleZeilen, nurKonto } from "@/lib/db/auswertung";
import { kiBereit } from "@/lib/aiRoute";
import { heuteBerlin } from "@/lib/zeitraum";
import BelegEingang, { type EingangAnzeige } from "@/components/BelegEingang";
import { jetztMs, type EingangZeile, type KostenZeile } from "@/lib/belegEingang";

export const dynamic = "force-dynamic";

export default async function BelegeingangSeite() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  if (!user) redirect("/login");
  const eigen = nurKonto(user.id);
  const [eingaenge, objekte, kosten] = await Promise.all([
    alleZeilen<EingangAnzeige>(
      supabase, "beleg_eingang",
      "id,status,datei_name,datei_mime,datei_hash,versuche,letzter_versuch,fehler,vorschlag,kosten_id,created_at",
      eigen, [{ spalte: "created_at", auf: false }],
    ),
    alleZeilen<{ id: string; bezeichnung: string | null; adresse: string | null }>(supabase, "properties", "id,bezeichnung,adresse", eigen, [{ spalte: "bezeichnung" }]),
    // Für Dubletten und „an vorhandene Buchung hängen“: die letzten zwei Jahre genügen (±45 Tage um den Beleg).
    alleZeilen<KostenZeile>(
      supabase, "kosten", "id,prop_id,buchungsdatum,betrag,kategorie,beschreibung,rechnung_path,beleg_eingang_id",
      (q) => eigen(q).gte("buchungsdatum", `${Number(heuteBerlin().slice(0, 4)) - 2}-01-01`),
    ),
  ]);
  const offen = eingaenge.filter((e) => e.status !== "gebucht");
  const gebucht = eingaenge.filter((e) => e.status === "gebucht").slice(0, 10);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Verwaltung · Ein- &amp; Ausgaben</div>
          <div className="topbar-title">Belegeingang</div>
          <div className="topbar-sub">Belege hochladen, Vorschlag prüfen, einmal buchen</div>
        </div>
        <Link href="/cashflow?typ=ausgabe" className="btn btn-ghost"><ArrowLeft size={14} style={{ verticalAlign: "-2px" }} /> Ausgaben</Link>
      </div>
      <hr className="topbar-rule" />
      <BelegEingang
        offen={offen}
        gebucht={gebucht}
        objekte={objekte}
        kosten={kosten}
        alleEingaenge={eingaenge.map((e): EingangZeile => ({ id: e.id, datei_hash: e.datei_hash, status: e.status }))}
        kiAn={kiBereit()}
        jetzt={jetztMs()}
      />
    </div>
  );
}
