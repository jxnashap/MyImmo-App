"use client";

// Ansicht Service (01.10.2026): Auswahl, mit wessen Augen der Vermieter das
// Service-Portal sieht. Reine Navigation — die Seite lädt neu.
// `data-demo-erlaubt`: sonst schaltet DemoNurLesen die Auswahl ab.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { serviceVorschauUrl, type VorschauPartner } from "@/lib/servicePortalDaten";

export default function ServiceVorschauWahl({ partner, aktuell }: { partner: VorschauPartner[]; aktuell: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label data-demo-erlaubt="" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, maxWidth: "100%", fontSize: 12, color: "var(--muted)" }}>
      <span style={{ whiteSpace: "nowrap" }}>Aus Sicht von</span>
      <select
        className="input"
        style={{ width: "auto", flex: "0 1 auto", minWidth: 0, maxWidth: "100%", fontSize: 12, padding: "6px 10px" }}
        value={aktuell}
        disabled={pending}
        onChange={(e) => startTransition(() => router.push(serviceVorschauUrl(e.target.value)))}
        aria-label="Service-Partner für die Ansicht wählen"
      >
        {partner.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}{p.offen > 0 ? ` · ${p.offen} offen` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
