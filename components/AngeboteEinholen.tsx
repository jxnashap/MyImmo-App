"use client";

// Im Vorgang (/anliegen, aufgeklappt): Angebote bei Firmen aus dem eigenen Verzeichnis einholen,
// eingegangene Angebote vergleichen, eines beauftragen (02.10.2026, Handwerker-Anfragen Stufe 1).
// MyImmo verschickt hier keine Mail selbst — der Vermieter bekommt je Firma einen Link und einen
// vorbereiteten Mail-Entwurf. Der Mieter-Kontakt geht erst beim Beauftragen mit, und nur mit Haken.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Copy, Mail, Check } from "lucide-react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { teilbarerLink } from "@/lib/appUrl";
import { fordereAngeboteAn, zieheAnfrageZurueck, beauftrageAngebot } from "@/lib/actions/angebote";
import { aktuelleAngebote, anfrageMail, angebotPfad, mailtoLink, MAX_FIRMEN, type Angebotsanfrage } from "@/lib/angebote";

export type AngebotFirma = { id: string; name: string; gewerk: string | null; email: string | null };

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const datumDe = (s: string) => s.slice(0, 10).split("-").reverse().join(".");

const STATUS: Record<string, { label: string; cls: string }> = {
  angefragt: { label: "angefragt", cls: "badge-amber" },
  beauftragt: { label: "beauftragt", cls: "badge-green" },
  abgelehnt: { label: "nicht gewählt", cls: "badge-neutral" },
  zurueckgezogen: { label: "zurückgezogen", cls: "badge-neutral" },
};

export default function AngeboteEinholen({
  anliegenId, titel, beschreibung, firmen, anfragen, kostengrenze, auftragTokens, mieterKontakt, absender,
}: {
  anliegenId: string;
  titel: string;
  beschreibung: string | null;
  firmen: AngebotFirma[];
  anfragen: Angebotsanfrage[];
  kostengrenze: number | null;
  /** auftrag_id → public_token des Auftrags (für den Auftrags-Link an die Firma). */
  auftragTokens: Record<string, string>;
  /** Der Vorgang hat einen Mieter, dessen Kontakt beim Beauftragen geteilt werden KÖNNTE. */
  mieterKontakt: boolean;
  absender: string | null;
}) {
  const [formOffen, setFormOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const firmaVon = (id: string) => firmen.find((f) => f.id === id);
  const laufend = new Set(anfragen.filter((q) => q.status === "angefragt").map((q) => q.firma_id));
  const vergleich = aktuelleAngebote(anfragen.filter((q) => q.status === "angefragt"));
  const entschieden = anfragen.some((q) => q.status === "beauftragt");

  const anfragen_senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      try {
        const r = await fordereAngeboteAn(fd);
        const f = actionFehler(r);
        if (f) return setFehler(f);
        toast(`Anfrage für ${"neu" in r ? r.neu : 0} Firma/Firmen angelegt — jetzt die Links verschicken ✓`);
        setFormOffen(false);
        router.refresh();
      } catch {
        setFehler("Die Anfrage konnte nicht gespeichert werden.");
      }
    });

  const zurueckziehen = (id: string) =>
    startTransition(async () => {
      try {
        const f = actionFehler(await zieheAnfrageZurueck(id));
        if (f) return toast(f, "error");
        toast("Anfrage zurückgezogen — der Link gilt nicht mehr.");
        router.refresh();
      } catch {
        toast("Zurückziehen fehlgeschlagen.", "error");
      }
    });

  const beauftragen = (fd: FormData) =>
    startTransition(async () => {
      try {
        const f = actionFehler(await beauftrageAngebot(fd));
        if (f) return toast(f, "error");
        toast("Auftrag angelegt — schick der Firma jetzt den Auftrags-Link ✓");
        router.refresh();
      } catch {
        toast("Beauftragen fehlgeschlagen.", "error");
      }
    });

  const kopiere = async (schluessel: string, pfad: string) => {
    try {
      await navigator.clipboard.writeText(teilbarerLink(pfad));
      setKopiert(schluessel);
      setTimeout(() => setKopiert(null), 1500);
    } catch {
      toast("Kopieren nicht möglich — Link bitte manuell markieren.", "error");
    }
  };

  return (
    <div style={{ marginTop: 8, padding: 12, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <FileSignature size={12} style={{ verticalAlign: "-2px" }} /> Angebote einholen
      </div>

      {anfragen.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          {anfragen.map((q) => {
            const f = firmaVon(q.firma_id);
            const st = STATUS[q.status] ?? STATUS.angefragt;
            const letztes = aktuelleAngebote([q])[0]?.angebot;
            const mail = anfrageMail({ firma: f?.name ?? "", titel, link: teilbarerLink(angebotPfad(q.public_token)), absender });
            const auftragToken = q.auftrag_id ? auftragTokens[q.auftrag_id] : undefined;
            return (
              <div key={q.id} style={{ fontSize: 12, padding: "8px 10px", background: "var(--bg2)", borderRadius: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{f?.name ?? "Firma"}</strong>
                  {f?.gewerk && <span style={{ color: "var(--muted)" }}>{f.gewerk}</span>}
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                  {q.status === "angefragt" && !letztes && <span style={{ color: "var(--faint)" }}>noch kein Angebot · Link bis {datumDe(q.token_ablauf)}</span>}
                  {q.status === "angefragt" && (
                    <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                      <a className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} href={mailtoLink(f?.email ?? null, mail.betreff, mail.text)}>
                        <Mail size={12} style={{ verticalAlign: "-2px" }} /> Mail-Entwurf
                      </a>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => kopiere(q.id, angebotPfad(q.public_token))}>
                        {kopiert === q.id ? <><Check size={12} /> Kopiert</> : <><Copy size={12} style={{ verticalAlign: "-2px" }} /> Link</>}
                      </button>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "var(--red)" }} disabled={pending} onClick={() => zurueckziehen(q.id)}>
                        Zurückziehen
                      </button>
                    </span>
                  )}
                  {q.status === "beauftragt" && auftragToken && (
                    <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                      <a className="btn btn-outline" style={{ fontSize: 11, padding: "4px 10px" }}
                        href={mailtoLink(f?.email ?? null, `Auftrag: ${titel}`, `Guten Tag,\n\nvielen Dank für Ihr Angebot — hiermit beauftrage ich Sie. Alle Einzelheiten:\n${teilbarerLink(`/auftrag/${auftragToken}`)}\n\n${absender ?? ""}`.trimEnd())}>
                        <Mail size={12} style={{ verticalAlign: "-2px" }} /> Auftrag senden
                      </a>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => kopiere(`a-${q.id}`, `/auftrag/${auftragToken}`)}>
                        {kopiert === `a-${q.id}` ? <><Check size={12} /> Kopiert</> : <><Copy size={12} style={{ verticalAlign: "-2px" }} /> Auftrags-Link</>}
                      </button>
                    </span>
                  )}
                </div>
                {letztes && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontWeight: 600 }}>{euro(letztes.betrag)}</span>
                    {letztes.termin && <span style={{ color: "var(--muted)" }}> · ab {datumDe(letztes.termin)}</span>}
                    {letztes.firma && <span style={{ color: "var(--muted)" }}> · {letztes.firma}</span>}
                    {letztes.kontakt && <span style={{ color: "var(--muted)" }}> · {letztes.kontakt}</span>}
                    {kostengrenze != null && letztes.betrag <= kostengrenze && <span className="badge badge-teal" style={{ marginLeft: 6 }}>innerhalb deiner Kostengrenze</span>}
                    {letztes.nachricht && <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", color: "var(--muted)" }}>{letztes.nachricht}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {vergleich.length > 0 && !entschieden && (
        <form action={beauftragen} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <select name="angebotId" className="input" style={{ width: "auto", fontSize: 12 }} defaultValue={vergleich[0].angebot.id}>
            {vergleich.map(({ anfrage, angebot }) => (
              <option key={angebot.id} value={angebot.id}>
                {firmaVon(anfrage.firma_id)?.name ?? angebot.firma} — {euro(angebot.betrag)}
              </option>
            ))}
          </select>
          {mieterKontakt && (
            <label style={{ fontSize: 11.5, display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" name="mieterKontakt" /> Mieter-Kontakt für die Terminabsprache teilen
            </label>
          )}
          <button type="submit" className="btn btn-gold" style={{ fontSize: 12 }} disabled={pending}>Beauftragen</button>
          <span style={{ fontSize: 11, color: "var(--faint)", flexBasis: "100%" }}>
            Die übrigen Anfragen werden dabei geschlossen; ihre Links gelten danach nicht mehr.
          </span>
        </form>
      )}

      {firmen.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          Lege zuerst Firmen im Reiter <strong>Service</strong> an (Firmenverzeichnis) — an sie gehen die Anfragen.
        </p>
      ) : entschieden ? null : !formOffen ? (
        <button type="button" className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => setFormOffen(true)}>
          <FileSignature size={13} style={{ verticalAlign: "-2px" }} /> Angebote anfragen
        </button>
      ) : (
        <form action={anfragen_senden} style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="anliegenId" value={anliegenId} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {firmen.map((f) => (
              <label key={f.id} style={{ fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center", opacity: laufend.has(f.id) ? 0.5 : 1 }}>
                <input type="checkbox" name="firmaId" value={f.id} disabled={laufend.has(f.id)} />
                {f.name}{f.gewerk ? ` (${f.gewerk})` : ""}{laufend.has(f.id) ? " — läuft" : ""}
              </label>
            ))}
          </div>
          <input name="titel" className="input" maxLength={200} defaultValue={titel} required />
          <textarea name="beschreibung" className="input" rows={3} maxLength={4000} defaultValue={beschreibung ?? ""} />
          <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
            Dieser Text geht an fremde Firmen. <strong>Prüfe ihn — keine Namen, Telefonnummern oder
            Klingelschilder des Mieters.</strong> Objekt und Adresse werden mitgeschickt, damit die Firma
            kalkulieren kann. Höchstens {MAX_FIRMEN} Firmen.
          </p>
          {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-gold" style={{ fontSize: 12 }} disabled={pending}>{pending ? "…" : "Anfrage anlegen"}</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setFormOffen(false)}>Abbrechen</button>
          </div>
        </form>
      )}
    </div>
  );
}
