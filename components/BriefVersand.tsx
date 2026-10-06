"use client";

// Versand eines Briefs an den Mieter (05.10.2026, Wunsch des Betreibers: Mahnung „per Mail
// oder ins Mieterportal einstellen, als Auswahl“).
//
// MAIL: MyImmo verschickt NICHTS selbst („wir halten uns aus dem Mailverkehr raus“). Das PDF
// wird erzeugt; wo das Gerät Dateien teilen kann (Handy, teils Desktop), hängt „Teilen → Mail“
// es direkt an. Sonst lädt der Browser das PDF herunter und öffnet das Mailprogramm mit
// Empfänger, Betreff und Text — anhängen muss der Vermieter dann selbst (ein mailto-Link
// kann keine Anhänge tragen). Absender und „Gesendet“-Ordner bleiben beim Vermieter.
//
// PORTAL: über den bestehenden Zustellweg (lib/zustellung.ts) — erst die Karte mit den
// Empfängern, dann zustellen; der Server prüft dasselbe noch einmal.
import { useState, useTransition } from "react";
import { Mail, Send, Share2 } from "lucide-react";
import { briefMailLink, briefMailText } from "@/lib/mahnung";
import { pruefeBriefZustellung, speichereBrief, type BriefZustellLage } from "@/lib/actions/dokumente";
import type { BriefFields } from "@/lib/pdf/erzeugen";
import { useToast } from "@/components/Toast";

type MailStand =
  | { stand: "laedt" }
  | { stand: "teilen"; datei: File; link: string; schluessel: string }
  | { stand: "geoeffnet"; ohneAdresse: boolean }
  | { stand: "fehler"; text: string };

type PortalStand = { stand: "pruefe" } | { stand: "karte"; lage: Exclude<BriefZustellLage, { error: string }> } | { stand: "fehler"; text: string };

function herunterladen(datei: File) {
  const url = URL.createObjectURL(datei);
  const a = document.createElement("a");
  a.href = url;
  a.download = datei.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function BriefVersand({
  mieterId,
  email,
  mieterName,
  betreff,
  absender,
  felder,
}: {
  mieterId: string;
  email: string | null;
  mieterName: string;
  betreff: string;
  absender: string;
  felder: BriefFields;
}) {
  const toast = useToast();
  const [mail, setMail] = useState<MailStand | null>(null);
  const [portal, setPortal] = useState<PortalStand | null>(null);
  const [bestaetigung, setBestaetigung] = useState(true);
  // Paket D (06.10.2026): Der Weg „per Mail“ hinterließ nichts — kein Archiv-Eintrag, kein Datum,
  // und der Rückstands-Wächter bot dieselbe Erinnerung wieder an, ohne dass man sah, dass sie
  // schon raus war. Jetzt eine Kopie im Archiv, einmal je Briefstand (nicht bei jedem Klick).
  const [archiviertFuer, setArchiviertFuer] = useState<string | null>(null);
  const [stellt, startStellen] = useTransition();
  // Ändert sich der Brief nach dem Erzeugen, gilt das vorbereitete PDF nicht mehr.
  const schluessel = JSON.stringify(felder);

  async function pdfHolen(): Promise<File> {
    const fd = new FormData();
    for (const [k, v] of Object.entries(felder)) fd.append(k, String(v ?? ""));
    const r = await fetch(`/tenants/${mieterId}/dokument/pdf`, { method: "POST", body: fd });
    // Ohne Anmeldung leitet die Route auf /login um — dann käme HTML mit Status 200.
    if (!r.ok || !(r.headers.get("Content-Type") ?? "").includes("application/pdf")) {
      throw new Error("Das PDF konnte nicht erzeugt werden. Bitte die Seite neu laden.");
    }
    const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? `${betreff}.pdf`;
    return new File([await r.blob()], name, { type: "application/pdf" });
  }

  function mailOeffnen(datei: File, link: string) {
    herunterladen(datei);
    window.location.href = link;
    setMail({ stand: "geoeffnet", ohneAdresse: !email });
  }

  async function mailVorbereiten() {
    setPortal(null);
    setMail({ stand: "laedt" });
    try {
      const datei = await pdfHolen();
      const link = briefMailLink({ an: email, betreff, mieterName, absender });
      if (archiviertFuer !== schluessel) {
        try {
          const r = await speichereBrief(mieterId, felder);
          if (r.ok) {
            setArchiviertFuer(schluessel);
            toast("Kopie im Archiv abgelegt.", "success");
          } else {
            toast(`Mail geht trotzdem — nur die Archiv-Kopie fehlt (${r.error ?? "Fehler"}).`, "info");
          }
        } catch {
          toast("Mail geht trotzdem — nur die Archiv-Kopie fehlt.", "info");
        }
      }
      // Teilen braucht einen frischen Klick — nach dem Laden ist der erste verbraucht.
      // Deshalb ein zweiter Knopf statt `navigator.share` direkt hier.
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [datei] })) {
        setMail({ stand: "teilen", datei, link, schluessel });
      } else {
        mailOeffnen(datei, link);
      }
    } catch (e) {
      setMail({ stand: "fehler", text: e instanceof Error ? e.message : "Das PDF konnte nicht erzeugt werden." });
    }
  }

  async function teilen(datei: File) {
    try {
      await navigator.share({ files: [datei], title: betreff, text: briefMailText({ betreff, mieterName, absender }) });
    } catch (e) {
      // Abbrechen im Teilen-Dialog ist kein Fehler.
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast("Teilen hat nicht geklappt — öffne stattdessen das Mailprogramm.", "error");
    }
  }

  async function portalPruefen() {
    setMail(null);
    setPortal({ stand: "pruefe" });
    try {
      const r = await pruefeBriefZustellung(mieterId);
      setPortal("error" in r ? { stand: "fehler", text: r.error } : { stand: "karte", lage: r });
    } catch {
      setPortal({ stand: "fehler", text: "Zustellung konnte nicht geprüft werden." });
    }
  }

  function portalZustellen() {
    startStellen(async () => {
      try {
        const res = await speichereBrief(mieterId, felder, { zustellen: true, bestaetigung });
        if (res.ok) {
          toast(`Im Mieterportal zugestellt an ${(res.zugestelltAn ?? []).join(", ") || "den Mieter"} ✓`, "success");
          setPortal(null);
        } else {
          toast(res.error ?? "Zustellen fehlgeschlagen.", "error");
        }
      } catch {
        toast("Zustellen fehlgeschlagen.", "error");
      }
    });
  }

  const teilenAktuell = mail?.stand === "teilen" && mail.schluessel === schluessel ? mail : null;

  return (
    <div className="versand-box no-print">
      <div className="form-section-label" style={{ marginTop: 0 }}>An den Mieter senden</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-outline" onClick={mailVorbereiten} disabled={mail?.stand === "laedt"}>
          <Mail size={14} style={{ verticalAlign: "-2px" }} /> {mail?.stand === "laedt" ? "PDF wird erzeugt…" : "Per Mail senden"}
        </button>
        <button type="button" className="btn btn-outline" onClick={portalPruefen} disabled={portal?.stand === "pruefe"}>
          <Send size={14} style={{ verticalAlign: "-2px" }} /> {portal?.stand === "pruefe" ? "Prüft…" : "Ins Mieterportal stellen"}
        </button>
      </div>
      <p className="versand-hinweis">
        Die Mail geht aus <strong>deinem</strong> Mailprogramm an {email ? <strong>{email}</strong> : "den Mieter"} — MyImmo verschickt nichts selbst.
      </p>

      {teilenAktuell && (
        <div className="versand-karte">
          <div>PDF ist bereit. Über „Teilen“ hängt es direkt an — dort Mail wählen.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" className="btn btn-gold" onClick={() => teilen(teilenAktuell.datei)}>
              <Share2 size={14} style={{ verticalAlign: "-2px" }} /> Teilen (PDF im Anhang)
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => mailOeffnen(teilenAktuell.datei, teilenAktuell.link)}>
              Mailprogramm öffnen
            </button>
          </div>
        </div>
      )}
      {mail?.stand === "geoeffnet" && (
        <div className="versand-karte">
          Das PDF liegt in deinen Downloads. <strong>Bitte an die Mail anhängen</strong> — ein Mail-Link kann keinen Anhang mitgeben.
          {mail.ohneAdresse && " Beim Mieter ist keine E-Mail-Adresse hinterlegt — bitte in der Mail eintragen."}
        </div>
      )}
      {mail?.stand === "fehler" && <div className="versand-karte versand-fehler">{mail.text}</div>}

      {portal?.stand === "fehler" && <div className="versand-karte versand-fehler">{portal.text}</div>}
      {portal?.stand === "karte" && (
        <div className="versand-karte">
          {portal.lage.sperre ? (
            <div className="versand-fehler">{portal.lage.sperre}</div>
          ) : (
            <>
              <div>
                Wird im Archiv abgelegt und im Mieterportal zugestellt an: <strong>{portal.lage.an.join(", ")}</strong>
              </div>
              {portal.lage.warnungen.map((w) => (
                <div key={w} style={{ color: "var(--amber)", marginTop: 6 }}>{w}</div>
              ))}
              <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={bestaetigung} onChange={(e) => setBestaetigung(e.target.checked)} />
                Mieter soll „gelesen und bestätigt“ klicken
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" className="btn btn-gold" onClick={portalZustellen} disabled={stellt}>
                  {stellt ? "Stellt zu…" : "Jetzt zustellen"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setPortal(null)}>Abbrechen</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
