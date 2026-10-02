"use client";

// Einstellungen → Vertreter (02.10.2026). Stammdaten einer Vertrauensperson, die für den
// Vermieter bei Bank und Notar handelt, plus Vollmacht (Art, Form, Beglaubigung, Gültigkeit,
// Original, Scan). Kein App-Zugang — das steht ausdrücklich im Kopf, damit niemand glaubt,
// der Vertreter könne sich jetzt anmelden.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Plus, Pencil, Trash2, FileText, TriangleAlert, Info } from "lucide-react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { speichereVertreter, entferneVertreter } from "@/lib/actions/vertreter";
import {
  VOLLMACHT_ARTEN, VOLLMACHT_FORMEN, vollmachtHinweise, vollmachtStatus, vertreterName,
  type Vertreter,
} from "@/lib/vertreter";

const STATUS_BADGE = {
  gueltig: { label: "gültig", cls: "badge-green" },
  laeuft_ab: { label: "läuft bald ab", cls: "badge-amber" },
  abgelaufen: { label: "abgelaufen", cls: "badge-red" },
  widerrufen: { label: "widerrufen", cls: "badge-neutral" },
} as const;

const datumDe = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join(".") : "");

function Feld({ label, name, wert, typ = "text", span2 = false, max, platzhalter }: {
  label: string; name: string; wert?: string | null; typ?: string; span2?: boolean; max?: number; platzhalter?: string;
}) {
  return (
    <label className={`set-field${span2 ? " span2" : ""}`}>
      <span>{label}</span>
      <input name={name} type={typ} className="set-input" defaultValue={wert ?? ""} maxLength={max} placeholder={platzhalter} />
    </label>
  );
}

function VertreterForm({ v, demo, fertig }: { v: Vertreter | null; demo: boolean; fertig: () => void }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      if (demo) return setFehler("In der Demo wird nichts gespeichert.");
      try {
        const f = actionFehler(await speichereVertreter(fd));
        if (f) return setFehler(f);
        toast(v ? "Vertreter gespeichert ✓" : "Vertreter angelegt ✓");
        fertig();
        router.refresh();
      } catch {
        setFehler("Speichern fehlgeschlagen. Ist die Datei kleiner als 8 MB?");
      }
    });

  return (
    <form action={senden} className="set-grid" style={{ borderTop: "1px solid var(--line)", paddingTop: 18, marginTop: 12 }}>
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="span2" style={{ fontWeight: 600, fontSize: 13 }}>Person</div>
      <Feld label="Vorname" name="vorname" wert={v?.vorname} max={100} />
      <label className="set-field">
        <span>Nachname *</span>
        <input name="nachname" className="set-input" defaultValue={v?.nachname ?? ""} maxLength={100} required />
      </label>
      <Feld label="Beziehung" name="beziehung" wert={v?.beziehung} max={100} platzhalter="z. B. Bruder, Steuerberaterin" />
      <Feld label="Geburtsdatum" name="geburtsdatum" wert={v?.geburtsdatum} typ="date" />
      <Feld label="Geburtsort" name="geburtsort" wert={v?.geburtsort} max={100} />
      <Feld label="Telefon" name="telefon" wert={v?.telefon} typ="tel" max={50} />
      <Feld label="E-Mail" name="email" wert={v?.email} typ="email" max={200} span2 />
      <Feld label="Straße, Nr." name="strasse" wert={v?.strasse} max={200} span2 />
      <Feld label="PLZ" name="plz" wert={v?.plz} max={20} />
      <Feld label="Ort" name="ort" wert={v?.ort} max={100} />
      <Feld label="Land" name="land" wert={v?.land} max={100} platzhalter="Deutschland" />

      <div className="span2" style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>Vollmacht</div>
      <label className="set-field">
        <span>Art *</span>
        <select name="vollmacht_art" className="set-input" defaultValue={v?.vollmacht_art ?? "bank"}>
          {Object.entries(VOLLMACHT_ARTEN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="set-field">
        <span>Form *</span>
        <select name="vollmacht_form" className="set-input" defaultValue={v?.vollmacht_form ?? "privatschriftlich"}>
          {Object.entries(VOLLMACHT_FORMEN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="set-field span2">
        <span>Umfang (was darf der Vertreter?)</span>
        <textarea name="umfang" className="set-input" rows={3} maxLength={2000} defaultValue={v?.umfang ?? ""} placeholder="z. B. Darlehensvertrag mit der Musterbank unterschreiben, Originalunterlagen einreichen, Grundschuld bestellen" />
      </label>
      <Feld label="Ausgestellt am" name="ausgestellt_am" wert={v?.ausgestellt_am} typ="date" />
      <Feld label="Gültig bis" name="gueltig_bis" wert={v?.gueltig_bis} typ="date" />
      <Feld label="Beglaubigt durch" name="beglaubigt_durch" wert={v?.beglaubigt_durch} max={200} platzhalter="z. B. Notar Dr. Muster, Deutsches Generalkonsulat Dubai" />
      <Feld label="Original liegt bei" name="original_bei" wert={v?.original_bei} max={200} platzhalter="z. B. Musterbank Filiale Lübeck" />
      <label className="set-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" name="im_ausland_unterzeichnet" defaultChecked={v?.im_ausland_unterzeichnet ?? false} />
        <span style={{ margin: 0 }}>Im Ausland unterschrieben</span>
      </label>
      <label className="set-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" name="apostille" defaultChecked={v?.apostille ?? false} />
        <span style={{ margin: 0 }}>Apostille vorhanden</span>
      </label>
      {v && <Feld label="Widerrufen am" name="widerrufen_am" wert={v.widerrufen_am} typ="date" />}
      <label className="set-field span2">
        <span>Scan der Vollmacht (PDF, JPG, PNG · max. 8 MB){v?.datei_name ? ` — ersetzt „${v.datei_name}“` : ""}</span>
        <input type="file" name="datei" accept="application/pdf,image/jpeg,image/png" className="set-input" />
      </label>
      {v?.datei_name && (
        <label className="set-field span2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="datei_entfernen" />
          <span style={{ margin: 0 }}>Hinterlegten Scan entfernen</span>
        </label>
      )}
      <label className="set-field span2">
        <span>Notiz</span>
        <textarea name="notiz" className="set-input" rows={2} maxLength={2000} defaultValue={v?.notiz ?? ""} />
      </label>
      {fehler && (
        <div className="span2" role="alert" style={{ background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
          <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {fehler}
        </div>
      )}
      <div className="span2" style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-gold" disabled={pending || demo}>{pending ? "Speichern…" : v ? "Speichern" : "Vertreter anlegen"}</button>
        <button type="button" className="btn btn-ghost" onClick={fertig}>Abbrechen</button>
      </div>
    </form>
  );
}

function VertreterKarte({ v, heute, demo, bearbeiten }: { v: Vertreter; heute: string; demo: boolean; bearbeiten: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const status = vollmachtStatus(v, heute);
  const hinweise = vollmachtHinweise(v, heute);
  const adresse = [v.strasse, [v.plz, v.ort].filter(Boolean).join(" "), v.land].filter(Boolean).join(", ");

  const entfernen = () => {
    if (!window.confirm(`${vertreterName(v)} samt Vollmacht-Scan entfernen?`)) return;
    startTransition(async () => {
      try {
        const f = actionFehler(await entferneVertreter(v.id));
        if (f) return toast(f, "error");
        toast("Vertreter entfernt.");
        router.refresh();
      } catch {
        toast("Entfernen fehlgeschlagen.", "error");
      }
    });
  };

  return (
    <div className="bank-card" style={{ alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{vertreterName(v)}</span>
          {v.beziehung && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{v.beziehung}</span>}
          <span className={`badge ${STATUS_BADGE[status].cls}`}>{STATUS_BADGE[status].label}</span>
        </div>
        {adresse && <div style={{ fontSize: 12, color: "var(--muted)" }}>{adresse}</div>}
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {[v.email, v.telefon, v.geburtsdatum ? `geb. ${datumDe(v.geburtsdatum)}${v.geburtsort ? ` in ${v.geburtsort}` : ""}` : null].filter(Boolean).join(" · ")}
        </div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          <strong>{VOLLMACHT_ARTEN[v.vollmacht_art]}</strong> · {VOLLMACHT_FORMEN[v.vollmacht_form]}
          {v.ausgestellt_am && ` · vom ${datumDe(v.ausgestellt_am)}`}
          {v.gueltig_bis && ` · bis ${datumDe(v.gueltig_bis)}`}
          {v.apostille && " · mit Apostille"}
        </div>
        {v.umfang && <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "pre-wrap", marginTop: 2 }}>{v.umfang}</div>}
        {(v.beglaubigt_durch || v.original_bei) && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {[v.beglaubigt_durch && `Beglaubigt: ${v.beglaubigt_durch}`, v.original_bei && `Original bei: ${v.original_bei}`].filter(Boolean).join(" · ")}
          </div>
        )}
        {v.datei_name && (
          <a href={`/einstellungen/vertreter/${v.id}`} target="_blank" rel="noopener" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6 }}>
            <FileText size={12} /> {v.datei_name}
          </a>
        )}
        {hinweise.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 4 }}>
            {hinweise.map((h) => (
              <li key={h.text} style={{ fontSize: 11.5, color: h.art === "warn" ? "var(--red)" : "var(--muted)", display: "flex", gap: 6 }}>
                {h.art === "warn" ? <TriangleAlert size={12} style={{ flexShrink: 0, marginTop: 2 }} /> : <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />}
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className="icon-btn" title="Bearbeiten" onClick={bearbeiten} disabled={demo}><Pencil size={15} /></button>
      <button type="button" className="icon-btn danger" title="Entfernen" onClick={entfernen} disabled={pending || demo}><Trash2 size={15} /></button>
    </div>
  );
}

export default function VertreterPanel({ vertreter, heute, demo = false }: { vertreter: Vertreter[]; heute: string; demo?: boolean }) {
  const [form, setForm] = useState<"neu" | string | null>(null);
  return (
    <div className="glass-card">
      <h2><UserCheck size={16} /> Vertreter</h2>
      <p className="sub">
        Eine Vertrauensperson, die für dich bei Bank oder Notar handelt — z. B. wenn du im Ausland
        bist und Originale vorgelegt oder ein Darlehen unterschrieben werden muss. Hier stehen ihre
        Daten und die Vollmacht beisammen. <strong>Der Vertreter bekommt dadurch keinen Zugang zu MyImmo.</strong>
      </p>
      <p className="sub" style={{ fontSize: 11.5 }}>
        MyImmo bewahrt die Angaben auf und erinnert dich; ob eine Vollmacht im Einzelfall genügt,
        entscheiden Bank, Notar oder Grundbuchamt. Du bleibst für die Daten dieser Person
        verantwortlich — sag ihr, dass sie hier hinterlegt sind.
      </p>

      {vertreter.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "12px 0" }}>
          {vertreter.map((v) =>
            form === v.id
              ? <VertreterForm key={v.id} v={v} demo={demo} fertig={() => setForm(null)} />
              : <VertreterKarte key={v.id} v={v} heute={heute} demo={demo} bearbeiten={() => setForm(v.id)} />,
          )}
        </div>
      ) : (
        form !== "neu" && <p className="sub">Noch kein Vertreter hinterlegt.</p>
      )}

      {form === "neu" ? (
        <VertreterForm v={null} demo={demo} fertig={() => setForm(null)} />
      ) : (
        <button type="button" className="btn btn-gold" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setForm("neu")} disabled={demo}>
          <Plus size={15} /> Vertreter hinzufügen
        </button>
      )}
    </div>
  );
}
