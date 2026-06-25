"use client";

import { usePathname, useRouter } from "next/navigation";

// Jahres-Auswahl oben rechts an Listen. Behält bestehende Filter (prop, mieter,
// art, …) bei und setzt/ersetzt nur den `jahr`-Parameter. "alle" = kein Jahresfilter.
export default function YearSelect({
  years,
  current,
  params,
}: {
  years: number[];
  current: string;
  params: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function change(value: string) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "jahr") sp.set(k, String(v));
    }
    sp.set("jahr", value);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      className="input"
      style={{ fontSize: 12, padding: "4px 8px", minWidth: 110 }}
      title="Jahr filtern"
    >
      <option value="alle">Alle Jahre</option>
      {years.map((y) => (
        <option key={y} value={String(y)}>
          {y}
        </option>
      ))}
    </select>
  );
}
