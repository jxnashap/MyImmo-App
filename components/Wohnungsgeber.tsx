"use client";
import { useState, useTransition } from "react";
import { Save, FileText } from "lucide-react";
import { speichereWohnungsgeber } from "@/lib/actions/dokumente";
import { useToast } from "@/components/Toast";
import type { Tenant, Property, VermieterProfil } from "@/lib/types";

// Wohnungsgeberbestätigung (§ 19 BMG): Eingabe links, Live-Vorschau rechts.
// „Als PDF herunterladen" = POST an /wohnungsgeber/pdf (Server-PDF via pdf-lib).
// „Speichern" legt das PDF beim Mieter ab UND gibt es im Mieterportal frei —
// der Mieter braucht es für seine An-/Ummeldung (§ 17 BMG, 2-Wochen-Frist).
export default function Wohnungsgeber({ tenant, property, vermieter }: { tenant: Tenant; property: Property | null; vermieter: VermieterProfil | null }) {
  const heuteIso = new Date().toISOString().split("T")[0];
  const [vorgang, setVorgang] = useState<"einzug" | "auszug">("einzug");
  const [datum, setDatum] = useState((tenant.mietbeginn ?? heuteIso).slice(0, 10));
  const [weiterePersonen, setWeiterePersonen] = useState("");
  const [ablegen, startAblegen] = useTransition();
  const toast = useToast();

  // Beim Wechsel Einzug/Auszug das Datum sinnvoll vorbelegen.
  const wechsle = (v: "einzug" | "auszug") => {
    setVorgang(v);
    setDatum(((v === "auszug" ? tenant.mietende : tenant.mietbeginn) ?? heuteIso).slice(0, 10));
  };

  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  const wohnungsgeberName = vermieter?.name ?? "";
  const wohnungsgeberAnschrift = [vermieter?.strasse, [vermieter?.plz, vermieter?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const wohnungsanschrift =
    [property?.adresse, tenant.einheit].filter(Boolean).join(", ") || tenant.mieter_adresse || property?.bezeichnung || "—";
  const personen = [mieterName, ...weiterePersonen.split("\n").map((s) => s.trim()).filter(Boolean)].filter(Boolean);
  const dDe = datum ? new Date(datum).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ---------- Eingaben ---------- */}
      <div className="form-box no-print" style={{ maxWidth: 460, flex: "1 1 420px" }}>
        <h3>Wohnungsgeberbestätigung</h3>
        <p>Pflicht nach § 19 BMG — binnen zwei Wochen nach Einzug auszustellen (Bußgeld bis 1.000 €). Der Mieter braucht sie fürs Bürgeramt.</p>

        <div className="form-row">
          <div className="form-group"><label>Vorgang</label><select value={vorgang} onChange={(e) => wechsle(e.target.value as "einzug" | "auszug")}><option value="einzug">Einzug</option><option value="auszug">Auszug</option></select></div>
          <div className="form-group"><label>{vorgang === "einzug" ? "Einzugsdatum" : "Auszugsdatum"}</label><input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></div>
        </div>

        <div className="form-group">
          <label>Weitere meldepflichtige Personen (optional, eine pro Zeile)</label>
          <textarea value={weiterePersonen} onChange={(e) => setWeiterePersonen(e.target.value)} rows={3} placeholder={"z. B. Ehepartner\nz. B. Kind"} />
        </div>

        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>
          Wohnungsgeber &amp; Wohnungsanschrift werden aus deinem Profil und dem Objekt übernommen.
          Fehlt etwas, ergänze es unter Einstellungen bzw. beim Objekt.
        </p>

        <form action={`/tenants/${tenant.id}/wohnungsgeber/pdf`} method="POST" className="form-actions">
          <input type="hidden" name="vorgang" value={vorgang} />
          <input type="hidden" name="datum" value={datum} />
          <input type="hidden" name="weiterePersonen" value={weiterePersonen} />
          <button
            type="button"
            className="btn btn-outline"
            disabled={ablegen}
            onClick={() =>
              startAblegen(async () => {
                const res = await speichereWohnungsgeber(tenant.id, { vorgang, datum, weiterePersonen });
                toast(res.ok ? "Beim Mieter & im Archiv gespeichert ✓" : res.error ?? "Speichern fehlgeschlagen.");
              })
            }
            style={{ marginRight: 8 }}
          >
            {ablegen ? "Speichert…" : <><Save size={14} style={{ verticalAlign: "-2px" }} /> Speichern &amp; freigeben</>}
          </button>
          <button type="submit" className="btn btn-gold"><FileText size={14} style={{ verticalAlign: "-2px" }} /> Als PDF herunterladen</button>
        </form>
      </div>

      {/* ---------- A4-Blatt (Vorschau) ---------- */}
      <div style={{ flex: "1 1 480px", minWidth: 320 }}>
        <div className="brief-sheet">
          <div className="brief-kopf">
            <div className="brief-logo">My<span>Immo</span></div>
            <div className="brief-absender">{wohnungsgeberName && <strong>{wohnungsgeberName}</strong>}</div>
          </div>
          <div className="brief-goldline" style={{ marginBottom: 18 }} />

          <div className="brief-betreff">
            <h2>Wohnungsgeberbestätigung</h2>
            <div className="unter">Bestätigung des Wohnungsgebers nach § 19 Bundesmeldegesetz (BMG)</div>
            <div className="brief-betreff-linie" />
          </div>

          <h3 style={{ fontSize: 11, margin: "18px 0 6px", borderBottom: "1px solid var(--gold)", paddingBottom: 3, fontFamily: "inherit", color: "var(--muted)", letterSpacing: 0.5 }}>WOHNUNGSGEBER</h3>
          <p style={{ margin: 0 }}>{wohnungsgeberName || "—"}{wohnungsgeberAnschrift && <><br />{wohnungsgeberAnschrift}</>}</p>

          <h3 style={{ fontSize: 11, margin: "18px 0 6px", borderBottom: "1px solid var(--gold)", paddingBottom: 3, fontFamily: "inherit", color: "var(--muted)", letterSpacing: 0.5 }}>{vorgang === "einzug" ? "EINZUG" : "AUSZUG"}</h3>
          <p style={{ margin: 0 }}><strong>{vorgang === "einzug" ? "Einzugsdatum:" : "Auszugsdatum:"}</strong> {dDe}</p>

          <h3 style={{ fontSize: 11, margin: "18px 0 6px", borderBottom: "1px solid var(--gold)", paddingBottom: 3, fontFamily: "inherit", color: "var(--muted)", letterSpacing: 0.5 }}>ANSCHRIFT DER WOHNUNG</h3>
          <p style={{ margin: 0 }}>{wohnungsanschrift}</p>

          <h3 style={{ fontSize: 11, margin: "18px 0 6px", borderBottom: "1px solid var(--gold)", paddingBottom: 3, fontFamily: "inherit", color: "var(--muted)", letterSpacing: 0.5 }}>MELDEPFLICHTIGE PERSON(EN)</h3>
          {personen.length === 0 ? (
            <p style={{ margin: 0 }} className="brief-muted">—</p>
          ) : (
            <ul style={{ margin: "0 0 0 16px", padding: 0 }}>{personen.map((p, i) => <li key={i}>{p}</li>)}</ul>
          )}

          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 16 }}>
            Hiermit wird der {vorgang === "einzug" ? "Einzug" : "Auszug"} der oben genannten Person(en) {vorgang === "einzug" ? "in die" : "aus der"} bezeichnete{vorgang === "einzug" ? "" : "n"} Wohnung bestätigt (§ 19 BMG).
          </p>

          <div className="brief-sig" style={{ marginTop: 40 }}>
            <div>Ort, Datum &amp; Unterschrift Wohnungsgeber</div>
          </div>
        </div>
      </div>
    </div>
  );
}
