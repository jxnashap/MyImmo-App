import { heuteBerlin } from "@/lib/zeitraum";
import Link from "next/link";
import RueckstandWaechter from "@/components/RueckstandWaechter";
import { ladeMietkonto } from "@/lib/mietkontoDaten";
import MietkontoBestaetigung from "@/components/MietkontoBestaetigung";

export const dynamic = "force-dynamic";

// Mietkonto: je Monat die erwarteten Mieteingänge sehen und per Klick
// bestätigen — plus Nacherfassen-Modus für offene Vormonate (bis 10 Jahre).
// Soll-Beträge kommen aus lib/mietkonto.ts (Miet-Zeiträume + Fallback).

export default async function MietkontoPage(
  props: {
    searchParams: Promise<{ monat?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  // Berliner Datum (Audit P8, C15) — am Monatsersten bis 2 Uhr sonst noch der Vormonat.
  const aktuellerMonat = heuteBerlin().slice(0, 7);
  const monat = /^\d{4}-\d{2}$/.test(searchParams.monat ?? "") ? searchParams.monat! : aktuellerMonat;

  const { zeilen, nacherfassung, ohneMietbeginn } = await ladeMietkonto(monat);

  return (
    <MietkontoBestaetigung
      monat={monat}
      aktuellerMonat={aktuellerMonat}
      zeilen={zeilen}
      nacherfassung={nacherfassung}
      banner={
        <>
          <RueckstandWaechter />
          {ohneMietbeginn.length > 0 && (
            <div className="section mb-20" style={{ borderColor: "var(--amber)" }}>
              <div className="section-body">
                <strong>
                  {ohneMietbeginn.length === 1 ? "Ein Mieter fehlt hier" : `${ohneMietbeginn.length} Mieter fehlen hier`}
                </strong>{" "}
                — ohne Mietbeginn lässt sich keine Soll-Miete berechnen:{" "}
                {ohneMietbeginn.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && ", "}
                    <Link href={`/tenants/${m.id}/edit`}>{m.name}</Link>
                  </span>
                ))}
                . Mietbeginn ergänzen, dann erscheinen die Monate zum Bestätigen.
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
