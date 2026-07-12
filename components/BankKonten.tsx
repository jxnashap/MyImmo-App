"use client";

// Verbundene Bankkonten: Umsätze abrufen, Verbindung lösen, Reauth-Hinweis.
import { useState, useTransition } from "react";
import { Landmark, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { aktualisiereUmsaetze, loescheBankVerbindung } from "@/lib/actions/banking";
import DeleteButton from "@/components/DeleteButton";
import { datum } from "@/lib/format";
import { useToast } from "@/components/Toast";

export type BankVerbindungRow = {
  id: string;
  aspsp_name: string | null;
  iban: string | null; // bereits entschlüsselt (serverseitig)
  konto_name: string | null;
  objektName: string | null;
  gueltig_bis: string | null;
  letzter_abruf: string | null;
};

const fmtIban = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

function Zeile({ v }: { v: BankVerbindungRow }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const tageBisAblauf = v.gueltig_bis
    ? Math.floor((new Date(v.gueltig_bis).getTime() - Date.now()) / 86400000)
    : null;

  const abrufen = () =>
    startTransition(async () => {
      const r = await aktualisiereUmsaetze(v.id);
      if (r.error) toast(r.error);
      else toast(r.neu === 0 ? "Keine neuen Umsätze." : `${r.neu} neue Umsätze abgerufen ✓`);
    });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <Landmark size={14} color="var(--gold)" />
      <span style={{ fontWeight: 600 }}>{v.aspsp_name ?? "Bank"}</span>
      {v.konto_name && <span style={{ fontSize: 11, color: "var(--muted)" }}>{v.konto_name}</span>}
      {v.iban && <code style={{ fontSize: 11, color: "var(--muted)" }}>{fmtIban(v.iban)}</code>}
      {v.objektName && <span className="badge badge-teal">{v.objektName}</span>}
      {tageBisAblauf != null && (
        <span className={`badge ${tageBisAblauf <= 14 ? "badge-red" : "badge-neutral"}`} title="PSD2: Freigabe alle 90 Tage erneuern">
          {tageBisAblauf <= 14 && <TriangleAlert size={10} style={{ verticalAlign: "-1px" }} />} Freigabe {tageBisAblauf <= 0 ? "abgelaufen" : `noch ${tageBisAblauf} Tage`}
        </span>
      )}
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center" }}>
        {v.letzter_abruf && <span style={{ fontSize: 11, color: "var(--faint)" }}>Abruf {datum(v.letzter_abruf)}</span>}
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} disabled={pending} onClick={abrufen}>
          <RefreshCw size={12} style={{ verticalAlign: "-2px" }} /> {pending ? "…" : "Umsätze abrufen"}
        </button>
        <DeleteButton
          action={async () => { await loescheBankVerbindung(v.id); }}
          className="delete-btn"
          label={<Trash2 size={13} />}
          confirmText="Verbindung und gespeicherte Umsätze löschen?"
        />
      </span>
    </div>
  );
}

export default function BankKonten({ verbindungen }: { verbindungen: BankVerbindungRow[] }) {
  if (verbindungen.length === 0) return null;
  return (
    <div className="section">
      <div className="section-header"><h3>Verbundene Konten</h3></div>
      <div className="section-body">
        {verbindungen.map((v) => <Zeile key={v.id} v={v} />)}
      </div>
    </div>
  );
}
