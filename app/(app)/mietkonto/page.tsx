import RueckstandWaechter from "@/components/RueckstandWaechter";
import { ladeMietkonto } from "@/lib/mietkontoDaten";
import MietkontoBestaetigung from "@/components/MietkontoBestaetigung";

export const dynamic = "force-dynamic";

// Mietkonto: je Monat die erwarteten Mieteingänge sehen und per Klick
// bestätigen — plus Nacherfassen-Modus für offene Vormonate (bis 10 Jahre).
// Soll-Beträge kommen aus lib/mietkonto.ts (Miet-Zeiträume + Fallback).

export default async function MietkontoPage({
  searchParams,
}: {
  searchParams: { monat?: string };
}) {
  const jetzt = new Date();
  const aktuellerMonat = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, "0")}`;
  const monat = /^\d{4}-\d{2}$/.test(searchParams.monat ?? "") ? searchParams.monat! : aktuellerMonat;

  const { zeilen, nacherfassung } = await ladeMietkonto(monat);

  return (
    <MietkontoBestaetigung
      monat={monat}
      aktuellerMonat={aktuellerMonat}
      zeilen={zeilen}
      nacherfassung={nacherfassung}
      banner={<RueckstandWaechter />}
    />
  );
}
