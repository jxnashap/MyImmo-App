"use client";

// Command Palette (Cmd/Ctrl+K) — durchsucht Bereiche (Sidebar-Navigation),
// eigene Objekte und ein paar häufige Aktionen. Global über die Sidebar
// gemountet, damit sie auf jeder Seite verfügbar ist.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Home as HomeIcon, User as UserIcon, FileText, ReceiptText, type LucideIcon } from "lucide-react";
import { VERWALTUNG, KALKULATOR, PROP_ICONS } from "@/lib/nav";

type Property = { id: string; bezeichnung: string; typ: string | null };
type TenantLite = { id: string; name: string };
type Item = { key: string; label: string; href: string; group: string; icon?: LucideIcon; alias?: string };

// Such-Aliase: damit man Bereiche auch unter geläufigen Begriffen findet, die
// nicht im Label stehen (z. B. „Handwerker" → Anliegen, „ELSTER" → Steuer).
const ALIAS: Record<string, string> = {
  "/anliegen": "handwerker auftrag bewerbung bewerber service mieterportal reparatur meldung anfrage",
  "/steuer": "anlage v afa elster datev einkommensteuer werbungskosten",
  "/cashflow": "buchung buchen einnahme ausgabe miete kosten transaktion",
  "/mietkonto": "zahlung offene posten mahnung soll ist",
  "/kredite": "darlehen finanzierung hypothek zinsbindung restschuld",
  "/verbrauch": "strom gas wasser heizung zählerstand energie",
  "/jahresbericht": "auswertung übersicht cashflow jahr report",
};

const AKTIONEN: Omit<Item, "group">[] = [
  { key: "neu-objekt", label: "Neues Objekt anlegen", href: "/properties/new" },
  { key: "neu-mieter", label: "Neuen Mieter anlegen", href: "/tenants/new" },
  { key: "neu-einnahme", label: "Neue Einnahme buchen", href: "/einnahmen/new" },
  { key: "neu-kosten", label: "Neue Ausgabe buchen", href: "/kosten/new" },
  { key: "einstellungen", label: "Einstellungen öffnen", href: "/einstellungen" },
];

// Mieterbezogene Dokument-Aktionen: Wer „NK Müller" oder „Mieterhöhung Müller"
// tippt, soll direkt auf der passenden Erstellungsseite dieses Mieters landen.
// `stichworte` sind die Wörter, die die Aktion auslösen (der Rest der Eingabe
// filtert dann die Mieter). NK ist eine eigene Seite, alle anderen laufen über
// den Dokument-Generator (?art=…).
type DokAktion = { key: string; label: string; stichworte: string[]; icon: LucideIcon; href: (tenantId: string) => string };
const DOK_AKTIONEN: DokAktion[] = [
  { key: "nk", label: "NK-Abrechnung", icon: ReceiptText, stichworte: ["nk", "nebenkosten", "nebenkostenabrechnung", "betriebskosten", "betriebskostenabrechnung"], href: (id) => `/tenants/${id}/nk` },
  { key: "mieterhoehung", label: "Mieterhöhung", icon: FileText, stichworte: ["mieterhöhung", "mieterhoehung", "mieterhöung", "erhöhung", "erhoehung"], href: (id) => `/tenants/${id}/dokument?art=mieterhoehung` },
  { key: "kuendigung", label: "Kündigung", icon: FileText, stichworte: ["kündigung", "kuendigung", "kündigen"], href: (id) => `/tenants/${id}/dokument?art=kuendigung` },
  { key: "mahnung", label: "Mahnung", icon: FileText, stichworte: ["mahnung", "mahnen"], href: (id) => `/tenants/${id}/dokument?art=mahnung` },
  { key: "zahlungserinnerung", label: "Zahlungserinnerung", icon: FileText, stichworte: ["zahlungserinnerung", "erinnerung"], href: (id) => `/tenants/${id}/dokument?art=zahlungserinnerung` },
  { key: "reparatur", label: "Reparatur-Ankündigung", icon: FileText, stichworte: ["reparatur", "instandhaltung", "handwerker", "ankündigung"], href: (id) => `/tenants/${id}/dokument?art=reparatur` },
  { key: "nk-anschreiben", label: "NK-Anschreiben", icon: FileText, stichworte: ["anschreiben"], href: (id) => `/tenants/${id}/dokument?art=nk-anschreiben` },
  { key: "wohnungsgeber", label: "Wohnungsgeberbestätigung", icon: FileText, stichworte: ["wohnungsgeber", "wohnungsgeberbestätigung", "meldebescheinigung", "anmeldung"], href: (id) => `/tenants/${id}/dokument?art=wohnungsgeber` },
  { key: "mietbescheinigung", label: "Mietbescheinigung", icon: FileText, stichworte: ["mietbescheinigung", "bescheinigung"], href: (id) => `/tenants/${id}/dokument?art=mietbescheinigung` },
  { key: "mietquittung", label: "Mietquittung", icon: FileText, stichworte: ["mietquittung", "quittung"], href: (id) => `/tenants/${id}/dokument?art=mietquittung` },
  { key: "allgemein", label: "Schreiben", icon: FileText, stichworte: ["schreiben", "brief", "dokument"], href: (id) => `/tenants/${id}/dokument?art=allgemein` },
];

export default function CommandPalette({ properties = [], tenants = [] }: { properties?: Property[]; tenants?: TenantLite[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const items = useMemo<Item[]>(() => {
    const bereiche: Item[] = [...VERWALTUNG, ...KALKULATOR].map((n) => ({
      key: n.href, label: n.label, href: n.href, group: "Bereiche", icon: n.icon, alias: ALIAS[n.href],
    }));
    const objekte: Item[] = properties.map((p) => ({
      key: `p-${p.id}`, label: p.bezeichnung, href: `/properties/${p.id}`, group: "Objekte",
      icon: (p.typ && PROP_ICONS[p.typ]) || HomeIcon,
    }));
    const mieter: Item[] = tenants.map((t) => ({
      key: `t-${t.id}`, label: t.name, href: `/tenants/${t.id}`, group: "Mieter", icon: UserIcon,
    }));
    const aktionen: Item[] = AKTIONEN.map((a) => ({ ...a, group: "Aktionen" }));
    return [...bereiche, ...objekte, ...mieter, ...aktionen];
  }, [properties, tenants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const tokens = q.split(/\s+/).filter(Boolean);
    const passt = (text: string) => tokens.every((tk) => text.includes(tk));

    // Kombi-Treffer „Dokumentart + Mieter": sobald ein Stichwort einer Dokument-
    // Aktion getippt ist, aus den restlichen Wörtern die Mieter filtern und je
    // Treffer einen Direkt-Link „<Dokumentart> · <Mieter>" bauen. So landet man
    // mit „nk müller" oder „mieterhöhung müller" direkt auf der Erstellungsseite.
    const kombis: Item[] = [];
    for (const d of DOK_AKTIONEN) {
      const dokTokens = tokens.filter((tk) => tk.length >= 2 && d.stichworte.some((s) => s.startsWith(tk)));
      if (dokTokens.length === 0) continue;
      const restTokens = tokens.filter((tk) => !dokTokens.includes(tk));
      for (const t of tenants) {
        const name = t.name.toLowerCase();
        if (restTokens.every((rt) => name.includes(rt))) {
          kombis.push({
            key: `d-${d.key}-${t.id}`, label: `${d.label} · ${t.name}`,
            href: d.href(t.id), group: "Dokument erstellen", icon: d.icon,
          });
        }
      }
    }
    // Kombi-Treffer zuerst (direkte Absicht), danach die normale Suche.
    return [...kombis, ...items.filter((i) => passt((i.label + " " + (i.alias ?? "")).toLowerCase()))];
  }, [items, query, tenants]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  // Globaler Tastatur-Shortcut — greift nicht, während in einem Feld getippt wird.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !typing) {
        e.preventDefault();
        triggerRef.current = document.activeElement as HTMLElement | null;
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen((o) => (o ? false : o));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app");
    if (open) {
      document.body.style.overflow = "hidden";
      shell?.setAttribute("inert", "");
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    document.body.style.overflow = "";
    shell?.removeAttribute("inert"); // erst inert weg ...
    setQuery("");
    triggerRef.current?.focus?.(); // ... dann Fokus zurück an den Auslöser
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // Fokus-Trap: hält Tab/Shift+Tab innerhalb des Panels (real nur das Input,
  // da die Ergebnis-Items über aria-activedescendant statt tabindex bedient
  // werden — zukunftssicher, falls später ein weiteres fokussierbares
  // Element dazukommt, z. B. ein Close-Button).
  const onOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[activeIdx];
      if (it) go(it.href);
    }
  };

  let lastGroup = "";

  return (
    <>
      <button
        type="button"
        className="cmdk-trigger"
        onClick={() => {
          triggerRef.current = document.activeElement as HTMLElement | null;
          setOpen(true);
        }}
        aria-label="Suche öffnen (Strg/Cmd + K)"
      >
        <Search size={13} />
        <span>Suchen…</span>
        <kbd>⌘K</kbd>
      </button>
      {mounted && open
        ? createPortal(
            <div
              className="cmdk-overlay"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
              onKeyDown={onOverlayKeyDown}
            >
              <div className="cmdk-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Befehlspalette">
                <input
                  ref={inputRef}
                  className="cmdk-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder={'Suchen… z. B. „NK Müller" oder „Mieterhöhung Müller"'}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="cmdk-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={filtered[activeIdx] ? `cmdk-opt-${filtered[activeIdx].key}` : undefined}
                />
                <ul className="cmdk-list" role="listbox" id="cmdk-listbox">
                  {filtered.length === 0 ? (
                    <li className="empty" style={{ padding: "24px 12px" }}>Keine Treffer</li>
                  ) : (
                    filtered.map((it, idx) => {
                      const showGroup = it.group !== lastGroup;
                      lastGroup = it.group;
                      const Icon = it.icon;
                      return (
                        <li key={it.key}>
                          {showGroup ? <div className="cmdk-group-label">{it.group}</div> : null}
                          <div
                            id={`cmdk-opt-${it.key}`}
                            role="option"
                            aria-selected={idx === activeIdx}
                            className="cmdk-item"
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={() => go(it.href)}
                          >
                            {Icon ? (
                              <span className="icon">
                                <Icon size={15} />
                              </span>
                            ) : null}
                            <span>{it.label}</span>
                            {idx === activeIdx ? (
                              <span className="cmdk-hint">
                                <CornerDownLeft size={12} />
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
