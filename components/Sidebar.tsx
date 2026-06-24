"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/properties", label: "Immobilien", icon: "⌂" },
  { href: "/einnahmen", label: "Einnahmen", icon: "↑" },
  { href: "/tenants", label: "Mieter", icon: "☺" },
  { href: "/termine", label: "Termine", icon: "◷" },
  { href: "/kosten", label: "Kosten", icon: "↓" },
  { href: "/verbrauch", label: "Verbrauch", icon: "≈" },
  { href: "/kredite", label: "Kredite", icon: "€" },
  { href: "/notizen", label: "Notizen", icon: "✎" },
  { href: "/jahresbericht", label: "Jahresbericht", icon: "∑" },
  { href: "/einstellungen", label: "Einstellungen", icon: "⚙" },
];

export default function Sidebar() {
  const path = usePathname();

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 px-3 py-5">
      <Link href="/" className="mb-6 px-3 text-xl font-semibold text-gold serif">
        MyImmo
      </Link>
      <div className="mb-2 px-3 text-[11px] uppercase tracking-widest text-white/30">
        Verwaltung
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              isActive(n.href)
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="w-4 text-center text-white/40">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <ThemeToggle />
        <form action="/auth/signout" method="post" className="px-3 pt-2">
          <button className="text-sm text-white/40 hover:text-white">Abmelden</button>
        </form>
      </div>
    </aside>
  );
}
