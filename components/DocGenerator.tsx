"use client";
import { Save, FileText } from "lucide-react";

import BriefBlatt from "@/components/BriefBlatt";
import SubmitButton from "@/components/SubmitButton";

import { useState, useTransition } from "react";
import type { Tenant, Property, VermieterProfil, Iban } from "@/lib/types";
import {
  ARTEN,
  TITEL,
  DEFAULT_VORLAGEN,
  PLATZHALTER,
  ART_ZEIGT_BETRAG,
  fuelleVorlage,
  type DocArt,
} from "@/lib/dokumentVorlagen";
import { saveDokumentVorlage, resetDokumentVorlage } from "@/lib/actions/dokumentVorlagen";
import { speichereBrief } from "@/lib/actions/dokumente";
import { useToast } from "@/components/Toast";
import { adressZeilen } from "@/lib/format";

const fmtIban = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();
const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
  " €";
const deDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function DocGenerator({
  tenant,
  property,
  vermieter,
  ibans = [],
  vorlagen = {},
}: {
  tenant: Tenant;
  property: Property | null;
  vermieter: VermieterProfil | null;
  ibans?: Iban[];
  vorlagen?: Record<string, string>;
}) {
  const initialAbsAdr = [
    vermieter?.strasse,
    [vermieter?.plz, vermieter?.ort].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const [art, setArt] = useState<DocArt>("allgemein");
  const [betrag, setBetrag] = useState("");
  const [datum, setDatum] = useState("");
  const [grund, setGrund] = useState("");
  const [ibanId, setIbanId] = useState("");
  const [vName, setVName] = useState(vermieter?.name ?? "");
  const [vAdr, setVAdr] = useState(initialAbsAdr);
  const [vorlageText, setVorlageText] = useState(vorlagen["allgemein"] ?? DEFAULT_VORLAGEN.allgemein);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [ablegen, startAblegen] = useTransition();
  const toast = useToast();

  const zeigtBetrag = ART_ZEIGT_BETRAG.includes(art);
  const selectedIban = ibans.find((x) => x.id === ibanId) ?? null;
  const betragLabel = art === "mieterhoehung" ? "Neue Kaltmiete (€)" : "Offener Betrag (€)";
  const datumLabel =
    art === "mieterhoehung"
      ? "Wirksam ab"
      : art === "kuendigung"
        ? "Kündigung zum"
        : art === "reparatur"
          ? "Termin der Arbeiten"
          : "Zahlbar bis";

  function wechselArt(v: DocArt) {
    setArt(v);
    setVorlageText(vorlagen[v] ?? DEFAULT_VORLAGEN[v] ?? "");
    setSaveState("idle");
  }

  async function speichern() {
    setSaveState("saving");
    try {
      await saveDokumentVorlage(art, vorlageText);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function zuruecksetzen() {
    setVorlageText(DEFAULT_VORLAGEN[art] ?? "");
    setSaveState("idle");
    try {
      await resetDokumentVorlage(art);
    } catch {
      /* ignore */
    }
  }

  // --- Werte für Platzhalter (identisch zur PDF-Route) ---
  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  const objekt = property
    ? `${property.bezeichnung}${tenant.einheit ? ", " + tenant.einheit : ""}${property.adresse ? ", " + property.adresse : ""}`
    : "–";
  const miete = tenant.kaltmiete ?? 0;
  const betragNum = parseFloat(betrag) || 0;
  const fallbackMiete = art === "zahlungserinnerung" || art === "mahnung";
  const effBetrag = betragNum > 0 ? betragNum : fallbackMiete ? miete : 0;

  const werte: Record<string, string> = {
    mieter: mieterName || "–",
    objekt,
    betrag: effBetrag > 0 ? eur(effBetrag) : "",
    miete: miete > 0 ? eur(miete) : "",
    datum: deDate(datum),
    grund: grund.trim(),
    mieterkonto: tenant.iban ? fmtIban(tenant.iban) : "",
  };
  const absaetze = fuelleVorlage(vorlageText, werte);

  // --- Vorschau-Daten ---
  const absName = vName || "–";
  const heute = deDate(new Date().toISOString());
  const ortDatum = (vermieter?.ort ? vermieter.ort.replace(/^\d{4,5}\s*/, "") + ", " : "") + heute;
  const empfZeilen = adressZeilen(tenant.mieter_adresse || objekt);
  const titel = TITEL[art];


  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ---------- Eingaben + Vorlagen-Editor ---------- */}
      <div className="form-box no-print" style={{ maxWidth: 460, flex: "1 1 420px" }}>
        <h3>Dokument erstellen</h3>
        <p>Brief an den Mieter — Vorschau rechts, dann als PDF herunterladen.</p>

        {!vermieter && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              background: "rgba(240,160,48,0.1)",
              border: "1px solid rgba(240,160,48,0.3)",
              borderRadius: 7,
              fontSize: 12,
              color: "var(--amber)",
            }}
          >
            Tipp: Hinterlege deinen Absender unter <strong>Einstellungen</strong>, dann ist der
            Briefkopf automatisch gefüllt.
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Dokumentart</label>
            <select value={art} onChange={(e) => wechselArt(e.target.value as DocArt)}>
              {ARTEN.map((a) => (
                <option key={a.v} value={a.v}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{datumLabel}</label>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </div>
        </div>
        {zeigtBetrag && (
          <div className="form-row single">
            <div className="form-group">
              <label>{betragLabel}</label>
              <input
                type="number"
                step="0.01"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
              />
            </div>
          </div>
        )}
        <div className="form-row single">
          <div className="form-group">
            <label>Begründung / Zusatztext (optional)</label>
            <textarea
              rows={2}
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </div>
        </div>

        {/* Vorlagetext bearbeiten + speichern */}
        <div className="form-section-label">Vorlagetext (wird gespeichert)</div>
        <div className="form-group">
          <textarea
            rows={9}
            value={vorlageText}
            onChange={(e) => {
              setVorlageText(e.target.value);
              setSaveState("idle");
            }}
            style={{ resize: "vertical", lineHeight: 1.5 }}
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--faint)", margin: "6px 0 8px", lineHeight: 1.7 }}>
          Platzhalter:{" "}
          {PLATZHALTER.map((p) => (
            <code
              key={p.key}
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--line2)",
                borderRadius: 5,
                padding: "1px 5px",
                marginRight: 5,
                fontSize: 11,
                whiteSpace: "nowrap",
              }}
              title={p.label}
            >{`{{${p.key}}}`}</code>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={speichern} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Speichert…" : <><Save size={14} style={{ verticalAlign: "-2px" }} /> Vorlage speichern</>}
          </button>
          <button type="button" className="btn btn-ghost" onClick={zuruecksetzen}>
            Zurücksetzen
          </button>
          {saveState === "saved" && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Gespeichert</span>}
          {saveState === "error" && <span style={{ fontSize: 12, color: "var(--red)" }}>Fehler beim Speichern</span>}
        </div>

        {zeigtBetrag && (
          <>
            <div className="form-section-label">Zahlungskonto (optional)</div>
            {ibans.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--faint)", padding: "4px 0 8px" }}>
                Noch keine IBANs — unter <strong>Einstellungen</strong> anlegen, dann erscheinen sie
                hier.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {ibans.map((x) => {
                  const sel = x.id === ibanId;
                  return (
                    <div
                      key={x.id}
                      onClick={() => setIbanId(sel ? "" : x.id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 7,
                        border: `1px solid ${sel ? "var(--gold)" : "var(--line2)"}`,
                        background: sel ? "var(--gold-pale)" : "var(--bg3)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          border: `2px solid ${sel ? "var(--gold)" : "var(--line2)"}`,
                          background: sel ? "var(--gold)" : "transparent",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>
                          {x.kontoname}
                          {x.inhaber ? " · " + x.inhaber : ""}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>
                          {fmtIban(x.iban)}
                        </div>
                      </div>
                      {sel && <span style={{ color: "var(--gold)" }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="form-section-label">Absender</div>
        <div className="form-row">
          <div className="form-group">
            <label>Name</label>
            <input value={vName} onChange={(e) => setVName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <input
              value={vAdr}
              onChange={(e) => setVAdr(e.target.value)}
              placeholder="Straße, PLZ Ort"
            />
          </div>
        </div>
      </div>

      {/* ---------- Vorschau: DIN-A4-Brief-Blatt (zugleich Druckvorlage) ---------- */}
      <div style={{ flex: "1 1 480px", minWidth: 320 }}>
        <BriefBlatt
          absenderName={absName}
          absenderZeile={[vAdr ? vAdr.split(/,\s*/).join(" · ") : null, vermieter?.email].filter(Boolean).join(" · ") || null}
          ruecksende={[vName, vAdr].filter(Boolean).join(", ") || null}
          vermerk="Vertrauliches Dokument"
          empfaenger={[mieterName || "–", ...empfZeilen]}
          ortDatum={ortDatum}
          betreff={titel}
          untertitel={`Mietobjekt: ${objekt}`}
        >
          <p>Sehr geehrte/r {mieterName || "–"},</p>
          {absaetze.length === 0 ? (
            <p className="brief-muted" style={{ fontStyle: "italic" }}>
              (Noch kein Text — Felder ausfüllen oder Vorlage bearbeiten.)
            </p>
          ) : (
            absaetze.map((p, i) => <p key={i}>{p}</p>)
          )}

          {zeigtBetrag && selectedIban && (
            <div className="brief-konto">
              <div style={{ fontWeight: 700 }}>Bitte überweisen Sie auf folgendes Konto:</div>
              <div style={{ marginTop: 4 }}>{selectedIban.inhaber || absName}</div>
              <div className="iban">IBAN {fmtIban(selectedIban.iban)}</div>
              {selectedIban.kontoname && (
                <div className="brief-muted">{selectedIban.kontoname}</div>
              )}
            </div>
          )}

          <p style={{ marginTop: 26 }}>Mit freundlichen Grüßen</p>
          <p style={{ marginTop: 40 }}>{absName}</p>
        </BriefBlatt>

        {/* PDF-Download: Route liefert attachment → Download ohne neues Fenster */}
        <form
          action={`/tenants/${tenant.id}/dokument/pdf`}
          method="POST"
          className="no-print"
          style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}
        >
          <input type="hidden" name="art" value={art} />
          <input type="hidden" name="datum" value={datum} />
          <input type="hidden" name="betrag" value={betrag} />
          <input type="hidden" name="grund" value={grund} />
          <input type="hidden" name="ibanId" value={ibanId} />
          <input type="hidden" name="vName" value={vName} />
          <input type="hidden" name="vAdr" value={vAdr} />
          <input type="hidden" name="text" value={vorlageText} />
          <button
            type="button"
            className="btn btn-outline"
            disabled={ablegen}
            onClick={() =>
              startAblegen(async () => {
                const res = await speichereBrief(tenant.id, { art, datum, betrag, grund, ibanId, vName, vAdr, text: vorlageText });
                toast(res.ok ? "Beim Mieter & im Archiv gespeichert ✓" : res.error ?? "Speichern fehlgeschlagen.");
              })
            }
            style={{ marginRight: 8 }}
          >
            {ablegen ? "Speichert…" : <><Save size={14} style={{ verticalAlign: "-2px" }} /> Speichern</>}
          </button>
          <SubmitButton><FileText size={14} style={{ verticalAlign: "-2px" }} /> Als PDF herunterladen</SubmitButton>
        </form>
      </div>
    </div>
  );
}
