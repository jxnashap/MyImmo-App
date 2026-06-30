import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { berechneNk, deDatum, type NkRawPosition } from "@/lib/nk";
import { eur2 } from "@/lib/format";
import DokAusgabe from "@/components/DokAusgabe";

export const dynamic = "force-dynamic";

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
      "id,prop_id,vorname,nachname,email,mieter_adresse,einheit,flaeche,mietbeginn,mietende,nk_vorauszahlung",
    )
    .eq("id", params.id)
    .single();

  if (!tenant) notFound();

  const jahr = Number(searchParams.jahr) || new Date().getFullYear() - 1;

  const [{ data: property }, { data: positions }, { data: profil }] = await Promise.all([
    tenant.prop_id
      ? supabase
          .from("properties")
          .select("bezeichnung,adresse")
          .eq("id", tenant.prop_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("mieter_positionen")
      .select("bezeichnung,betrag,umlageschluessel,umlagefaehig,jahr")
      .eq("mieter_id", params.id)
      .order("created_at"),
    supabase.from("vermieter_profil").select("name").limit(1).maybeSingle(),
  ]);

  const a = berechneNk(jahr, tenant, property ?? null, (positions ?? []) as NkRawPosition[]);

  const aktuell = new Date().getFullYear();
  const jahre = [aktuell, aktuell - 1, aktuell - 2, aktuell - 3, aktuell - 4];
  const guthaben = a.saldo >= 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/tenants/${params.id}/edit`} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
            ← {a.mieterName}
          </Link>
          <h1 className="text-2xl">Nebenkostenabrechnung {jahr}</h1>
        </div>
        <div className="flex items-center gap-3">
          <form className="flex items-center gap-2">
            <span className="text-sm text-[var(--muted)]">Jahr</span>
            <select name="jahr" defaultValue={jahr} className="input">
              {jahre.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <button className="rounded-lg border border-[var(--line2)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg3)]">
              Anzeigen
            </button>
          </form>
          <DokAusgabe
            pdfHref={`/tenants/${params.id}/nk/pdf?jahr=${jahr}`}
            mailTo={tenant.email}
            betreff={`Nebenkostenabrechnung ${jahr} – ${a.objekt}${a.einheit ? ", " + a.einheit : ""}`}
          />
        </div>
      </div>

      {!profil?.name && (
        <div className="mb-4 max-w-3xl rounded-[10px] border border-[var(--gold)]/30 bg-[var(--gold)]/[0.06] px-4 py-3 text-sm text-[var(--text)]">
          Noch kein Absender hinterlegt – im PDF erscheint vorerst nur der Name aus den IBAN-Daten.{" "}
          <Link href="/einstellungen" className="gold hover:underline">
            Vermieter-Profil ausfüllen
          </Link>
        </div>
      )}

      {/* Abrechnung als Vorschau */}
      <div className="card max-w-3xl">
        <div className="mb-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[var(--muted)]">Mieter</div>
            <div className="text-[var(--text)]">{a.mieterName}</div>
            {a.mieterAdresse && (
              <div className="mt-0.5 whitespace-pre-line text-[var(--muted)]">{a.mieterAdresse}</div>
            )}
          </div>
          <div>
            <div className="text-[var(--muted)]">Objekt</div>
            <div className="text-[var(--text)]">{a.objekt}</div>
            {a.einheit && <div className="text-[var(--muted)]">Einheit {a.einheit}</div>}
            <div className="mt-1 text-[var(--muted)]">Zeitraum</div>
            <div className="text-[var(--text)]">
              {deDatum(a.zeitraumVon)} – {deDatum(a.zeitraumBis)} ({a.monate}{" "}
              {a.monate === 1 ? "Monat" : "Monate"})
            </div>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr className="border-b border-[var(--line)]">
              <th className="py-2 font-medium">Umlagefähige Position</th>
              <th className="py-2 font-medium">Schlüssel</th>
              <th className="py-2 text-right font-medium">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {a.positionen.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-3 text-[var(--muted)]">
                  Keine umlagefähigen Positionen für {jahr} hinterlegt.{" "}
                  <Link href={`/tenants/${params.id}/edit`} className="gold hover:underline">
                    Positionen pflegen
                  </Link>
                </td>
              </tr>
            ) : (
              a.positionen.map((p, i) => (
                <tr key={i} className="border-b border-[var(--line)]">
                  <td className="py-2">{p.bezeichnung}</td>
                  <td className="py-2 text-[var(--muted)]">{p.umlageschluessel || "—"}</td>
                  <td className="py-2 text-right">{eur2(p.betrag)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-sm space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Summe umlagefähige Kosten</span>
            <span>{eur2(a.umlageGesamt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">
              Vorauszahlung ({a.monate} × {eur2(a.nkVorauszahlungMonat)})
            </span>
            <span>{eur2(a.vorauszahlungGeleistet)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-2 text-base">
            <span className={guthaben ? "text-[var(--green)]" : "text-[var(--red)]"}>
              {guthaben ? "Guthaben (Erstattung)" : "Nachzahlung"}
            </span>
            <span className={guthaben ? "text-[var(--green)]" : "text-[var(--red)]"}>
              {eur2(Math.abs(a.saldo))}
            </span>
          </div>
        </div>

        {a.ausgenommen.length > 0 && (
          <p className="mt-5 text-xs text-[var(--faint)]">
            Nicht umlagefähig (nicht berechnet): {a.ausgenommen.map((p) => p.bezeichnung).join(", ")}
          </p>
        )}
      </div>

      <p className="mt-3 max-w-3xl text-xs text-[var(--faint)]">
        Abrechnung nach §§ 556 ff. BGB i.V.m. BetrKV. Beträge stammen aus den Umlagepositionen des
        Mieters. Ohne Gewähr.
      </p>
    </div>
  );
}
