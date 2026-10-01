"use client";

// Mieterportal-Vorschau (01.10.2026): Auswahl, mit wessen Augen der
// Vermieter das Portal sieht. Reine Navigation — die Seite lädt die Daten
// des gewählten Mieters serverseitig neu.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { vorschauUrl, type VorschauMieter } from "@/lib/portalDaten";

export default function PortalVorschauWahl({ mieter, aktuell, portal }: { mieter: VorschauMieter[]; aktuell: string; portal: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
      Aus Sicht von
      <select
        className="input"
        style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
        value={aktuell}
        disabled={pending}
        onChange={(e) => startTransition(() => router.push(vorschauUrl(e.target.value, portal)))}
        aria-label="Mieter für die Vorschau wählen"
      >
        {mieter.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} · {m.objekt}{m.verknuepft ? "" : " (noch kein Konto)"}
          </option>
        ))}
      </select>
    </label>
  );
}
