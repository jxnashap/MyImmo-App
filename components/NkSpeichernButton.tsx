"use client";
import { Save, Send } from "lucide-react";

// „Speichern" neben dem NK-Download: erzeugt dasselbe PDF serverseitig und
// legt es beim Mieter + im Archiv ab (Server-Action speichereNk).
//
// „Zustellen" ist seit 02.10.2026 KEIN Ein-Klick mehr (docs/zukunft/MIETERPORTAL-
// AUSBAU.md, F5): Erst eine Karte, die zeigt, WER die Abrechnung sehen wird — Name,
// Wohnung, Portal-Adresse, Mietzeit. Ohne verbundenes Konto ist Zustellen gesperrt;
// vorher meldete der Knopf „zugestellt ✓“, obwohl niemand sie sehen konnte.

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { speichereNk } from "@/lib/actions/dokumente";
import type { ZustellPruefung } from "@/lib/mieterZugang";
import { ZUGANG_HINWEIS } from "@/lib/zugang";

type Empfaenger = { name: string; wohnung: string | null; email: string | null; mietzeit: string };

export default function NkSpeichernButton({
  mieterId,
  jahr,
  empfaenger,
  pruefung,
}: {
  mieterId: string;
  jahr: number;
  empfaenger: Empfaenger;
  pruefung: ZustellPruefung;
}) {
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const toast = useToast();

  const speichern = (zustellen: boolean) =>
    startTransition(async () => {
      const res = await speichereNk(mieterId, jahr, zustellen);
      if (!res.ok) {
        toast(res.error ?? "Speichern fehlgeschlagen.", "error");
        return;
      }
      setOffen(false);
      // P4 (B43): „bereitgestellt“ statt „zugestellt“ — für die Frist nach § 556 Abs. 3 BGB zählt der
      // Zugang, und den belegt erst der Abruf (sichtbar auf der Mieterseite).
      toast(
        zustellen
          ? [`Im Mieterportal bereitgestellt für ${empfaenger.email ?? empfaenger.name}.`, res.hinweis].filter(Boolean).join(" ")
          : "Beim Mieter & im Archiv gespeichert — noch nicht zugestellt",
        zustellen && res.hinweis ? "info" : "success",
      );
    });

  return (
    <>
      <button type="button" className="btn btn-outline" disabled={pending} onClick={() => speichern(false)}>
        {pending && !offen ? "Speichert…" : <><Save size={14} style={{ verticalAlign: "-2px" }} /> Speichern</>}
      </button>
      <button
        type="button"
        className="btn btn-gold"
        disabled={pending}
        title="Zeigt zuerst, wer die Abrechnung im Mieterportal sehen wird"
        onClick={() => setOffen((o) => !o)}
      >
        <Send size={14} style={{ verticalAlign: "-2px" }} /> Ins Mieterportal zustellen…
      </button>

      {offen && (
        <div
          role="dialog"
          aria-label="Zustellung prüfen"
          className="no-print"
          style={{ flexBasis: "100%", marginTop: 8, padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 16, background: "var(--bg2)", maxWidth: 520 }}
        >
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Nebenkostenabrechnung {jahr} zustellen an</div>
          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 13, margin: "0 0 10px" }}>
            <dt style={{ color: "var(--muted)" }}>Mieter</dt><dd style={{ margin: 0, fontWeight: 600 }}>{empfaenger.name}</dd>
            {empfaenger.wohnung && (<><dt style={{ color: "var(--muted)" }}>Wohnung</dt><dd style={{ margin: 0 }}>{empfaenger.wohnung}</dd></>)}
            <dt style={{ color: "var(--muted)" }}>Mietzeit</dt><dd style={{ margin: 0 }}>{empfaenger.mietzeit}</dd>
            <dt style={{ color: "var(--muted)" }}>Portal-Konto</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{pruefung.sperre ? "— keins verbunden —" : (empfaenger.email ?? "Adresse unbekannt")}</dd>
          </dl>

          {pruefung.sperre ? (
            <p role="alert" style={{ fontSize: 12.5, color: "var(--red)", margin: "0 0 10px" }}>{pruefung.sperre}</p>
          ) : (
            pruefung.warnungen.length > 0 && (
              <ul style={{ fontSize: 12.5, color: "var(--gold)", margin: "0 0 10px", paddingLeft: 18 }}>
                {pruefung.warnungen.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )
          )}

          {!pruefung.sperre && <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px", lineHeight: 1.5 }}>{ZUGANG_HINWEIS}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!pruefung.sperre && (
              <button type="button" className="btn btn-gold" disabled={pending} onClick={() => speichern(true)}>
                {pending ? "…" : `Ja, an ${empfaenger.email ?? empfaenger.name} zustellen`}
              </button>
            )}
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setOffen(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
