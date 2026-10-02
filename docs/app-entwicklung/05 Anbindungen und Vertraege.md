# 05 — Anbindungen und Verträge

**Grundregel: Vertrag und AVV zuerst, Code danach.** In MyImmo wurde Open
Banking vollständig gebaut, bevor Anbietervertrag und AVV standen — der Code
liegt seitdem inaktiv. Nicht falsch, aber gebundenes Kapital.

## Auswahlkriterien für einen Anbieter

1. **Verarbeitet er in der EU?** Sonst SCC prüfen und in der
   Datenschutzerklärung ausweisen.
2. **Gibt es einen AVV — und wie?** Drei Muster, die sich grundlegend
   unterscheiden:
   - **Automatisch über die AGB** (Vercel ab Pro, Anthropic Commercial Terms,
     Brevo Anlage 2) → keine Unterschrift, aber **PDF mit Version und
     Abrufdatum archivieren**.
   - **Signierbar im Dashboard** (Supabase über PandaDoc, auch auf Free) →
     unterschreiben und ablegen.
   - **Gar keiner nötig** (Google OAuth-Login → eigenständig Verantwortlicher,
     nur Passus in der Datenschutzerklärung).
3. **Braucht es eine Lizenz?** Bei Kontozugriff: **nur Lesezugriff über einen
   lizenzierten Anbieter (AISP)** → keine eigene BaFin-Lizenz. Kein
   Zahlungsverkehr.
4. **Was kostet er im Betrieb?** Laufende Kosten je Konto/Monat entscheiden über
   das Preismodell, nicht umgekehrt.
5. **Existiert er in zwei Jahren noch?** GoCardless/Nordigen hat Neuanmeldungen
   eingestellt (geprüft 12.07.2026) — ein bereits eingeplanter Anbieter fiel weg.

## Env-Variablen — Regeln

- **Alles mit `NEXT_PUBLIC_` landet im ausgelieferten JavaScript.** Geheimnisse
  bekommen dieses Präfix nie. In MyImmo stand ein Zugangscode dadurch einmal im
  Quelltext; der Rückfall auf die `NEXT_PUBLIC_`-Variante ist bis heute im Code
  und in `CLAUDE.md` als Falle markiert.
- **Jede Env wird dokumentiert, bevor sie gebraucht wird** — Zweck, wo sie
  herkommt, was passiert, wenn sie fehlt.
- **Fehlt eine Pflicht-Env, wird ehrlich abgebrochen.** `/api/newsletter`
  antwortet mit 503, statt einen Versand vorzutäuschen. Ein stiller No-op ist
  schlimmer als ein Fehler.
- **Nach dem Ändern einer Env ist ein Redeploy nötig**, sonst gilt der alte Wert.
- **Schlüssel gehören nicht in die Datenbank**, die sie schützen sollen.

## Fremdzugriff absichern

- **Cron-Routen** mit einem Geheimnis schützen (`CRON_SECRET`), identisch in
  Vercel und als GitHub-Repo-Secret.
- **Service-Role-Keys** umgehen RLS → ausschließlich serverseitig
  (`lib/supabase/admin.ts`), nie im Client, nie in Logs.
- **Rate-Limit auf alles, was geraten werden kann.** Ein gemeinsames Geheimnis
  ist die lohnendste Angriffsfläche: 8 Versuche je 15 Minuten und IP machen
  Durchprobieren unpraktikabel.

## KI-Anbindung

MyImmo nutzt Claude für OCR und Import. Zwei Wege, umschaltbar in `lib/aiRoute.ts`:
- **Direkt über die Anthropic-API** (`ANTHROPIC_API_KEY`) — einfach, aber
  Drittlandtransfer (SCC, kein DPF).
- **Über Amazon Bedrock in eu-central-1** — Verarbeitung bleibt in der EU, AVV
  über AWS. Braucht IAM-User mit `bedrock:InvokeModel` und die
  Inference-Profile-ID der Region (EU nutzt `eu.`-Profile).

**Vorgehen:** Fehlt eine der Bedrock-Env, läuft automatisch der direkte Call.
Diese Art Rückfall gehört dokumentiert, sonst hält man die EU-Route für aktiv,
obwohl sie es nicht ist.

**Wichtig:** SigV4-Signierung ist gegen den AWS-Testvektor geprüft
(`tests/bedrock.test.ts`) — der echte End-to-End-Call erst nach dem AWS-Setup.
Der Unterschied zwischen „Signatur korrekt" und „funktioniert" gehört benannt.

## Bezahlung

**Merchant of Record (Paddle)** statt eigener Abwicklung: Paddle wird der
Vertragspartner des Kunden (Reverse-Charge) — das nimmt Umsatzsteuer und
Rechnungsstellung ab, ist aber bei der Kleinunternehmerfrage zu berücksichtigen.

**Muster für gebaut-aber-inaktiv:** Tabelle + Tarifmatrix + Webhook + UI stehen,
durchgesetzt wird erst per Env `BILLING_ENFORCED=true`. Ohne Anbieter-Env ist
alles ein No-op. Die Tarife sind über **einen** Schalter (`PREISE_SICHTBAR` in
`lib/preise.ts`) ein- und ausblendbar — Seite, Teaser, Menü, Sitemap, FAQ in
einem. Ein Schalter statt zehn Stellen.

Aktivierungsreihenfolge steht in `docs/BEZAHLSYSTEM.md`.

## Statisches Ausliefern (Beiwerk, Schulungsmaterial)

Nicht alles gehört in die App. Ein Arbeitsblatt oder eine Schulungsseite ist
besser als **eigenständige statische Seite** aufgehoben — kein Build, keine
Datenbank, keine Kopplung an die Produktions-App.

Zwei Fallen aus der Praxis:
- **Für ein Deployment braucht die Seite einen vollständigen Dokumentrahmen.**
  Ohne `<!doctype html>` läuft der Browser im Quirks-Modus, und das fällt je
  nach Browser unterschiedlich auf.
- **Ein privater Link mit Anmeldezwang ist für Dritte unbrauchbar.** Wer eine
  Seite an Externe geben will, braucht eine öffentliche Adresse ohne Login —
  und eine kurze, die man abtippen kann, falls ein QR-Code scheitert.
