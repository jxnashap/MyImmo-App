import NkVorjahrHilfe from "@/components/NkVorjahrHilfe";
import { vorjahrUebernahme, vorauszahlungsVorschlag, gleicheBetraegeWieVorjahr, type VorjahrPosition } from "@/lib/nkVorjahr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { berechneNk, deDatum, co2Gutschrift, co2GutschriftSatz, vorauszahlungZusatz, type NkCo2Input } from "@/lib/nk";
import { ladeNkPositionen, nkCo2Argumente } from "@/lib/nkPositionen";
import { ladeVorauszahlung } from "@/lib/nkDaten";
import { eur2, adressZeilen } from "@/lib/format";
import { vermieterAus } from "@/lib/pdf/nkPdf";
import { decryptIbanRow } from "@/lib/ibanData";
import { decryptNullable } from "@/lib/crypto/secure";
import BriefBlatt from "@/components/BriefBlatt";
import NkSpeichernButton from "@/components/NkSpeichernButton";
import NkCo2Panel from "@/components/NkCo2Panel";
import NkOcrUpload from "@/components/NkOcrUpload";
import type { ZustellPruefung } from "@/lib/mieterZugang";
import { ladeZustellLage } from "@/lib/zustellung";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { heuteBerlin } from "@/lib/zeitraum";
import { ymPlus } from "@/lib/mietkonto";
import { nkAusBuchungen } from "@/lib/nkAusBuchungen";
import { zeigeVerteiler } from "@/lib/umlage";
import { zaehlerSpanne, type ZaehlerMeldung } from "@/lib/zaehlerSpanne";

export const dynamic = "force-dynamic";

// Spalte „Ihr Anteil“: Abstand zur Textspalte davor und am Handy rechts
// festgehalten, während die übrigen Spalten waagerecht scrollen.
const ANTEIL_SPALTE: import("react").CSSProperties = { paddingLeft: 12, position: "sticky", right: 0, background: "#ffffff" };

const formatIban = (s: string) =>
  s.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();

export default async function NkPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ jahr?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("mieter")
    .select(
      "id,prop_id,vorname,nachname,mieter_adresse,einheit,flaeche,mietbeginn,mietende,nk_vorauszahlung,iban",
    )
    .eq("id", params.id)
    .single();

  if (!tenant) notFound();

  const jahr = Number(searchParams.jahr) || new Date().getFullYear() - 1;

  const [{ data: property }, nkPos, { data: profil }, { data: ibanRow }, { data: co2Row }, { data: kostenRows }, { count: mieterImObjekt }, { data: zaehlerRows }] =
    await Promise.all([
      tenant.prop_id
        ? supabase
            .from("properties")
            .select("bezeichnung,adresse,flaeche,typ,einheiten_anzahl")
            .eq("id", tenant.prop_id)
            .single()
        : Promise.resolve({ data: null }),
      // Stufe 1: Kosten am Objekt schlagen die alten Positionen beim Mieter (lib/nkPositionen.ts).
      ladeNkPositionen(supabase, tenant, jahr),
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
      // Paket C: gebuchte Kosten des Objekts im Jahr (Vorschlag „aus Buchungen übernehmen“),
      // Zahl der Mietparteien (Verteiler oder direkt) und gemeldete Zählerstände des Mieters.
      tenant.prop_id
        ? supabase.from("kosten").select("prop_id,buchungsdatum,kategorie,betrag").eq("prop_id", tenant.prop_id)
            .gte("buchungsdatum", `${jahr}-01-01`).lt("buchungsdatum", `${jahr + 1}-01-01`)
        : Promise.resolve({ data: [] }),
      tenant.prop_id
        ? supabase.from("mieter").select("id", { count: "exact", head: true }).eq("prop_id", tenant.prop_id)
        : Promise.resolve({ count: 0 }),
      supabase.from("zaehlerstand_meldungen").select("art,zaehlernummer,stand,einheit,ablesedatum")
        .eq("mieter_id", params.id).gte("ablesedatum", `${jahr - 1}-12-01`).lt("ablesedatum", `${jahr + 1}-02-01`)
        .order("ablesedatum"),
    ]);
  const ausBuchungen = tenant.prop_id ? nkAusBuchungen(kostenRows ?? [], tenant.prop_id, jahr) : { vorschlaege: [], unklar: [] };
  const positions = nkPos.mieterPositionen;
  const schonDa = new Set(((positions ?? []) as { bezeichnung: string; jahr: number | null }[])
    .filter((p) => p.jahr === jahr).map((p) => p.bezeichnung.trim().toLowerCase()));
  const offeneVorschlaege = ausBuchungen.vorschlaege.filter((v) => !schonDa.has(v.bezeichnung.toLowerCase()));
  const mitVerteiler = zeigeVerteiler({
    typ: (property as { typ?: string | null } | null)?.typ,
    einheiten_anzahl: (property as { einheiten_anzahl?: number | null } | null)?.einheiten_anzahl ?? null,
    mieterAnzahl: mieterImObjekt ?? 0,
  });
  // Stufe 1 (07.10.2026): Beim Mehrfamilienhaus stehen die Kosten am OBJEKT — dort einmal mit dem
  // Gesamtbetrag, verteilt auf alle Mieter. Die Werkzeuge, die Positionen beim Mieter anlegen
  // (Vorjahr übernehmen, KI-Import, Buchungen), führen hier nicht mehr hin.
  const amObjekt = mitVerteiler && !!tenant.prop_id && nkPos.objektBereit;
  const objektNkHref = tenant.prop_id ? `/properties/${tenant.prop_id}/nebenkosten?jahr=${jahr}` : null;
  const zaehlerImJahr = zaehlerSpanne((zaehlerRows ?? []) as ZaehlerMeldung[], jahr);

  // CO₂: Einzelobjekt aus dem Mieter-Block, Mehrfamilienhaus nur vom Objekt (Audit 07.10.2026, A4).
  const co2Arg = nkCo2Argumente(nkPos, (co2Row ?? null) as NkCo2Input | null);
  const a = berechneNk(
    jahr,
    tenant,
    property ?? null,
    nkPos.positionen,
    co2Arg.co2Input,
    await ladeVorauszahlung(params.id, jahr),
    co2Arg.opts,
  );
  const vermieter = vermieterAus(profil, ibanRow ? decryptIbanRow(ibanRow) : null);

  // Für den Zustell-Dialog: WER die Abrechnung im Portal sähe — dieselbe Funktion, die
  // `speichereNk` als Schranke benutzt (lib/zustellung.ts). Scheitert die Prüfung, zeigt
  // der Dialog eine Sperre statt eines Zustell-Knopfs.
  const nutzer = await aktuellerNutzer();
  const lage = nutzer
    ? await ladeZustellLage(supabase, nutzer.id, params.id, { jahr })
    : { error: "Nicht angemeldet." };
  const zustellung: ZustellPruefung = "error" in lage
    ? { sperre: lage.error, warnungen: [] }
    : { sperre: lage.sperre, warnungen: lage.warnungen };
  const portalEmail = "error" in lage ? null : lage.empfaenger.map((e) => e.email ?? "Adresse unbekannt").join(", ") || null;

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
          <Link href={`/tenants/${params.id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>
            ← Zurück
          </Link>
          <div style={{ minWidth: 0 }}>
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
          {/* Stufe 0 (07.10.2026): Die Positionen lagen nur unter „Mieter bearbeiten“, ganz unten — von hier
              führte kein Weg dorthin. */}
          {amObjekt && objektNkHref ? (
            <Link href={objektNkHref} className="btn btn-ghost" style={{ fontSize: 12 }}>
              Kosten am Objekt
            </Link>
          ) : (
            <Link href={`/tenants/${params.id}/edit?jahr=${jahr}#positionen`} className="btn btn-ghost" style={{ fontSize: 12 }}>
              Positionen bearbeiten
            </Link>
          )}
          <a href={`/tenants/${params.id}/nk/pdf?jahr=${jahr}`} className="btn btn-ghost">
            Als PDF herunterladen
          </a>
          <NkSpeichernButton
            mieterId={params.id}
            jahr={jahr}
            empfaenger={{
              name: a.mieterName,
              wohnung: [a.objekt, a.einheit ? `Einheit ${a.einheit}` : null].filter(Boolean).join(" · ") || null,
              email: portalEmail,
              mietzeit: `${tenant.mietbeginn ? deDatum(tenant.mietbeginn) : "?"} – ${tenant.mietende ? deDatum(tenant.mietende) : "heute"}`,
            }}
            pruefung={zustellung}
          />
          {/* Paket C (06.10.2026): Nachzahlung als Einnahme buchen, vorausgefüllt — vorher endete die
              Abrechnung im Archiv, und der Saldo fehlte in Mietkonto und Anlage V (Zeile 13). */}
          {a.saldo < -0.005 && a.positionen.length > 0 && (
            <Link
              href={`/cashflow/neu?${new URLSearchParams({
                typ: "einnahme",
                kategorie: "Nebenkostenabrechnung",
                betrag: (Math.round(-a.saldo * 100) / 100).toFixed(2),
                mieter: params.id,
                ...(tenant.prop_id ? { prop: tenant.prop_id } : {}),
                text: `Nachzahlung NK-Abrechnung ${jahr}`,
              }).toString()}`}
              className="btn btn-ghost"
              title="Erst buchen, wenn das Geld eingegangen ist"
            >
              Nachzahlung buchen
            </Link>
          )}
        </div>
      </div>

      {!profil?.name && (
        <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto 14px", background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
          Noch kein Absender hinterlegt — im Briefkopf erscheint vorerst nur der Name aus den
          IBAN-Daten.{" "}
          <Link href="/einstellungen" style={{ color: "var(--gold)" }}>Vermieter-Profil ausfüllen</Link>
        </div>
      )}

      {amObjekt && objektNkHref && (
        <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto 14px", background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
          {nkPos.quelle === "objekt" ? (
            <>
              Die Kosten {jahr} kommen aus den <Link href={objektNkHref} style={{ color: "var(--gold)" }}>Nebenkosten des Objekts</Link> —
              dort stehen sie einmal mit dem Gesamtbetrag und werden auf alle Mieter verteilt.
              {nkPos.uebergangen > 0 && ` ${nkPos.uebergangen} ältere Position${nkPos.uebergangen === 1 ? "" : "en"} beim Mieter ${nkPos.uebergangen === 1 ? "zählt" : "zählen"} für ${jahr} nicht mehr.`}
            </>
          ) : (
            <>
              Beim Mehrfamilienhaus erfasst du die Kosten einmal am Objekt:{" "}
              <Link href={objektNkHref} style={{ color: "var(--gold)" }}>Nebenkosten {jahr} öffnen</Link>.
              {a.positionen.length > 0 && " Bis dort etwas steht, rechnet diese Abrechnung mit den Positionen beim Mieter."}
            </>
          )}
        </div>
      )}

      {a.warnungen.length > 0 && (
        <div
          className="no-print"
          style={{ maxWidth: "210mm", margin: "0 auto 14px", background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", borderRadius: 8, padding: "12px 14px", fontSize: 13 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Vor dem Verschicken prüfen</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
            {a.warnungen.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload direkt an der Abrechnung: Die Karte stand bisher nur auf der
          Bearbeiten-Seite — wer hier die leere Abrechnung sah, fand den Weg
          nicht. no-print: gehört nicht in den Brief. */}
      <NkVorjahrHilfe
        mieterId={params.id}
        jahr={jahr}
        uebernahme={amObjekt ? { moeglich: false, anzahl: 0 } : vorjahrUebernahme((positions ?? []) as VorjahrPosition[], jahr)}
        vorschlag={a.monate > 0 && a.positionen.length > 0 ? vorauszahlungsVorschlag(a.kostenNachCo2, a.monate, a.nkVorauszahlungMonat) : null}
        aktuellMonat={a.nkVorauszahlungMonat}
        nurVorjahrsBetraege={gleicheBetraegeWieVorjahr((positions ?? []) as VorjahrPosition[], jahr)}
        naechsterMonat={ymPlus(heuteBerlin().slice(0, 7), 1)}
        ausBuchungen={!amObjekt && offeneVorschlaege.length > 0 ? {
          anzahl: offeneVorschlaege.length,
          text: offeneVorschlaege.map((v) => `${v.bezeichnung} ${eur2(v.betrag)}`).join(" · "),
          verteilerHref: mitVerteiler && tenant.prop_id ? `/properties/${tenant.prop_id}/nebenkosten?jahr=${jahr}` : null,
        } : null}
        zaehler={zaehlerImJahr}
      />

      {!amObjekt && <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto" }}>
        <NkOcrUpload
          mieterId={params.id}
          jahr={jahr}
          bestehend={(positions ?? [])
            .filter((p) => (p.jahr == null || p.jahr === jahr) && p.umlagefaehig === true)
            .map((p) => ({
              id: (p as { id: string }).id,
              bezeichnung: p.bezeichnung,
              betrag: p.betrag,
              aufteilung: p.aufteilung ?? null,
            }))}
        />
      </div>}

      {/* Audit 07.10.2026, A4: Im Mehrfamilienhaus steht CO₂ einmal am Objekt — ein Block je Mieter
          mit Gebäudewerten ergab eine mehrfache Gutschrift (und mehrfache Kostenbuchung). */}
      {nkPos.co2AmObjekt ? (
        <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto 14px", fontSize: 13, color: "var(--muted)" }}>
          CO₂-Kosten nach CO2KostAufG trägst du für dieses Haus einmal am Objekt ein
          {objektNkHref ? <> (<Link href={objektNkHref} style={{ color: "var(--gold)" }}>Nebenkosten {jahr} → Grundlagen</Link>)</> : null}.
        </div>
      ) : (
        <NkCo2Panel
          mieterId={params.id}
          jahr={jahr}
          gespeichert={(co2Row ?? null) as { co2_kg: number | null; co2_kosten: number | null; flaeche: number | null; gewerbe: boolean | null } | null}
          defaultFlaeche={tenant.flaeche ?? (property as { flaeche?: number | null } | null)?.flaeche ?? null}
        />
      )}

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

        {/* Die vier Spalten bilden die BGH-Pflichtangaben ab: Gesamtkosten je
            Kostenart, Verteilerschlüssel mit Erläuterung (Rechenweg als
            Unterzeile), Anteilsberechnung — der Vorauszahlungsabzug folgt im
            Summenblock. Bei direkt erfassten Mieteranteilen (ohne Aufteilung)
            gibt es keine Gebäude-Gesamtkosten; dort steht ein Strich.
            Am Handy scrollt die Tabelle waagerecht (.brief-scroll); „Ihr Anteil“
            klebt dabei rechts (sticky), damit der Betrag je Position immer zu
            sehen ist. Ohne Scrollen (Desktop, Druck) wirkt sticky nicht. */}
        <div className="brief-scroll"><table style={{ marginTop: 8, minWidth: 460 }}>
          <thead>
            <tr>
              <th>Umlagefähige Position</th>
              <th className="zahl" style={{ paddingRight: 14 }}>Gesamtkosten</th>
              <th>Umlageschlüssel</th>
              <th className="zahl" style={ANTEIL_SPALTE}>Ihr Anteil</th>
            </tr>
          </thead>
          <tbody>
            {a.positionen.length === 0 ? (
              <tr>
                <td colSpan={4} className="brief-muted">
                  Keine umlagefähigen Positionen für {jahr} hinterlegt.
                </td>
              </tr>
            ) : (
              a.positionen.map((p, i) => (
                <tr key={i}>
                  <td>{p.bezeichnung}</td>
                  <td className="zahl brief-muted" style={{ paddingRight: 14 }}>{p.basis != null ? eur2(p.basis) : "—"}</td>
                  <td className="brief-muted">
                    {p.umlageschluessel || "—"}
                    {p.faktorText && (
                      <div className="brief-muted" style={{ fontSize: 9.5 }}>
                        Anteil: {p.faktorText}
                      </div>
                    )}
                  </td>
                  <td className="zahl" style={ANTEIL_SPALTE}>{eur2(p.betrag)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table></div>

        {a.co2 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>
              CO₂-Kostenaufteilung nach CO2KostAufG
            </div>
            <p className="brief-muted" style={{ fontSize: 11, margin: "4px 0 6px" }}>
              Spezifischer CO₂-Ausstoß: {String(a.co2.spez).replace(".", ",")} kg/m² und Jahr
              {a.co2.gewerbe
                ? " · Gewerbe/Nichtwohngebäude: pauschale Aufteilung 50/50"
                : ` · Stufe ${a.co2.stufeLabel} kg/m²·a`}{" "}
              → Mieter {a.co2.mieterProzent} %, Vermieter {a.co2.vermieterProzent} %. CO₂-Kosten
              gesamt: {eur2(a.co2.kostenGesamt)}
              {a.co2.geschaetzt ? " (geschätzt über BEHG-Referenzpreis)" : ""} — davon Mieteranteil{" "}
              {eur2(a.co2.mieterAnteil)} (in den Heizkosten enthalten), {co2GutschriftSatz(a.co2, eur2)}. Einstufung auf
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
              <span className="brief-gruen">− {eur2(co2Gutschrift(a.co2))}</span>
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
              {a.vorauszahlung.quelle === "stammdaten" ? "Vorauszahlung" : "Geleistete Vorauszahlungen"} ({vorauszahlungZusatz(a, eur2)})
            </span>
            <span>{eur2(a.vorauszahlungGeleistet)}</span>
          </div>
          <div className={`zeile gesamt ${saldoKlasse}`}>
            <span>{guthaben ? "Ihr Guthaben (Erstattung)" : "Nachzahlung"}</span>
            <span>{eur2(Math.abs(a.saldo))}</span>
          </div>
        </div>

        {a.ausgenommen.length > 0 && (
          <p className="brief-muted" style={{ fontSize: 11, marginTop: 14 }}>
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
        Abrechnung nach §§ 556 ff. BGB i.V.m. BetrKV. Beträge stammen{" "}
        {nkPos.quelle === "objekt" ? "aus den Nebenkosten des Objekts" : "aus den Umlagepositionen des Mieters"}. Ohne Gewähr.
      </p>
    </div>
  );
}
