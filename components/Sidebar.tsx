"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

type SidebarProperty = { id: string; bezeichnung: string; typ: string | null };

const VERWALTUNG: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/properties", label: "Immobilien", icon: "🏠" },
  { href: "/einnahmen", label: "Einnahmen", icon: "💰" },
  { href: "/tenants", label: "Mieter", icon: "👤" },
  { href: "/kosten", label: "Kosten & Ausgaben", icon: "📋" },
  { href: "/verbrauch", label: "Verbrauch", icon: "⚡" },
  { href: "/kredite", label: "Kredite", icon: "🏦" },
  { href: "/notizen", label: "Notizen", icon: "📁" },
  { href: "/jahresbericht", label: "Jahresbericht", icon: "📈" },
];

const KALKULATOR: { href: string; label: string; icon: string }[] = [
  { href: "/roter-faden", label: "Roter Faden", icon: "🧵" },
  { href: "/cockpit", label: "Cockpit", icon: "📅" },
  { href: "/bankgespraech", label: "Bankgespräch", icon: "🏦" },
];

// Emoji je Objekttyp — wie in der HTML-Vorlage.
function objektIcon(typ: string | null, name: string): string {
  const t = `${typ ?? ""} ${name}`.toLowerCase();
  if (t.includes("eigentumswohnung") || t.includes("etw") || t.includes("wohnung")) return "🏢";
  if (t.includes("ferien")) return "⛱️";
  if (t.includes("mehrfamilien") || t.includes("mfh")) return "🏠";
  if (t.includes("einfamilien") || t.includes("efh")) return "🏡";
  return "🏠";
}

export default function Sidebar({
  properties = [],
  userEmail,
}: {
  properties?: SidebarProperty[];
  userEmail?: string | null;
}) {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const navLink = (n: { href: string; label: string; icon: string }) => (
    <Link
      key={n.href}
      href={n.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        isActive(n.href)
          ? "bg-white/10 text-white"
          : "text-white/60 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="w-5 text-center text-[15px]">{n.icon}</span>
      {n.label}
    </Link>
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/10">
      {/* Markenkopf */}
      <div className="px-5 pb-4 pt-5">
        <Link href="/" className="block leading-none">
          <span className="serif text-2xl">
            <span className="text-white">My</span>
            <span className="gold italic">Immo</span>
          </span>
        </Link>
        <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.22em] text-white/30">
          Immobilien-Management
        </div>
      </div>

      {/* Nutzer-Zeile */}
      <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2">
        <span className="truncate text-xs text-white/60" title={userEmail ?? ""}>
          {userEmail ?? "—"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle variant="icon" />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="grid h-8 w-8 place-items-center rounded-lg text-sm text-white/50 transition hover:bg-white/10 hover:text-white"
              title="Abmelden"
              aria-label="Abmelden"
            >
              ⏻
            </button>
          </form>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="mb-2 mt-1 px-3 text-[11px] uppercase tracking-widest text-white/30">
          Verwaltung
        </div>
        <div className="flex flex-col gap-0.5">{VERWALTUNG.map(navLink)}</div>

        <div className="mb-2 mt-5 px-3 text-[11px] uppercase tracking-widest text-white/30">
          Kalkulator
        </div>
        <div className="flex flex-col gap-0.5">{KALKULATOR.map(navLink)}</div>

        {properties.length > 0 && (
          <>
            <div className="mb-2 mt-5 px-3 text-[11px] uppercase tracking-widest text-white/30">
              Meine Objekte
            </div>
            <div className="flex flex-col gap-0.5">
              {properties.map((p) => (
                <Link
                  key={p.id}
                  href={`/properties/${p.id}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    path === `/properties/${p.id}`
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="w-5 text-center text-[15px]">{objektIcon(p.typ, p.bezeichnung)}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{p.bezeichnung}</span>
                    {p.typ && <span className="block truncate text-[11px] text-white/35">{p.typ}</span>}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <Link
          href="/einstellungen"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
            isActive("/einstellungen")
              ? "bg-white/10 text-white"
              : "text-white/50 hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className="w-5 text-center text-[15px]">⚙️</span>
          Einstellungen
        </Link>
      </div>
    </aside>
  );
}
