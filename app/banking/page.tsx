// Banking (Open Banking, read-only): Konten verbinden, Umsätze abrufen.
// Etappe 2 — der Miet-Abgleich („vorschlagen + bestätigen") folgt in Etappe 3.
import { createClient } from "@/lib/supabase/server";
import { decryptNullable } from "@/lib/crypto/secure";
import { ebKonfiguriert, holeBanken } from "@/lib/banking/enableBanking";
import BankVerbinden, { type BankOption } from "@/components/BankVerbinden";
import BankKonten, { type BankVerbindungRow } from "@/components/BankKonten";
import BankUmsaetze, { type BankUmsatzRow } from "@/components/BankUmsaetze";

export const dynamic = "force-dynamic";

export default async function BankingPage({
  searchParams,
}: {
  searchParams: { verbunden?: string; fehler?: string };
}) {
  const supabase = createClient();

  const [{ data: verbindungRows }, { data: umsatzRows }, { data: props }] = await Promise.all([
    supabase.from("bankverbindungen").select("*").order("created_at", { ascending: false }),
    supabase
      .from("bank_umsaetze")
      .select("id,verbindung_id,buchungsdatum,betrag,gegenpartei,verwendungszweck,status")
      .order("buchungsdatum", { ascending: false })
      .limit(200),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
  ]);

  const konfiguriert = ebKonfiguriert();
  let banken: BankOption[] = [];
  if (konfiguriert) {
    try {
      banken = (await holeBanken(["DE", "FI"])).map((b) => ({ name: b.name, country: b.country }));
    } catch {
      banken = [];
    }
  }

  const objektName = (id: string | null) =>
    (props ?? []).find((p) => p.id === id)?.bezeichnung ?? null;

  const verbindungen: BankVerbindungRow[] = ((verbindungRows ?? []) as any[]).map((v) => ({
    id: v.id,
    aspsp_name: v.aspsp_name,
    iban: decryptNullable(v.iban),
    konto_name: v.konto_name,
    objektName: objektName(v.prop_id),
    gueltig_bis: v.gueltig_bis,
    letzter_abruf: v.letzter_abruf,
  }));
  const bankVon = (verbindungId: string) =>
    verbindungen.find((v) => v.id === verbindungId)?.aspsp_name ?? null;

  const umsaetze: BankUmsatzRow[] = ((umsatzRows ?? []) as any[]).map((u) => ({
    id: u.id,
    buchungsdatum: u.buchungsdatum,
    betrag: Number(u.betrag) || 0,
    gegenpartei: decryptNullable(u.gegenpartei),
    verwendungszweck: decryptNullable(u.verwendungszweck),
    status: u.status,
    bankName: verbindungen.length > 1 ? bankVon(u.verbindung_id) : null,
  }));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Banking</div>
          <div className="topbar-sub">
            Konten verbinden (nur Lesezugriff) und Umsätze abrufen — Sandbox-Modus bis zum Live-Vertrag
          </div>
        </div>
      </div>

      {searchParams.verbunden && (
        <div className="section" style={{ borderColor: "var(--green)" }}>
          <div className="section-body" style={{ fontSize: 13, color: "var(--green)" }}>
            {searchParams.verbunden} Konto/Konten erfolgreich verbunden ✓ — jetzt „Umsätze abrufen" klicken.
          </div>
        </div>
      )}
      {searchParams.fehler && (
        <div className="section" style={{ borderColor: "var(--red)" }}>
          <div className="section-body" style={{ fontSize: 13, color: "var(--red)" }}>
            {searchParams.fehler === "abgebrochen"
              ? "Die Bank-Freigabe wurde abgebrochen."
              : searchParams.fehler === "keine_konten"
                ? "Die Bank hat keine Konten freigegeben."
                : "Die Verbindung ist fehlgeschlagen — bitte erneut versuchen."}
          </div>
        </div>
      )}

      {!konfiguriert ? (
        <div className="section">
          <div className="section-body" style={{ fontSize: 13, color: "var(--muted)" }}>
            Banking ist noch nicht konfiguriert. In Vercel müssen <code>ENABLE_BANKING_APP_ID</code> und{" "}
            <code>ENABLE_BANKING_PRIVATE_KEY</code> gesetzt sein (Enable-Banking-Application, siehe Projektnotizen).
          </div>
        </div>
      ) : (
        <>
          <BankKonten verbindungen={verbindungen} />
          <BankVerbinden banken={banken} properties={props ?? []} />
          <BankUmsaetze umsaetze={umsaetze} />
          <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 14, lineHeight: 1.6 }}>
            Datenschutz: MyImmo erhält ausschließlich Lesezugriff über einen lizenzierten
            Kontoinformationsdienst (Enable Banking). IBAN, Gegenpartei und Verwendungszweck
            werden verschlüsselt gespeichert. Die Freigabe läuft nach 90 Tagen automatisch ab
            (PSD2) und kann jederzeit bei deiner Bank widerrufen werden.
          </p>
        </>
      )}
    </div>
  );
}
