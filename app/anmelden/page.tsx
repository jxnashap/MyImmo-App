"use client";

// Rollen-Auswahl vor dem Login (Businessplan Kap. 14 „Rollen-Plattform"):
// Vermieter · Mieter · Service/Hausmeister · Hausverwaltung. Gleiche
// Kartengröße wie die Login-Karte; Klick löst einen 3D-Flip aus und
// navigiert dann zur Login-Seite mit der gewählten Rolle.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Home, Wrench, Building2, ChevronRight, type LucideIcon } from "lucide-react";
import BrandMark from "@/components/BrandMark";

type Rolle = {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
};

const ROLLEN: Rolle[] = [
  { key: "vermieter", label: "Vermieter", desc: "Objekte, Finanzen & Steuer verwalten", icon: KeyRound },
  { key: "mieter", label: "Mieter", desc: "Anliegen melden, Dokumente & Abrechnungen", icon: Home },
  { key: "service", label: "Service / Hausmeister", desc: "Aufträge & Reparaturen koordinieren", icon: Wrench },
  { key: "hausverwaltung", label: "Hausverwaltung", desc: "Teams, Rechte & große Bestände", icon: Building2 },
];

export default function AnmeldenPage() {
  const router = useRouter();
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  function waehle(key: string) {
    if (gewaehlt) return;
    setGewaehlt(key);
    // Erst den 3D-Flip zeigen, dann navigieren (Dauer = CSS-Animation).
    setTimeout(() => router.push(`/login?rolle=${key}`), 460);
  }

  return (
    <div
      className="role-stage flex min-h-screen w-full items-center justify-center px-4 py-10"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div
        className={`role-card w-full max-w-[420px] rounded-2xl border p-8 sm:p-10 ${gewaehlt ? "flip-out" : "flip-in"}`}
        style={{
          background: "var(--bg2)",
          borderColor: "var(--line2)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 18px 50px -20px rgba(0,0,0,0.28)",
        }}
      >
        <BrandMark size="lg" />

        <p className="mt-6 mb-1 text-[17px] font-semibold" style={{ color: "var(--text)" }}>
          Wie möchtest du MyImmo nutzen?
        </p>
        <p className="mb-6 text-[13px]" style={{ color: "var(--muted)" }}>
          Wähle deinen Zugang — du kannst später jederzeit wechseln.
        </p>

        <div className="space-y-3">
          {ROLLEN.map((r) => {
            const Icon = r.icon;
            const aktiv = gewaehlt === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => waehle(r.key)}
                className={`role-tile flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left ${aktiv ? "tile-aktiv" : ""}`}
                style={{ background: "var(--bg3)", borderColor: aktiv ? "var(--gold)" : "var(--line)" }}
              >
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "var(--gold-pale)", color: "var(--gold)" }}
                >
                  <Icon size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                    {r.label}
                  </span>
                  <span className="block truncate text-[12px]" style={{ color: "var(--muted)" }}>
                    {r.desc}
                  </span>
                </span>
                <ChevronRight size={16} style={{ color: "var(--faint)", flexShrink: 0 }} />
              </button>
            );
          })}
        </div>

        <div
          className="mt-6 flex justify-center gap-4 border-t pt-4 text-[12px]"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          <Link href="/agb" className="hover:underline">AGB</Link>
          <Link href="/datenschutz" className="hover:underline">Datenschutz</Link>
          <Link href="/impressum" className="hover:underline">Impressum</Link>
        </div>
      </div>
    </div>
  );
}
