import { notFound } from "next/navigation";
import Link from "next/link";
import { Gauge, ExternalLink, GitPullRequest, Bot } from "lucide-react";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { istBetreiber } from "@/lib/cockpit/zugang";
import { ladeTrichter } from "@/lib/cockpit/trichter";
import { bewerteBetrieb, ampelBilanz, BESUCHER_MESSUNG_AKTIV, type Betriebslage } from "@/lib/cockpit/betrieb";
import { OFFENE_DOKU_PUNKTE } from "@/lib/cockpit/doku";
import { ladeGithub, pruefAmpel } from "@/lib/cockpit/github";
import { ladeAgency, budgetAnteil } from "@/lib/cockpit/agency";
import { AmpelSymbol, Kachel, Trichter, Messbalken, PunktZeile } from "@/components/cockpit/Teile";
import { billingAktiv } from "@/lib/plan";
import { PREISE_SICHTBAR, REGISTRIERUNG_OFFEN } from "@/lib/preise";
import { brevoBereit } from "@/lib/mail/brevo";
import { datum } from "@/lib/format";

// BETREIBER-COCKPIT — die Firma auf einer Seite.
//
// Nicht zu verwechseln mit dem Dashboard unter `/`: Das zeigt einem VERMIETER
// sein Portfolio. Hier geht es um MyImmo als Unternehmen — Trichter,
// Betriebsbereitschaft, offene Rechtslücken, Prüfläufe, Agency.
//
// **Zugang:** nur das Konto in `OWNER_USER_ID`. Für alle anderen 404 (nicht
// 403 — ein 403 bestätigt, dass die Seite existiert). Ohne gesetzte Env sieht
// sie NIEMAND; Begründung in `lib/cockpit/zugang.ts`.
//
// **Haltung der Seite:** Sie beschönigt nichts. „nicht gemessen“ steht als
// Text, nicht als 0. Ein ausgeschaltetes Bezahlsystem steht als Tatsache, nicht
// als Fehler. Die vier Quellen sagen einzeln, wenn sie nicht verbunden sind,
// statt Nullen zu zeigen.

export const dynamic = "force-dynamic";
export const metadata = { title: "Cockpit", robots: { index: false, follow: false } };

function lageAusEnv(): Betriebslage {
  const da = (n: string) => Boolean(process.env[n]?.trim());
  return {
    billingAktiv: billingAktiv(),
    preiseSichtbar: PREISE_SICHTBAR,
    registrierungOffen: REGISTRIERUNG_OFFEN,
    brevoBereit: brevoBereit(),
    betaCode: da("BETA_CODE"),
    verschluesselung: da("DATA_ENCRYPTION_KEY"),
    cronSecret: da("CRON_SECRET"),
    serviceRoleKey: da("SUPABASE_SERVICE_ROLE_KEY"),
    anthropicKey: da("ANTHROPIC_API_KEY"),
    bedrockVollstaendig:
      da("BEDROCK_ACCESS_KEY_ID") && da("BEDROCK_SECRET_ACCESS_KEY") && da("BEDROCK_MODEL_ID"),
    besucherMessung: BESUCHER_MESSUNG_AKTIV,
    agencyVerbunden: da("AGENCY_SUPABASE_URL") && da("AGENCY_SUPABASE_SERVICE_KEY"),
    githubVerbunden: da("GITHUB_TOKEN"),
    ownerGesetzt: da("OWNER_USER_ID"),
  };
}

export default async function CockpitPage() {
  const user = await aktuellerNutzer();
  if (!istBetreiber(user?.id)) notFound();

  const [trichter, github, agency] = await Promise.all([ladeTrichter(), ladeGithub(), ladeAgency()]);
  const punkte = bewerteBetrieb(lageAusEnv());
  const bilanz = ampelBilanz([...punkte, ...OFFENE_DOKU_PUNKTE]);
  const k = trichter.ok ? trichter.kennzahlen : null;
  const trichterFehler = trichter.ok ? null : trichter.fehler;

  const nachWer = (wer: "betreiber" | "code") => punkte.filter((p) => p.wer === wer);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 9, margin: 0 }}>
            <Gauge size={22} style={{ color: "var(--gold)" }} aria-hidden="true" />
            Cockpit
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", margin: "6px 0 0" }}>
            MyImmo als Unternehmen. Nur für den Betreiber sichtbar, nicht indexiert.
          </p>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: "var(--text-sm)", flexWrap: "wrap" }}>
          {(["ok", "warnung", "kritisch", "offen"] as const).map((a) =>
            bilanz[a] > 0 ? (
              <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <AmpelSymbol ampel={a} groesse={15} />
                {bilanz[a]}
              </span>
            ) : null,
          )}
        </div>
      </header>

      {/* ---------- 1 · Die fünf Zahlen ---------- */}
      <section className="section">
        <h2 style={{ marginTop: 0 }}>Die fünf Zahlen</h2>
        {!k ? (
          <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
            Nicht ladbar: {trichterFehler}
          </p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <Kachel
                label="Besucher (7 Tage)"
                wert="nicht gemessen"
                unten="Keine Besuchermessung eingebunden"
              />
              <Kachel
                label="Neue Konten (7 T)"
                wert={String(k.neueKonten7t)}
                unten={`${k.neueKonten30t} in 30 Tagen`}
              />
              <Kachel
                label="Aktivierung"
                wert={k.aktivierungsquote === null ? "—" : `${k.aktivierungsquote} %`}
                unten={`${k.mitObjekt} von ${k.externeKonten} mit Objekt`}
              />
              <Kachel
                label="Rückkehrer"
                wert={k.rueckkehrerquote === null ? "—" : `${k.rueckkehrerquote} %`}
                unten="Zweiter Nutzungstag"
              />
              <Kachel
                label="Zahlende Kunden"
                wert={String(k.zahlendeKunden)}
                unten={billingAktiv() ? "Kasse ist scharf" : "Kasse ist aus — nicht zahlbar"}
                betont
              />
            </div>

            <h3 style={{ fontSize: "var(--text-sm)", marginBottom: 10 }}>Trichter</h3>
            <Trichter
              basis={k.externeKonten}
              stufen={[
                { label: "Externe Vermieter-Konten", wert: k.externeKonten },
                { label: "mit mindestens einem Objekt", wert: k.mitObjekt },
                { label: "mit mindestens einem Mieter", wert: k.mitMieter },
                { label: "mehr als zwei Buchungen", wert: k.mitBuchungen },
                {
                  label: "zweiter Nutzungstag",
                  wert: k.rueckkehrer,
                  hinweis: "Die wichtigste Zahl: wer nicht wiederkommt, zahlt auch nicht.",
                },
                { label: "zahlend", wert: k.zahlendeKunden },
              ]}
            />
            <p style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 12 }}>
              Nicht gezählt: {k.ausgeschlossen.rollen} Rollen-Konten (Mieter, Dienstleister,
              Hausverwaltung) und {k.ausgeschlossen.eigeneUndTest} Demo-/Testkonten.{" "}
              {k.aktiv30t} Konten mit Login in 30 Tagen. Stand {datum(k.stand.slice(0, 10))}.
            </p>
          </>
        )}
      </section>

      {/* ---------- 2 · Betriebsbereitschaft ---------- */}
      <section className="section">
        <h2 style={{ marginTop: 0 }}>Betriebsbereitschaft</h2>
        <p style={{ color: "var(--muted)", fontSize: "var(--text-xs)", marginTop: -4 }}>
          Zur Laufzeit aus Env und Code gelesen — keine Notiz, die veralten kann.
        </p>
        <h3 style={{ fontSize: "var(--text-sm)", marginBottom: 0, marginTop: 18 }}>
          Dein Zug (Dashboard, Env, Konto)
        </h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {nachWer("betreiber").map((p) => (
            <PunktZeile key={p.id} punkt={p} />
          ))}
        </ul>
        <h3 style={{ fontSize: "var(--text-sm)", marginBottom: 0, marginTop: 18 }}>
          Im Code geschaltet
        </h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {nachWer("code").map((p) => (
            <PunktZeile key={p.id} punkt={p} />
          ))}
        </ul>
      </section>

      {/* ---------- 3 · Offen, nicht messbar ---------- */}
      <section className="section">
        <h2 style={{ marginTop: 0 }}>Offen — braucht einen Menschen</h2>
        <p style={{ color: "var(--muted)", fontSize: "var(--text-xs)", marginTop: -4 }}>
          Von Hand gepflegt in <code>lib/cockpit/doku.ts</code>, jeder Eintrag mit Stand-Datum.
          Erledigtes wird dort gelöscht, nicht abgehakt.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {OFFENE_DOKU_PUNKTE.map((p) => (
            <PunktZeile key={p.id} punkt={p} />
          ))}
        </ul>
      </section>

      {/* ---------- 4 · Code & Auslieferung ---------- */}
      <section className="section">
        <h2 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <GitPullRequest size={18} aria-hidden="true" />
          Code & Auslieferung
        </h2>
        {!github.verbunden ? (
          <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
            Nicht verbunden: {github.grund}. Ohne das bleibt unsichtbar, ob <code>main</code> grün
            ist — genau der Punkt, an dem fünf Pushes unbemerkt rot waren.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AmpelSymbol ampel={pruefAmpel(github.pruefungen)} />
              <strong style={{ fontSize: "var(--text-sm)" }}>
                Prüfläufe auf {github.zweig}
              </strong>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                {github.pruefungen.length === 0
                  ? "keine Läufe auf dem letzten Commit"
                  : github.pruefungen
                      .map((p) => `${p.name}: ${p.laeuft ? "läuft" : (p.ergebnis ?? "?")}`)
                      .join(" · ")}
              </span>
            </div>
            {github.commit ? (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--muted)", margin: "0 0 14px" }}>
                Letzter Stand: <code>{github.commit.sha}</code> {github.commit.titel}
                {github.commit.am ? ` · ${datum(github.commit.am.slice(0, 10))}` : ""}
              </p>
            ) : null}
            <h3 style={{ fontSize: "var(--text-sm)", margin: "0 0 4px" }}>
              Offene Pull Requests ({github.offenePrs.length})
            </h3>
            {github.offenePrs.length === 0 ? (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>Keine offenen PRs.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {github.offenePrs.map((pr) => (
                  <li
                    key={pr.nr}
                    style={{
                      padding: "9px 0",
                      borderTop: "1px solid var(--line)",
                      fontSize: "var(--text-sm)",
                      display: "flex",
                      gap: 8,
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ minWidth: 0 }}>#{pr.nr} {pr.titel}</span>
                    <span style={{ color: "var(--muted)", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
                      {datum(pr.aktualisiert.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* ---------- 5 · Agency ---------- */}
      <section className="section">
        <h2 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Bot size={18} aria-hidden="true" />
          Agency
        </h2>
        {!agency.verbunden ? (
          <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
            Nicht verbunden: {agency.grund}. Einrichtung in acht Schritten:{" "}
            <code>agency/README.md</code>.
          </p>
        ) : (
          <>
            {agency.budget ? (
              <div style={{ maxWidth: 460, marginBottom: 18 }}>
                <Messbalken
                  anteil={budgetAnteil(agency.budget)}
                  ampel={
                    agency.budget.deckel_usd <= 0
                      ? "offen"
                      : !agency.budget.budget_ok
                        ? "kritisch"
                        : budgetAnteil(agency.budget) > 0.8
                          ? "warnung"
                          : "ok"
                  }
                  text={
                    agency.budget.deckel_usd <= 0
                      ? "Monatsdeckel steht auf 0 — gesperrt, bis eine Zahl entschieden ist"
                      : `${agency.budget.ausgaben_monat_usd.toFixed(2)} von ${agency.budget.deckel_usd.toFixed(2)} USD verbraucht · ${agency.budget.laeufe_monat} Läufe`
                  }
                />
              </div>
            ) : null}
            <h3 style={{ fontSize: "var(--text-sm)", margin: "0 0 4px" }}>
              Offene Vorgänge ({agency.offeneVorgaenge.length})
            </h3>
            {agency.offeneVorgaenge.length === 0 ? (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                Kein Vorgang läuft oder wartet auf Freigabe.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {agency.offeneVorgaenge.map((v) => (
                  <li
                    key={v.nr}
                    style={{
                      padding: "9px 0",
                      borderTop: "1px solid var(--line)",
                      fontSize: "var(--text-sm)",
                      display: "flex",
                      gap: 8,
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ minWidth: 0 }}>#{v.nr} {v.titel}</span>
                    <span style={{ color: "var(--muted)", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
                      {v.status.replace(/_/g, " ")} · {v.risiko}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {agency.abgelaufenesWissen.length > 0 ? (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--gold)", marginTop: 14 }}>
                {agency.abgelaufenesWissen.length} Gedächtnis-Einträge sind abgelaufen und sollten
                nachgeprüft werden.
              </p>
            ) : null}
          </>
        )}
      </section>

      <p style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
        Bewertung, Fahrplan und Abbruchkriterien:{" "}
        <code>docs/zukunft/AI-AGENCY-OS.md</code> ·{" "}
        <Link href="/einstellungen" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          Einstellungen <ExternalLink size={12} aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}
