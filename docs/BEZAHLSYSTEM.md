# Bezahlsystem (Paddle, Merchant of Record) — gebaut, noch INAKTIV

> Stand 24.07.2026. Das komplette Abo-System ist im Code fertig, greift aber
> erst, wenn die Env-Variablen gesetzt sind. Bis dahin gilt **Early Access**
> (alles kostenlos — so kündigt es die [/preise-Seite] an).
> Verwandt: [[FINANZKONZEPT]] (Abschnitt Einnahmen) · [[00 Index]].

## Warum Paddle (Merchant of Record)?
- Paddle verkauft **im eigenen Namen** an die Endkunden und übernimmt
  **EU-Umsatzsteuer, Rechnungen, Steuer-Meldungen und Zahlungsabwicklung** komplett.
- Für den Solo-Nebenerwerb heißt das: kein OSS-Verfahren, keine eigene
  Rechnungsstellung an hunderte Kunden, kein USt-Reporting je EU-Land.
- Preis dafür: ~5 % + 0,50 $ je Transaktion (Stripe wäre ~2 %, aber mit
  eigenem Steuer-/Rechnungsaufwand). Bewusste Entscheidung: **Risikoarm > billig.**
- ⚠️ **Steuerberater-Frage:** Beim MoR-Modell ist Paddle der (eine) Kunde —
  B2B-Leistung mit Reverse-Charge. Das bei der Kleinunternehmer-Regelung
  (§ 19 UStG) berücksichtigen lassen.

## Architektur (alles schon im Repo)
| Baustein | Datei | Zweck |
|---|---|---|
| Abo-Tabelle | `supabase/migrations/20260724180000_create_abos.sql` | 1 Zeile je Nutzer; RLS: Nutzer liest nur, **nur Service-Role schreibt** |
| Tarif-Logik | `lib/plan.ts` | Feature-Matrix je Tarif, Einheiten-Limits, `darfFeature()`, `billingAktiv()` |
| Paddle-Adapter | `lib/billing/paddle.ts` | Signaturprüfung, Event-Parsing, Checkout-URL, Kundenportal |
| Webhook | `app/api/billing/webhook/route.ts` | `subscription.*` → Upsert `abos` (503-No-op ohne Secret) |
| Server-Actions | `lib/actions/billing.ts` | `starteCheckout()`, `oeffneAboPortal()` |
| UI | `components/SettingsView.tsx` (Tab „Abo") | Early-Access-Karte; nach Aktivierung Upgrade-Buttons + Portal |
| Tests | `tests/plan.test.ts`, `tests/paddleWebhook.test.ts` | Matrix, Status-Mapping, HMAC-Signatur |

**Kill-Switch-Prinzip:** Ohne `BILLING_ENFORCED=true` ist `darfFeature()` immer
`true` und das Einheiten-Limit unendlich — niemand wird ausgesperrt. Die
Feature-Gates können daher gefahrlos nach und nach in die Server-Actions
eingebaut werden (Muster: `if (!darfFeature(abo, "nk_pdf")) return fehler`).

**Security-Review-Härtungen (24.07.2026):**
- Tarif/Zyklus/Add-on werden im Webhook aus den **bezahlten Preis-IDs** der
  Subscription abgeleitet (items[] ↔ `PADDLE_PRICE_*`-Env), NICHT aus
  custom_data — das veraltet bei Tarifwechseln im Paddle-Portal. custom_data
  liefert nur noch die `user_id`. Unbekannte Preis-IDs → Event wird ignoriert
  (Ausnahme: Kündigungen kommen immer durch).
- **Reihenfolge-Schutz:** `abos.letztes_event_am` speichert das occurred_at des
  zuletzt angewendeten Events; ältere (verspätete) Events werden verworfen.
- **Konto-Löschung kündigt zuerst das Paddle-Abo** (sofort wirksam); schlägt
  das fehl, wird die Löschung mit klarer Meldung abgebrochen — keine
  Abbuchungen nach Kontolöschung.
- Webhook lehnt Bodies > 64 KB früh ab (öffentliche Route, HMAC-Rechenlast).

## Tarif-Matrix (aus `/preise` übernommen)
- **Kostenlos:** 1 Einheit, Basisverwaltung.
- **Privat (7,99 €/M · 79 €/J):** bis 5 Einheiten + NK-PDF, Steuer, Dokumente, Mieterportal.
- **Plus (12,99 €/M · 129 €/J):** bis 24 Einheiten + Service-Portal, KI-Import, Kalkulatoren, Beleihung.
- **Business (auf Anfrage):** ab 25 Einheiten, Hausverwaltung — KEIN Self-Service-Checkout.

## Aktivierungs-Checkliste (in dieser Reihenfolge)
1. ~~**Vercel Pro** buchen~~ ✅ **29.07.2026 erledigt** — kommerzielle Nutzung erlaubt, Vercel-DPA aktiv.
2. **AGB + Widerrufsbelehrung anwaltlich freigeben** (Fernabsatz, digitale Leistung,
   Erlöschen des Widerrufs bei sofortiger Bereitstellung) — Geld annehmen erst danach.
3. **Paddle-Konto** anlegen (paddle.com, Verifizierung des Gewerbes dauert einige Tage).
   Erst **Sandbox** durchtesten, dann Production.
4. Im Paddle-Dashboard: Produkte + Preise anlegen (Privat/Plus je Monat/Jahr) und die
   **Default Payment Link**-Domain setzen (Checkout-Einstellungen → sonst liefert die API
   keine `checkout.url`).
5. **Webhook-Destination** anlegen: `https://www.myimmoapp.de/api/billing/webhook`,
   Events `subscription.activated/created/updated/canceled/past_due/paused/resumed`.
   Secret notieren.
6. **Vercel-Env setzen:** `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`,
   `PADDLE_ENV=production` (vorher `sandbox`), `PADDLE_PRICE_PRIVAT_MONAT`,
   `PADDLE_PRICE_PRIVAT_JAHR`, `PADDLE_PRICE_PLUS_MONAT`, `PADDLE_PRICE_PLUS_JAHR`.
   (`SUPABASE_SERVICE_ROLE_KEY` muss gesetzt sein — braucht der Webhook.)
7. **End-to-End in der Sandbox testen:** Checkout → Webhook kommt an → `abos`-Zeile
   entsteht → Abo-Tab zeigt den Tarif → Kündigung im Portal → Status `gekuendigt`.
8. **Datenschutzerklärung ergänzen (PFLICHT vor dem ersten Checkout):** Paddle-Passus
   aufnehmen — Paddle ist als Merchant of Record **eigenständig Verantwortlicher**
   (wie Google beim Login, KEIN AVV nötig): Empfänger von Name/E-Mail/Zahlungsdaten,
   Zweck Zahlungsabwicklung/Rechnungen, Paddle-Datenschutzerklärung verlinken.
9. **Preise öffentlich schalten:** In `lib/preise.ts` `PREISE_SICHTBAR = true` setzen.
   Damit kommen in EINEM Schritt zurück: die Tarifübersicht auf `/preise` (statt der
   reinen FAQ-Seite, inkl. `noindex`-Entfernung), der Preis-Teaser auf der Startseite,
   der Menüpunkt „Preise" (heißt bis dahin „FAQ"), der Sitemap-Eintrag, die
   Tarif-Links im Abo-Tab der Einstellungen und die preisbezogenen FAQ-Antworten.
   Vorher prüfen, ob die Beträge in `components/landing/data.tsx` (`PLAENE`) noch
   mit `lib/plan.ts` und den Paddle-Preisen übereinstimmen.
10. **Scharf schalten:** `BILLING_ENFORCED=true` setzen + auf der `/preise`-Seite den
   Early-Access-Hinweis entfernen und die CTAs auf den Abo-Tab zeigen lassen.
11. Feature-Gates in den wichtigsten Server-Actions aktivieren (NK-PDF, Steuer-Export,
    KI-Import, Mieter-Einladung, Objekt-Anlage über Limit) — Muster siehe oben.
12. Bestandsnutzer per E-Mail/In-App **rechtzeitig vorab informieren** (Fairness +
    AGB-Änderungsfrist); niemand wird automatisch kostenpflichtig.

## Offen / bewusst NICHT gebaut
- **Kein automatischer Feature-Entzug** in allen Actions — die Gates werden bei der
  Aktivierung eingesetzt (Punkt 9), damit Early-Access-Nutzer heute nichts merken.
- **Business-Tarif:** kein Checkout (auf Anfrage → E-Mail), bewusst.
- **Abo-Zugangscodes** (Merkliste): können auf dem `einladungscodes`-Fundament ergänzt
  werden, sind aber mit Paddle-Checkout nicht mehr zwingend.
