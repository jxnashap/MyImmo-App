import Link from "next/link";
import { ChevronRight, ClipboardCheck, FileUser, FolderCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { bestandLage } from "@/lib/aufbau";
import { ladeAufbauDaten } from "@/lib/aufbauDaten";
import { MAKLER_CHECKLISTE, maklerErledigt } from "@/lib/makler";
import { datum, euro } from "@/lib/format";
import { heuteBerlin } from "@/lib/zeitraum";
import Leer from "@/components/Leer";

export const metadata = { title: "Kommandozentrale — BuyImmo" };
export const dynamic = "force-dynamic";

// BuyImmo-Kommandozentrale (05.10.2026, Vorgabe des Betreibers): MyImmo verwaltet, BuyImmo
// baut den Bestand aus. Diese Seite ist der Einstieg in BuyImmo — sie zeigt, was für das
// nächste Objekt schon in der Hand ist, aus Daten, die MyImmo ohnehin hat. Keine Empfehlung
// („du kannst kaufen“) — die Grenze zur Beratung (§ 34i GewO) ist anwaltlich offen, siehe
// docs/zukunft/BUYIMMO.md. Die Zahlen rechnet `lib/aufbau.ts` mit den Regeln von Dashboard
// und /kredite, damit dieselbe Größe nicht zweimal verschieden dasteht.

const MAX_KAUFPRUEFUNGEN = 5;

export default async function AufbauPage() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const d = await ladeAufbauDaten(supabase, user, heuteBerlin());

  const lage = bestandLage(d.objekte, d.kredite);
  const kaufpruefungen = d.kaufpruefungen;
  const hatSelbstauskunft = d.hatSelbstauskunft;
  const maklerFertig = maklerErledigt(d.makler);
  const maklerGesamt = MAKLER_CHECKLISTE.length;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">BuyImmo · Bestandsaufbau</div>
          <div className="topbar-title">Kommandozentrale</div>
          <div className="topbar-sub">Was du für das nächste Objekt in der Hand hast — aus deinen MyImmo-Daten</div>
        </div>
        <Link href="/fahrplan" className="btn btn-ghost btn-sm">Fahrplan zum nächsten Objekt →</Link>
      </div>
      <hr className="topbar-rule" />

      {/* Vier Felder, nachrechenbar: Portfolio-Wert − Restschuld = Eigenkapital im Bestand. */}
      <div className="kpi-leiste kpi-leiste-4 staffel mb-20">
        <Link href="/properties" className="kpi-feld">
          <span className="kpi-label">Portfolio-Wert</span>
          <span className="kpi-value">{euro(lage.wert)}</span>
          <span className="kpi-sub">
            {lage.objekte} Objekt{lage.objekte === 1 ? "" : "e"}
            {lage.ohneWert > 0 ? ` · ${lage.ohneWert} ohne Wert` : ""}
          </span>
        </Link>
        <Link href="/kredite" className="kpi-feld">
          <span className="kpi-label">Restschuld</span>
          <span className="kpi-value">{euro(lage.restschuld)}</span>
          <span className="kpi-sub">
            {lage.restschuldProzent != null ? `${lage.restschuldProzent.toLocaleString("de-DE")} % vom Wert` : "Wert fehlt"}
          </span>
        </Link>
        {/* Unterzeile kurz halten: Am Handy schneidet die Leiste nach zwei Zeilen ab, und der
            Vorbehalt „geschätzt“ darf nicht hinter „…“ verschwinden (im Browser gesehen). */}
        <Link href="/kredite" className="kpi-feld" title="Wert − Restschuld. Der Wert ist eine Schätzung, keine Bankbewertung.">
          <span className="kpi-label">Eigenkapital im Bestand</span>
          <span className="kpi-value">{euro(lage.eigenkapital)}</span>
          <span className="kpi-sub">
            {lage.ohneWert > 0 ? "Wert − Restschuld · zu niedrig, Werte fehlen" : "Wert − Restschuld, geschätzt"}
          </span>
        </Link>
        <Link href="/kredite" className="kpi-feld">
          <span className="kpi-label">Freie Grundschuld</span>
          <span className="kpi-value">{lage.freieGrundschuld != null ? euro(lage.freieGrundschuld) : "–"}</span>
          <span className="kpi-sub">
            {lage.freieGrundschuld != null ? "Grundschuld über der Restschuld" : "Keine Grundschuld eingetragen"}
          </span>
        </Link>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <div>
              <h3>Kaufprüfungen</h3>
              <div className="section-sub">
                {kaufpruefungen.length > MAX_KAUFPRUEFUNGEN
                  ? `Die ${MAX_KAUFPRUEFUNGEN} neuesten von ${kaufpruefungen.length}`
                  : "Im Kauf-Assistenten gespeicherte Objekte"}
              </div>
            </div>
            <Link href="/kauf" className="btn btn-ghost btn-sm">Kauf-Assistent →</Link>
          </div>
          <div className="section-body">
            {kaufpruefungen.length === 0 ? (
              <Leer
                icon={ClipboardCheck}
                titel="Noch keine Kaufprüfung"
                text="Im Kauf-Assistenten rechnest du ein Objekt durch und speicherst es — hier stehen dann alle nebeneinander."
                aktion={{ href: "/kauf", label: "Objekt durchrechnen" }}
              />
            ) : (
              <div className="listen">
                {kaufpruefungen.slice(0, MAX_KAUFPRUEFUNGEN).map((k) => {
                  const s = k.summary ?? {};
                  const teile = [
                    s.kp > 0 ? euro(s.kp) : null,
                    s.brutto > 0 ? `${s.brutto.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % brutto` : null,
                  ].filter(Boolean);
                  return (
                    <Link key={k.id} href="/kauf" className="listen-zeile" title={k.name}>
                      <ClipboardCheck size={15} style={{ color: "var(--gold)", flexShrink: 0 }} aria-hidden />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="listen-zeile-titel">{k.name}</span>
                        {teile.length > 0 && <span className="listen-zeile-sub">{teile.join(" · ")}</span>}
                      </span>
                      <span className="listen-zeile-datum">{datum(k.created_at)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <div>
              <h3>Bereit für Bank und Makler</h3>
              <div className="section-sub">Unterlagen, die vor einem Kauf fertig sein sollten</div>
            </div>
          </div>
          <div className="section-body">
            <div className="listen">
              <Link href="/kauf" className="listen-zeile">
                <FileUser size={15} style={{ color: "var(--gold)", flexShrink: 0 }} aria-hidden />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="listen-zeile-titel">Selbstauskunft</span>
                  <span className="listen-zeile-sub">Für Bank und Kreditantrag</span>
                </span>
                <span className={`badge ${hatSelbstauskunft ? "badge-green" : "badge-neutral"}`}>
                  {hatSelbstauskunft ? "ausgefüllt" : "fehlt"}
                </span>
                <ChevronRight size={15} style={{ color: "var(--faint)", flexShrink: 0 }} aria-hidden />
              </Link>
              <Link href="/makler" className="listen-zeile">
                <FolderCheck size={15} style={{ color: "var(--gold)", flexShrink: 0 }} aria-hidden />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="listen-zeile-titel">Makler-Ordner</span>
                  <span className="listen-zeile-sub">Nachweise für Makler und Verkäufer</span>
                </span>
                <span className={`badge ${maklerFertig === maklerGesamt ? "badge-green" : "badge-neutral"}`}>
                  {maklerFertig} von {maklerGesamt}
                </span>
                <ChevronRight size={15} style={{ color: "var(--faint)", flexShrink: 0 }} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
