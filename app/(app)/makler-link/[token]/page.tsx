// ÖFFENTLICHE Seite für den Makler (05.10.2026, kein Konto): die Unterlagen, die ein
// Kaufinteressent aus seinem Makler-Ordner freigegeben hat — nur Download, keine Rückmeldung.
// Erst nach dem Zugangscode aus der Mail (Cookie mit dem Code-Hash, siehe
// lib/actions/maklerLinkPublic.ts); ohne ihn zeigt die Seite nur das Code-Formular.
// Datenzugriff ausschließlich über SECURITY-DEFINER-Funktionen, die Token UND Hash prüfen.
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MAKLER_COOKIE } from "@/lib/maklerCode";
import ZugangsCodeFormular from "@/components/ZugangsCodeFormular";
import { meldeMaklerAn } from "@/lib/actions/maklerLinkPublic";
import { MAKLER_CHECKLISTE } from "@/lib/makler";
import { Lock, FileText } from "lucide-react";
import OeffentlicheFusszeile from "@/components/OeffentlicheFusszeile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Käuferunterlagen – MyImmo",
  robots: { index: false, follow: false },
};

type Info = {
  name: string | null;
  ablauf: string;
  dokumente: { item_key: string; datei_name: string; datei_type: string | null; datei_size: number | null }[];
};

function Kopf() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "2px solid var(--gold)", paddingBottom: 14, marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 26 }}>My<em style={{ color: "var(--gold)" }}>Immo</em></span>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--muted)" }}>PRIVATES IMMOBILIEN-MANAGEMENT</div>
      </div>
      <span className="badge badge-gold">Vertrauliche Käuferunterlagen</span>
    </div>
  );
}

function groesse(b: number | null): string {
  if (!b) return "";
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(b / 1024)} KB`;
}

export default async function MaklerLinkSeite(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  let info: Info | null = null;
  let status: string | null = null;
  if (/^[0-9a-f-]{36}$/i.test(params.token)) {
    const hash = (await cookies()).get(MAKLER_COOKIE)?.value;
    if (hash) {
      const { data } = await supabase.rpc("makler_public_info", { p_token: params.token, p_code_hash: hash });
      info = (data as Info | null) ?? null;
    }
    if (!info) {
      const { data } = await supabase.rpc("makler_public_status", { p_token: params.token });
      status = (data as string | null) ?? null;
    }
  }

  // Link gültig, aber (noch) kein richtiger Code → Code-Formular.
  if (!info && status) {
    return (
      <div style={{ maxWidth: 560, margin: "60px auto", padding: 24 }}>
        <Kopf />
        <ZugangsCodeFormular token={params.token} gesperrt={status === "gesperrt"} anmelden={meldeMaklerAn} />
      </div>
    );
  }

  if (!info) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: 24 }}>
        <Kopf />
        <div className="section" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ marginBottom: 10 }}><Lock size={30} color="var(--muted)" /></div>
          <h1 style={{ fontSize: 19, marginBottom: 8 }}>Link abgelaufen oder ungültig</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            Diese Freigabe wurde widerrufen oder ist abgelaufen. Bitte fordern Sie bei der
            Kaufinteressentin oder dem Kaufinteressenten einen neuen Link an.
          </p>
        </div>
      </div>
    );
  }

  const labelVon = new Map(MAKLER_CHECKLISTE.map((i) => [i.key, i.label]));

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: "0 20px 60px" }}>
      <Kopf />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Käuferunterlagen{info.name ? ` – ${info.name}` : ""}</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Bereitgestellt über MyImmo · Link gültig bis {new Date(info.ablauf).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
        </p>
      </div>

      <div className="section" style={{ marginBottom: 18 }}>
        <div className="section-header"><h3>Freigegebene Dokumente ({info.dokumente.length})</h3></div>
        {info.dokumente.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>Zu diesem Link sind keine Dateien (mehr) hinterlegt.</div>
        )}
        {info.dokumente.map((d) => (
          <div key={d.item_key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <FileText size={17} style={{ flexShrink: 0 }} />
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{labelVon.get(d.item_key) || d.item_key}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.datei_name}{d.datei_size ? ` · ${groesse(d.datei_size)}` : ""}
              </div>
            </div>
            <a className="btn btn-ghost" style={{ fontSize: 11.5 }} href={`/makler-link/${params.token}/datei/${d.item_key}`} target="_blank" rel="noopener noreferrer">Ansehen</a>
            <a className="btn btn-ghost" style={{ fontSize: 11.5 }} href={`/makler-link/${params.token}/datei/${d.item_key}?download=1`}>Download</a>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 22, lineHeight: 1.6 }}>
        Diese Seite ist eine zeitlich begrenzte, private Freigabe. Die Unterlagen sind vertraulich und
        nur für die Prüfung dieses Kaufinteresses bestimmt — bitte nicht weiterleiten. Jeder Abruf wird
        für die Person protokolliert, die den Link erstellt hat (Zeitpunkt und Dokument).
      </p>
      <OeffentlicheFusszeile
        verantwortlicher={info.name}
        kontakt={null}
        zweck="Die hier gezeigten Unterlagen dienen ausschließlich der Prüfung eines Kaufinteresses durch den Makler bzw. Verkäufer."
      />
    </div>
  );
}
