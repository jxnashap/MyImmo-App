import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { berechneNk, deDatum, type NkRawPosition, type NkCo2Input } from "@/lib/nk";
import { eur2, adressZeilen } from "@/lib/format";
import { vermieterAus } from "@/lib/pdf/nkPdf";
import { decryptIbanRow } from "@/lib/ibanData";
import { decryptNullable } from "@/lib/crypto/secure";
import BriefBlatt from "@/components/BriefBlatt";
import NkSpeichernButton from "@/components/NkSpeichernButton";
import NkCo2Panel from "@/components/NkCo2Panel";

export const dynamic = "force-dynamic";

const formatIban = (s: string) =>
  s.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();

export default async function NkPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { jahr?: string };
}) {
  const supabase = createClient();

  const { data: tenant } = await supabase
    .from("mieter")
    .select(
      "id,prop_id,vorname,nachname,mieter_adresse,einheit,flaeche,mietbeginn,mietende,nk_vorauszahlung,iban",
    )
    .eq("id", params.id)
    .single();

  if (!tenant) notFound();

  const jahr = Number(searchParams.jahr) || new Date().getFullYear() - 1;

  const [{ data: property }, { data: positions }, { data: profil }, { data: ibanRow }, { data: co2Row }] =
    await Promise.all([
      tenant.prop_id
        ? supabase
            .from("properties")
            .select("bezeichnung,adresse,flaeche")
            .eq("id", tenant.prop_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("mieter_positionen")
        .select("bezeichnung,betrag,umlageschluessel,umlagefaehig,jahr,aufteilung,verbrauch_mieter,verbrauch_gesamt")
        .eq("mieter_id", params.id)
        .order("created_at"),
      supabase.from("vermieter_profil").select("*").limit(1).maybeSingle(),
      supabase
        .from("ibans")
        .select("*")
        .order("standard", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("nk_co2")
        .select("co2_kg,co2_kosten,flaeche,gewerbe")
        .eq("mieter_id", params.id)
        .eq("jahr", jahr)
        .maybeSingle(),
    ]);

  const a = berechneNk(
    jahr,
    tenant,
    property ?? null,
    (positions ?? []) as NkRawPosition[],
    (co2Row ?? null) as NkCo2Input | null,
  );
  const vermieter = vermieterAus(profil, ibanRow ? decryptIbanRow(ibanRow) : null);

  const aktuell = new Date().getFullYear();
  const jahre = [aktuell, aktuell - 1, aktuell - 2, aktuell - 3, aktuell - 4];
  const guthaben = a.saldo >= 0;
  const saldoKlasse = guthaben ? "brief-gruen" : "brief-rot";

  const heute = deDatum(new Date().toISOString());
  const ortDatum = vermieter.ort ? `${vermieter.ort.replace(/^\d{4,5}\s*/, "")}, ${heute}` : heute;
  const absenderZeile =
    [vermieter.strasse, vermieter.ort, vermieter.email].filter(Boolean).join(" · ") || null;
  const ruecksende =
    [vermieter.name, vermieter.strasse, vermieter.ort].filter(Boolean).join(", ") || null;

  const hatKonto = !guthaben && !!vermieter.iban;
  const mieterIban = decryptNullable(tenant.iban);
  const schluss = guthaben
    ? mieterIban
      ? `Das Guthaben wird Ihnen innerhalb von 14 Tagen auf Ihr Konto IBAN ${formatIban(mieterIban)} erstattet. Bitte prüfen Sie, ob diese Bankverbindung noch aktuell ist.`
      : "Das Guthaben wird Ihnen innerhalb von 14 Tagen auf das uns bekannte Konto erstattet."
    : hatKonto
      ? "Bitte überweisen Sie den Nachzahlungsbetrag innerhalb von 14 Tagen auf folgendes Konto:"
      : "Bitte überweisen Sie den Nachzahlungsbetrag innerhalb von 14 Tagen auf das Ihnen bekannte Konto.";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/tenants/${params.id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>
            ← Zurück
          </Link>
          <div>
            <div className="topbar-title">Nebenkostenabrechnung {jahr}</div>
            <div className="topbar-sub">{a.mieterName}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <form style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              name="jahr"
              defaultValue={jahr}
              style={{ background: "var(--bg3)", border: "1px solid var(--line2)", color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
            >
              {jahre.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <button className="btn btn-ghost" style={{ fontSize: 12 }}>Anzeigen</button>
          </form>
          <a href={`/tenants/${params.id}/nk/pdf?jahr=${jahr}`} className="btn btn-gold">
            Als PDF herunterladen
          </a>
          <NkSpeichernButton mieterId={params.id} jahr={jahr} />
        </div>
      </div>

      {!profil?.name && (
        <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto 14px", background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
          Noch kein Absender hinterlegt — im Briefkopf erscheint vorerst nur der Name aus den
          IBAN-Daten.{" "}
          <Link href="/einstellungen" style={{ color: "var(--gold)" }}>Vermieter-Profil ausfüllen</Link>
        </div>
      )}

      <NkCo2Panel
        mieterId={params.id}
        jahr={jahr}
        gespeichert={(co2Row ?? null) as { co2_kg: number | null; co2_kosten: number | null; flaeche: number | null; gewerbe: boolean | null } | null}
        defaultFlaeche={tenant.flaeche ?? (property as { flaeche?: number | null } | null)?.flaeche ?? null}
      />

      <BriefBlatt
        absenderName={vermieter.name}
        absenderZeile={absenderZeile}
        ruecksende={ruecksende}
        vermerk="Vertrauliches Dokument"
        empfaenger={[a.mieterName, ...adressZeilen(a.mieterAdresse)]}
        ortDatum={ortDatum}
        referenz={`Abrechnung Nr. NK-${a.jahr}`}
        betreff={`Nebenkostenabrechnung ${a.jahr}`}
        untertitel={
          `Mietobjekt: ${[a.objekt, a.objektAdresse].filter(Boolean).join(" · ")}` +
          (a.einheit ? ` · Einheit ${a.einheit}` : "")
        }
      >
        <p>Sehr geehrte/r {a.mieterName},</p>
        <p>
          nachfolgend erhalten Sie die Abrechnung der Betriebs- und Nebenkosten für den
          Abrechnungszeitraum {deDatum(a.zeitraumVon)} bis {deDatum(a.zeitraumBis)} ({a.monate}{" "}
          {a.monate === 1 ? "Monat" : "Monate"}).
        </p>

        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Umlagefähige Position</th>
              <th>Umlageschlüssel</th>
              <th className="zahl">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {a.positionen.length === 0 ? (
              <tr>
                <td colSpan={3} className="brief-muted">
                  Keine umlagefähigen Positionen für {jahr} hinterlegt.
                </td>
              </tr>
            ) : (
              a.positionen.map((p, i) => (
                <tr key={i}>
                  <td>{p.bezeichnung}</td>
                  <td className="brief-muted">{p.umlageschluessel || "—"}</td>
                  <td className="zahl">
                    {eur2(p.betrag)}
                    {p.faktorText && (
                      <div className="brief-muted" style={{ fontSize: 9.5 }}>
                        {eur2(p.basis ?? 0)} × {p.faktorText}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {a.co2 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>
              CO₂-Kostenaufteilung nach CO2KostAufG
            </div>
            <p className="brief-muted" style={{ fontSize: 10.5, margin: "4px 0 6px" }}>
              Spezifischer CO₂-Ausstoß: {String(a.co2.spez).replace(".", ",")} kg/m² und Jahr
              {a.co2.gewerbe
                ? " · Gewerbe/Nichtwohngebäude: pauschale Aufteilung 50/50"
                : ` · Stufe ${a.co2.stufeLabel} kg/m²·a`}{" "}
              → Mieter {a.co2.mieterProzent} %, Vermieter {a.co2.vermieterProzent} %. CO₂-Kosten
              gesamt: {eur2(a.co2.kostenGesamt)}
              {a.co2.geschaetzt ? " (geschätzt über BEHG-Referenzpreis)" : ""} — davon Mieteranteil{" "}
              {eur2(a.co2.mieterAnteil)} (in den Heizkosten enthalten), Vermieteranteil{" "}
              {eur2(a.co2.vermieterAnteil)} (wird Ihnen nachfolgend gutgeschrieben). Einstufung auf
              Basis der Angaben der Brennstoff-/Wärmelieferrechnung, ohne Gewähr.
            </p>
          </div>
        )}

        <div className="brief-summen">
          <div className="zeile">
            <span className="brief-muted">Summe umlagefähige Kosten</span>
            <span>{eur2(a.umlageGesamt)}</span>
          </div>
          {a.co2 && (
            <div className="zeile">
              <span className="brief-muted">
                CO₂-Gutschrift Vermieteranteil ({a.co2.vermieterProzent} %)
              </span>
              <span className="brief-gruen">− {eur2(a.co2.vermieterAnteil)}</span>
            </div>
          )}
          {a.co2 && (
            <div className="zeile">
              <span className="brief-muted">Von Ihnen zu tragende Kosten</span>
              <span>{eur2(a.kostenNachCo2)}</span>
            </div>
          )}
          <div className="zeile">
            <span className="brief-muted">
              Vorauszahlung ({a.monate} × {eur2(a.nkVorauszahlungMonat)})
            </span>
            <span>{eur2(a.vorauszahlungGeleistet)}</span>
          </div>
          <div className={`zeile gesamt ${saldoKlasse}`}>
            <span>{guthaben ? "Ihr Guthaben (Erstattung)" : "Nachzahlung"}</span>
            <span>{eur2(Math.abs(a.saldo))}</span>
          </div>
        </div>

        {a.ausgenommen.length > 0 && (
          <p className="brief-muted" style={{ fontSize: 10.5, marginTop: 14 }}>
            Nicht umlagefähig (nicht berechnet): {a.ausgenommen.map((p) => p.bezeichnung).join(", ")}
          </p>
        )}

        <p style={{ marginTop: 18 }}>{schluss}</p>
        {hatKonto && (
          <div className="brief-konto">
            <div style={{ fontWeight: 700 }}>{vermieter.kontoinhaber || vermieter.name}</div>
            <div className="iban">IBAN {formatIban(vermieter.iban!)}</div>
            {vermieter.kontoname && <div className="brief-muted">{vermieter.kontoname}</div>}
          </div>
        )}

        <p style={{ marginTop: 26 }}>Mit freundlichen Grüßen</p>
        <p style={{ marginTop: 40 }}>{vermieter.name}</p>
      </BriefBlatt>

      <p className="no-print" style={{ maxWidth: "210mm", margin: "12px auto 0", fontSize: 11, color: "var(--faint)" }}>
        Abrechnung nach §§ 556 ff. BGB i.V.m. BetrKV. Beträge stammen aus den Umlagepositionen des
        Mieters. Ohne Gewähr.
      </p>
    </div>
  );
}
