"use client";

// Abgerufene Kontoumsätze (read-only). Abgleich/„bestätigen" folgt in
// Etappe 3 — hier: Liste + private Umsätze ausblenden.
import { useState, useTransition } from "react";
import { EyeOff, Eye, ReceiptText } from "lucide-react";
import { setzeUmsatzStatus } from "@/lib/actions/banking";
import { euro, datum } from "@/lib/format";

export type BankUmsatzRow = {
  id: string;
  buchungsdatum: string | null;
  betrag: number;
  gegenpartei: string | null;    // entschlüsselt
  verwendungszweck: string | null; // entschlüsselt
  status: string;
  bankName: string | null;
};

function Zeile({ u }: { u: BankUmsatzRow }) {
  const [pending, startTransition] = useTransition();
  const ausgeblendet = u.status === "ausgeblendet";
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
        borderBottom: "1px solid var(--line)", fontSize: 12.5,
        opacity: ausgeblendet ? 0.45 : 1,
      }}
    >
      <span style={{ color: "var(--muted)", minWidth: 74 }}>{u.buchungsdatum ? datum(u.buchungsdatum) : "–"}</span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {u.gegenpartei && <strong>{u.gegenpartei}</strong>}
        {u.gegenpartei && u.verwendungszweck && " · "}
        <span style={{ color: "var(--muted)" }}>{u.verwendungszweck ?? ""}</span>
      </span>
      {u.bankName && <span className="badge badge-neutral">{u.bankName}</span>}
      {u.status === "bestaetigt" && <span className="badge badge-green">Gebucht</span>}
      <span style={{ fontWeight: 600, whiteSpace: "nowrap", color: u.betrag >= 0 ? "var(--green)" : "var(--red)" }}>
        {u.betrag >= 0 ? "+ " : "− "}{euro(Math.abs(u.betrag))}
      </span>
      {u.status !== "bestaetigt" && (
        <button
          type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }}
          title={ausgeblendet ? "Wieder einblenden" : "Privaten/irrelevanten Umsatz ausblenden"}
          disabled={pending}
          onClick={() => startTransition(async () => { await setzeUmsatzStatus(u.id, ausgeblendet ? "neu" : "ausgeblendet"); })}
        >
          {ausgeblendet ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
      )}
    </div>
  );
}

export default function BankUmsaetze({ umsaetze }: { umsaetze: BankUmsatzRow[] }) {
  const [zeigeAusgeblendete, setZeigeAusgeblendete] = useState(false);
  const sichtbar = zeigeAusgeblendete ? umsaetze : umsaetze.filter((u) => u.status !== "ausgeblendet");
  const anzahlAusgeblendet = umsaetze.filter((u) => u.status === "ausgeblendet").length;

  return (
    <div className="section">
      <div className="section-header">
        <h3><ReceiptText size={15} style={{ verticalAlign: "-2px" }} /> Umsätze</h3>
        {anzahlAusgeblendet > 0 && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setZeigeAusgeblendete(!zeigeAusgeblendete)}>
            {zeigeAusgeblendete ? "Ausgeblendete verbergen" : `${anzahlAusgeblendet} ausgeblendete zeigen`}
          </button>
        )}
      </div>
      <div className="section-body">
        {sichtbar.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--faint)" }}>
            Noch keine Umsätze — verbinde ein Konto und klicke „Umsätze abrufen".
          </p>
        ) : (
          sichtbar.map((u) => <Zeile key={u.id} u={u} />)
        )}
        {sichtbar.length > 0 && (
          <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>
            Der automatische Abgleich mit deinen erwarteten Mieten („vorschlagen + bestätigen")
            folgt als nächste Etappe.
          </p>
        )}
      </div>
    </div>
  );
}
