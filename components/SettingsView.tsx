"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User, Landmark, ShieldCheck, FileText, Download, Upload, Trash2, Plus, Star,
  Lock, ExternalLink, X, Check, TriangleAlert, PenLine, Sparkles, CreditCard,
  PartyPopper, type LucideIcon,
} from "lucide-react";
import { TOUR_EVENT } from "@/components/OnboardingTour";
import SignaturPad from "@/components/SignaturPad";
import { speichereUnterschrift, loescheUnterschrift } from "@/lib/actions/bewerber";
import { useToast } from "@/components/Toast";
import Switch from "@/components/ui/Switch";
import { KEY_MIN, KEY_CLOSE, AUTOLOGOUT_EVENT } from "@/components/AutoLogout";
import { createClient } from "@/lib/supabase/client";
import { saveVermieter } from "@/lib/actions/vermieter";
import { addIban, deleteIban, setStandardIban } from "@/lib/actions/ibans";
import { deleteAccount } from "@/lib/actions/account";
import { starteCheckout, oeffneAboPortal } from "@/lib/actions/billing";
import { isValidIban, normalizeIban } from "@/lib/iban";
import { PREISE_SICHTBAR } from "@/lib/preise";
import { wechslePasswort } from "@/lib/passwortWechsel";
import type { VermieterProfil, Iban } from "@/lib/types";

// Anzeige-Daten des Abos (Server lädt, Client zeigt nur an).
export type AboAnzeige = {
  plan: string;
  planName: string;
  status: string;
  zyklus: string | null;
  gueltigBis: string | null;
  storniertZum: string | null;
  hatPortal: boolean;
} | null;

type TabKey = "profil" | "bank" | "abo" | "sicherheit" | "recht";
// Der Abo-Tab hängt am selben Schalter wie alle anderen Preis-Stellen: Solange
// die Tarife app-weit ausgeblendet sind (PREISE_SICHTBAR=false, Bezahlsystem
// inaktiv), erscheint kein verwaister Abrechnungsbereich, der nichts tut.
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "profil", label: "Profil", icon: User },
  { key: "bank", label: "Bankkonten", icon: Landmark },
  ...(PREISE_SICHTBAR ? [{ key: "abo" as const, label: "Abo", icon: CreditCard }] : []),
  { key: "sicherheit", label: "Sicherheit", icon: ShieldCheck },
  { key: "recht", label: "Daten & Recht", icon: FileText },
];

const fmtIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

export default function SettingsView({
  profil,
  ibans,
  email,
  provider,
  unterschrift,
  abo = null,
  einheiten = 0,
  billingEnforced = false,
}: {
  profil: VermieterProfil | null;
  ibans: Iban[];
  email?: string | null;
  provider?: string | null;
  unterschrift?: string | null;
  abo?: AboAnzeige;
  einheiten?: number;
  billingEnforced?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("profil");
  const tabsRef = useRef<HTMLDivElement>(null);

  // Pfeiltasten-Navigation der Tabs (Barrierefreiheit).
  function onTabKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
    setTab(TABS[next].key);
    const btns = tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    btns?.[next]?.focus();
  }

  const initialen = useMemo(() => {
    const base = (profil?.name || email || "").trim();
    if (!base) return "··";
    const teile = base.split(/\s+|@/).filter(Boolean);
    return ((teile[0]?.[0] ?? "") + (teile[1]?.[0] ?? "")).toUpperCase() || base.slice(0, 2).toUpperCase();
  }, [profil?.name, email]);

  return (
    <div className="settings-wrap fade-up">
      <div className="settings-head">
        <div className="settings-avatar" aria-hidden>{initialen}</div>
        <div className="who">
          <div className="topbar-kicker" style={{ marginBottom: 6 }}>Konto · Einstellungen</div>
          <h1>Einstellungen</h1>
          {email && <p title={email}>{email}</p>}
        </div>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Einstellungsbereiche" ref={tabsRef}>
        {TABS.map((t, i) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              tabIndex={active ? 0 : -1}
              className={`settings-tab${active ? " active" : ""}`}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <Icon size={15} strokeWidth={2} /> {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} key={tab} className="set-panel">
        {tab === "profil" && <ProfilPanel profil={profil} unterschrift={unterschrift ?? null} />}
        {tab === "bank" && <BankPanel ibans={ibans} />}
        {tab === "abo" && <AboPanel abo={abo} einheiten={einheiten} enforced={billingEnforced} />}
        {tab === "sicherheit" && <SicherheitPanel email={email} provider={provider} />}
        {tab === "recht" && <RechtPanel />}
      </div>

      <DangerZone />
    </div>
  );
}

// IntersectionObserver: blendet .reveal-Elemente beim Scrollen sanft ein.
function useReveal(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
  return ref;
}

// ---------- Profil & Absender ----------
function ProfilPanel({ profil, unterschrift }: { profil: VermieterProfil | null; unterschrift: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const ref = useReveal(null);

  const init = {
    name: profil?.name ?? "",
    strasse: profil?.strasse ?? "",
    plz: profil?.plz ?? "",
    ort: profil?.ort ?? "",
    email: profil?.email ?? "",
    telefon: profil?.telefon ?? "",
  };
  const [form, setForm] = useState(init);
  const dirty = JSON.stringify(form) !== JSON.stringify(init);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function speichern() {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    start(async () => {
      await saveVermieter(fd);
      toast("Gespeichert ✓");
      router.refresh();
    });
  }

  const F = ({ k, label, type = "text", placeholder, span2 }: { k: keyof typeof form; label: string; type?: string; placeholder?: string; span2?: boolean }) => (
    <label className={`set-field${span2 ? " span2" : ""}`}>
      <span>{label}</span>
      <input className="set-input" type={type} value={form[k]} onChange={set(k)} placeholder={placeholder} />
    </label>
  );

  return (
    <div ref={ref}>
      <div className="glass-card reveal">
        <h2><User size={16} /> Profil &amp; Absender</h2>
        <p className="sub">Diese Daten erscheinen im Briefkopf und in der Fußzeile deiner Dokumente (NK-Abrechnung, Mahnung, Kündigung).</p>
        <div className="set-grid">
          {F({ k: "name", label: "Name / Firma", placeholder: "Max Mustermann", span2: true })}
          {F({ k: "strasse", label: "Straße & Hausnr.", placeholder: "Eigentümerweg 12", span2: true })}
          {F({ k: "plz", label: "PLZ", placeholder: "20095" })}
          {F({ k: "ort", label: "Ort", placeholder: "Hamburg" })}
          {F({ k: "email", label: "E-Mail", type: "email", placeholder: "max@example.de" })}
          {F({ k: "telefon", label: "Telefon", placeholder: "040 1234567" })}
        </div>
      </div>

      <SignaturPanel unterschrift={unterschrift} />

      {dirty && (
        <div className="save-bar" role="status">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Ungespeicherte Änderungen</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(init)} disabled={pending}>Verwerfen</button>
            <button type="button" className="btn btn-gold" onClick={speichern} disabled={pending}>{pending ? "Speichern…" : "Speichern"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- E-Signatur (digitale Unterschrift für generierte Dokumente) ----------
function SignaturPanel({ unterschrift }: { unterschrift: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [neu, setNeu] = useState<string | null>(null);
  const [zeichnen, setZeichnen] = useState(false);
  const [pending, start] = useTransition();

  const speichern = () =>
    start(async () => {
      if (!neu) return;
      const r = await speichereUnterschrift(neu);
      if (r?.error) toast(r.error);
      else {
        toast("Unterschrift gespeichert ✓");
        setZeichnen(false);
        setNeu(null);
        router.refresh();
      }
    });

  return (
    <div className="glass-card reveal" style={{ marginTop: 16 }}>
      <h2><PenLine size={16} /> E-Signatur</h2>
      <p className="sub">
        Deine Unterschrift wird auf Wunsch in generierte Dokumente eingebettet
        (Mietquittung, Bescheinigungen, Briefe) — praktisch, wenn du nicht vor Ort
        unterschreiben kannst.
      </p>
      {unterschrift && !zeichnen && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={unterschrift} alt="Gespeicherte Unterschrift" style={{ maxWidth: 240, maxHeight: 90, background: "#fff", borderRadius: 8, border: "1px solid var(--line)", padding: 6 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setZeichnen(true)}>Neu zeichnen</button>
            <button
              type="button" className="btn btn-ghost" style={{ fontSize: 12, color: "var(--red)" }} disabled={pending}
              onClick={() => start(async () => { await loescheUnterschrift(); toast("Unterschrift gelöscht"); router.refresh(); })}
            >
              Löschen
            </button>
          </div>
        </div>
      )}
      {(!unterschrift || zeichnen) && (
        <div style={{ maxWidth: 460, display: "grid", gap: 10 }}>
          <SignaturPad onChange={setNeu} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} disabled={pending || !neu} onClick={speichern}>
              {pending ? "Speichern…" : "Unterschrift speichern"}
            </button>
            {zeichnen && <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setZeichnen(false); setNeu(null); }}>Abbrechen</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Bankkonten ----------
function BankPanel({ ibans }: { ibans: Iban[] }) {
  const router = useRouter();
  const toast = useToast();
  const ref = useReveal(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Standard zuerst, dann nach Anlage.
  const sortiert = [...ibans].sort((a, b) => (b.standard ? 1 : 0) - (a.standard ? 1 : 0));

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const iban = normalizeIban(String(fd.get("iban") ?? ""));
    if (!String(fd.get("kontoname") ?? "").trim()) return setError("Bitte eine Bezeichnung angeben.");
    if (!isValidIban(iban)) return setError("Die IBAN ist nicht korrekt – bitte prüfen.");
    if (ibans.some((x) => normalizeIban(x.iban) === iban)) return setError("Diese IBAN ist bereits hinterlegt.");
    setSaving(true);
    try {
      const res = await addIban(fd);
      if (!res?.ok) return setError(res?.error ?? "Speichern fehlgeschlagen.");
      form.reset();
      toast("Konto hinzugefügt ✓");
      router.refresh();
    } catch (err) {
      setError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
      console.error("addIban:", err);
    } finally {
      setSaving(false);
    }
  }

  async function macheStandard(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await setStandardIban(id);
      if (res?.ok) { toast("Standardkonto gesetzt ✓"); router.refresh(); }
    } finally { setBusy(null); }
  }

  async function entferne(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await deleteIban(id);
      if (res?.ok) { toast("Konto entfernt"); router.refresh(); }
    } finally { setBusy(null); }
  }

  return (
    <div ref={ref}>
      <div className="glass-card reveal">
        <h2><Landmark size={16} /> Bankkonten</h2>
        <p className="sub">Hinterlege ein oder mehrere Konten. In Dokumenten (Mahnung, NK-Abrechnung …) erscheint das gewählte Konto als Zahlungshinweis. Das <strong>Standardkonto</strong> ist vorausgewählt.</p>

        {sortiert.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {sortiert.map((x) => (
              <div key={x.id} className={`bank-card${x.standard ? " is-standard" : ""}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{x.kontoname}</span>
                    {x.standard && <span className="badge badge-gold" style={{ fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3 }}><Star size={10} /> Standard</span>}
                  </div>
                  {x.inhaber && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{x.inhaber}</div>}
                  <div className="bank-iban" style={{ marginTop: 2 }}>{fmtIban(x.iban)}</div>
                </div>
                {!x.standard && (
                  <button type="button" className="icon-btn" title="Als Standard markieren" disabled={busy === x.id} onClick={() => macheStandard(x.id)}>
                    <Star size={15} />
                  </button>
                )}
                <button type="button" className="icon-btn danger" title="Konto entfernen" disabled={busy === x.id} onClick={() => entferne(x.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="sub" style={{ marginBottom: 18 }}>Noch keine Konten hinterlegt.</p>
        )}

        <form ref={formRef} onSubmit={onAdd} className="set-grid" style={{ borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <label className="set-field">
            <span>Bezeichnung *</span>
            <input name="kontoname" className="set-input" placeholder="z. B. Mietkonto" required />
          </label>
          <label className="set-field">
            <span>Kontoinhaber</span>
            <input name="inhaber" className="set-input" placeholder="Max Mustermann" />
          </label>
          <label className="set-field span2">
            <span>IBAN *</span>
            <input name="iban" className="set-input" placeholder="DE12 3456 7890 1234 5678 90" style={{ textTransform: "uppercase" }} onChange={() => error && setError(null)} required />
          </label>
          {error && (
            <div className="span2" role="alert" style={{ background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
              <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {error}
            </div>
          )}
          <div className="span2">
            <button className="btn btn-gold" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={15} /> {saving ? "Speichern…" : "Konto hinzufügen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Sicherheit ----------
function SicherheitPanel({ email, provider }: { email?: string | null; provider?: string | null }) {
  const supabase = createClient();
  const toast = useToast();
  const ref = useReveal(null);
  const istGoogle = !!provider && provider !== "email";
  const [pw0, setPw0] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function aendern(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    // Hier stand noch die alte 6-Zeichen-Regel, waehrend der Rest der App
    // laengst 8 verlangt — und das aktuelle Passwort wurde gar nicht abgefragt.
    // Beides liegt jetzt in lib/passwortWechsel.ts.
    const erg = await wechslePasswort(supabase, {
      email: email ?? "", aktuell: pw0, neu: pw1, wiederholung: pw2, istGoogle,
    });
    setSaving(false);
    if (!erg.ok) return setErr(erg.fehler);
    setPw0(""); setPw1(""); setPw2("");
    toast("Passwort geändert ✓");
  }

  return (
    <div ref={ref}>
      <div className="glass-card reveal">
        <h2><Lock size={16} /> Passwort ändern</h2>
        <p className="sub">
          Ändere das Passwort für dein Konto{email ? ` (${email})` : ""}.
          {istGoogle && " Du meldest dich aktuell mit Google an – hier kannst du zusätzlich ein Passwort setzen, um dich auch per E-Mail anzumelden."}
        </p>
        <form onSubmit={aendern} className="set-grid">
          {!istGoogle && (
            <label className="set-field span2">
              <span>Aktuelles Passwort</span>
              <input className="set-input" type="password" value={pw0} autoComplete="current-password" onChange={(e) => { setPw0(e.target.value); err && setErr(null); }} />
              <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                Zur Bestätigung — damit niemand über eine offene Sitzung dein Passwort ändern kann.
              </span>
            </label>
          )}
          <label className="set-field">
            <span>Neues Passwort</span>
            <input className="set-input" type="password" value={pw1} autoComplete="new-password" onChange={(e) => { setPw1(e.target.value); err && setErr(null); }} />
          </label>
          <label className="set-field">
            <span>Wiederholen</span>
            <input className="set-input" type="password" value={pw2} autoComplete="new-password" onChange={(e) => { setPw2(e.target.value); err && setErr(null); }} />
          </label>
          {err && (
            <div className="span2" role="alert" style={{ background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
              <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {err}
            </div>
          )}
          <div className="span2">
            <button className="btn btn-gold" disabled={saving}>{saving ? "Speichern…" : "Passwort ändern"}</button>
          </div>
        </form>
      </div>

      <AutoLogoutKarte />
    </div>
  );
}

// Automatische Abmeldung (clientseitig, localStorage — wirkt sofort ohne Reload).
function AutoLogoutKarte() {
  const toast = useToast();
  const [minuten, setMinuten] = useState("0");
  const [beimSchliessen, setBeimSchliessen] = useState(false);

  useEffect(() => {
    setMinuten(localStorage.getItem(KEY_MIN) || "0");
    setBeimSchliessen(localStorage.getItem(KEY_CLOSE) === "1");
  }, []);

  const uebernehmen = () => window.dispatchEvent(new Event(AUTOLOGOUT_EVENT));

  return (
    <div className="glass-card reveal" style={{ marginTop: 18 }}>
      <h2><Lock size={16} /> Automatische Abmeldung</h2>
      <p className="sub">
        Meldet dich auf diesem Gerät nach Inaktivität automatisch ab — auch wenn der
        Browser zwischendurch geschlossen oder in den Hintergrund gelegt wurde.
      </p>
      <div className="set-grid">
        <label className="set-field">
          <span>Nach Inaktivität abmelden</span>
          <select
            className="set-input"
            value={minuten}
            onChange={(e) => {
              setMinuten(e.target.value);
              localStorage.setItem(KEY_MIN, e.target.value);
              uebernehmen();
              toast("Gespeichert ✓");
            }}
          >
            <option value="0">Aus</option>
            <option value="5">5 Minuten</option>
            <option value="10">10 Minuten</option>
            <option value="30">30 Minuten</option>
            <option value="60">60 Minuten</option>
          </select>
        </label>
        <label className="set-field" style={{ justifyContent: "flex-end" }}>
          <span>Beim Schließen des Browsers</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <Switch
              checked={beimSchliessen}
              label="Beim Schließen des Browsers abmelden"
              onChange={(next) => {
                setBeimSchliessen(next);
                localStorage.setItem(KEY_CLOSE, next ? "1" : "0");
                uebernehmen();
                toast("Gespeichert ✓");
              }}
            />
            <span style={{ color: "var(--muted)" }}>beim nächsten Öffnen abmelden</span>
          </div>
        </label>
        <p className="span2" style={{ fontSize: 11.5, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
          Der Timer wirkt auf diesem Gerät und ist die Garantie: Wer länger als die gewählte
          Zeit weg war, wird beim Zurückkehren sofort abgemeldet. „Beim Schließen" meldet dich
          ab, sobald du den Browser nach dem Schließen wieder öffnest — Reloads und normale
          Navigation bleiben angemeldet.
        </p>
      </div>
    </div>
  );
}

// ---------- Daten & Recht ----------
function RechtPanel() {
  const ref = useReveal(null);

  // Einführungs-Tour erneut starten: Event an die (im Layout gemountete) Tour
  // — öffnet sofort, ohne Redirect/Reload.
  function tourStarten() {
    window.dispatchEvent(new Event(TOUR_EVENT));
  }
  const RLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link href={href} className="bank-card" style={{ textDecoration: "none", color: "var(--text)" }}>
      <FileText size={16} style={{ color: "var(--gold)" }} />
      <span style={{ flex: 1, fontSize: 13.5 }}>{children}</span>
      <ExternalLink size={14} style={{ color: "var(--muted)" }} />
    </Link>
  );
  return (
    <div ref={ref}>
      <div className="glass-card reveal">
        <h2><Sparkles size={16} /> Einführungs-Tour</h2>
        <p className="sub">Die kurze Tour durch die App (Objekt anlegen → Mieter → Buchungen → Mietkonto → Archiv → Steuer) jederzeit noch einmal ansehen.</p>
        <button type="button" className="btn btn-gold" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={tourStarten}>
          <Sparkles size={15} /> Tour erneut starten
        </button>
      </div>

      <div className="glass-card reveal">
        <h2><Upload size={16} /> Daten importieren</h2>
        <p className="sub">Du kommst von vermietet.de, objego oder verwaltest bisher in Excel? Importiere Objekte und Mieter per CSV — mit Spalten-Zuordnung und Vorschau; angelegt wird erst nach deiner Bestätigung.</p>
        <Link href="/einstellungen/import" className="btn btn-gold" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Upload size={15} /> Daten importieren (CSV)
        </Link>
      </div>

      <div className="glass-card reveal">
        <h2><Download size={16} /> Meine Daten exportieren</h2>
        <p className="sub">Lade jederzeit ALLE deine Daten herunter (inkl. Mieter, Buchungen und Dokumente) – ohne Sperrfrist, DSGVO-Recht auf Datenübertragbarkeit. Das ZIP enthält alle Tabellen als CSV und JSON plus die Dateien; die Buchungen gibt es zusätzlich als einzelne CSV für Excel/Steuerberater.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/api/export/alles" className="btn btn-gold" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={15} /> Alle Daten inkl. Dateien (ZIP)
          </a>
          <a href="/api/export/buchungen" className="btn btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={15} /> Nur Buchungen (CSV)
          </a>
        </div>
      </div>

      <div className="glass-card reveal">
        <h2><FileText size={16} /> Rechtliches</h2>
        <p className="sub">Datenschutz, Auftragsverarbeitung und Anbieterkennzeichnung.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <RLink href="/agb">Allgemeine Geschäftsbedingungen (AGB)</RLink>
          <RLink href="/datenschutz">Datenschutzerklärung</RLink>
          <RLink href="/avv">Auftragsverarbeitungsvertrag (AVV)</RLink>
          <RLink href="/impressum">Impressum</RLink>
        </div>
      </div>
    </div>
  );
}

// ---------- Abo & Tarif ----------
// Bezahlsystem ist GEBAUT, aber inaktiv (Early Access): ohne BILLING_ENFORCED
// zeigt das Panel nur den Early-Access-Hinweis. Nach Aktivierung erscheinen
// Upgrade-Buttons (Paddle-Checkout) bzw. das Kundenportal (Zahlung/Kündigung).
function AboPanel({ abo, einheiten, enforced }: { abo: AboAnzeige; einheiten: number; enforced: boolean }) {
  const ref = useReveal(null);
  const toast = useToast();
  const [zyklus, setZyklus] = useState<"monat" | "jahr">("jahr");
  const [pending, startTransition] = useTransition();

  const zumCheckout = (plan: "privat" | "plus") =>
    startTransition(async () => {
      const res = await starteCheckout(plan, zyklus);
      if ("url" in res) window.location.href = res.url;
      else toast(res.fehler, "error");
    });

  const zumPortal = () =>
    startTransition(async () => {
      const res = await oeffneAboPortal();
      if ("url" in res) window.location.href = res.url;
      else toast(res.fehler, "error");
    });

  const datum = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

  const zahlend = !!abo && abo.plan !== "kostenlos" && ["aktiv", "testphase", "ueberfaellig"].includes(abo.status);

  return (
    <div ref={ref}>
      {!enforced ? (
        <div className="glass-card reveal">
          <h2><PartyPopper size={16} /> Early Access — alles kostenlos</h2>
          <p className="sub">
            Während der Startphase steht der volle Funktionsumfang kostenlos zur Verfügung.
            Bezahltarife werden rechtzeitig angekündigt — dein Konto wird dann NICHT automatisch
            kostenpflichtig, du wählst selbst, ob und welchen Tarif du buchst.
          </p>
          <p className="sub" style={{ marginBottom: 12 }}>
            Aktuell erfasst: <strong style={{ color: "var(--text)" }}>{einheiten}</strong>{" "}
            {einheiten === 1 ? "Einheit" : "Einheiten"}.
          </p>
          {PREISE_SICHTBAR && (
            <Link href="/preise" className="btn btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CreditCard size={15} /> Geplante Tarife ansehen
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="glass-card reveal">
            <h2><CreditCard size={16} /> Dein Tarif</h2>
            <p className="sub">
              <strong style={{ color: "var(--text)" }}>{abo?.planName ?? "Kostenlos"}</strong>
              {abo?.zyklus ? ` · ${abo.zyklus === "jahr" ? "Jahreszahlung" : "Monatszahlung"}` : ""}              {" — "}{einheiten} {einheiten === 1 ? "Einheit" : "Einheiten"} erfasst.
            </p>
            {abo?.storniertZum && (
              <p className="sub" style={{ color: "var(--red)" }}>
                Gekündigt zum {datum(abo.storniertZum)} — bis dahin bleibt alles nutzbar.
              </p>
            )}
            {!abo?.storniertZum && abo?.gueltigBis && zahlend && (
              <p className="sub">Nächste Verlängerung: {datum(abo.gueltigBis)}.</p>
            )}
            {zahlend && abo?.hatPortal && (
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={zumPortal}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ExternalLink size={15} /> Zahlung & Kündigung verwalten
              </button>
            )}
          </div>

          {!zahlend && (
            <div className="glass-card reveal">
              <h2><Star size={16} /> Tarif wählen</h2>
              <p className="sub">Abrechnung und Rechnungen laufen über unseren Zahlungsanbieter Paddle; die Zahlung ist jederzeit im Kundenportal kündbar.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button type="button" className={`btn ${zyklus === "monat" ? "btn-gold" : "btn-ghost"}`} onClick={() => setZyklus("monat")}>Monatlich</button>
                <button type="button" className={`btn ${zyklus === "jahr" ? "btn-gold" : "btn-ghost"}`} onClick={() => setZyklus("jahr")}>Jährlich (≈ 2 Monate gespart)</button>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-gold" disabled={pending} onClick={() => zumCheckout("privat")}>
                  MyImmo Privat — {zyklus === "jahr" ? "79 €/Jahr" : "7,99 €/Monat"}
                </button>
                <button type="button" className="btn btn-gold" disabled={pending} onClick={() => zumCheckout("plus")}>
                  MyImmo Plus — {zyklus === "jahr" ? "129 €/Jahr" : "12,99 €/Monat"}
                </button>
                {PREISE_SICHTBAR && <Link href="/preise" className="btn btn-ghost">Alle Tarife vergleichen</Link>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Gefahrenzone + Lösch-Modal ----------
function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const darf = confirmText.trim().toUpperCase() === "LÖSCHEN";
  // Fehler der Server-Action im Modal zeigen — nicht auf app/error.tsx landen.
  const [loeschFehler, setLoeschFehler] = useState<string | null>(null);

  // ESC schließt das Modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="danger-zone">
      <button type="button" className="danger-link" onClick={() => setOpen(true)}>Konto löschen</button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)} role="dialog" aria-modal="true" aria-label="Konto löschen">
          <div className="modal-sheet" style={{ textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h2 style={{ fontSize: 17, display: "flex", alignItems: "center", gap: 8, color: "var(--red)" }}><Trash2 size={18} /> Konto löschen</h2>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} title="Schließen"><X size={16} /></button>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
              Löscht dein Konto und <strong style={{ color: "var(--text)" }}>unwiderruflich</strong> alle Daten – Immobilien, Mieter, Buchungen, Kredite, Dokumente und Einstellungen. Exportiere vorher bei Bedarf deine Daten.
            </p>
            <form
              action={async () => {
                setLoeschFehler(null);
                const res = await deleteAccount();
                // Erfolg endet in einem redirect — hier kommt nur ein Fehler an.
                if (res && res.ok === false) setLoeschFehler(res.fehler);
              }}
            >
              <label className="set-field" style={{ marginBottom: 16 }}>
                <span>Zum Bestätigen <strong>LÖSCHEN</strong> eingeben</span>
                <input className="set-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="LÖSCHEN" autoFocus />
              </label>
              {loeschFehler && (
                <p style={{ fontSize: 13, color: "var(--red)", lineHeight: 1.6, marginBottom: 14 }}>
                  {loeschFehler}
                </p>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Abbrechen</button>
                <button type="submit" disabled={!darf} className="btn" style={{ background: "var(--red)", color: "#fff", opacity: darf ? 1 : 0.4, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Check size={15} /> Endgültig löschen
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
