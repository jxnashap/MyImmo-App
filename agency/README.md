# AI Agency OS — n8n-Umsetzung

Die lauffähige Fassung der Verfassung v0.2 aus
[`docs/zukunft/AI-AGENCY-OS.md`](../docs/zukunft/AI-AGENCY-OS.md):
**sechs Rollen statt 29**, Budgetdeckel, Audit-Gate, Freigabe durch den
Betreiber, Wochenbericht mit den fünf Zahlen.

---

## Was hier läuft — und was ausdrücklich nicht

| Schicht | Wo | Aufgabe |
|---|---|---|
| Steuerung | **n8n** | Vorgänge, Rollenwahl, Budget, Audit, Freigabe, Bericht |
| Denken | **Claude API** (`claude-opus-5`) | die fünf Rollen + Auditor |
| Zustand | **eigenes Supabase-Projekt** | Vorgänge, Läufe, Kosten, Audits, Gedächtnis |
| Ausführung von Code | **Claude Code + GitHub** | Umsetzung auf Branch, PR, Merge |
| Messung | **MyImmo** `/api/intern/kennzahlen` | die fünf Zahlen, nur Aggregate |

**n8n schreibt keinen Code und fasst die Produktion nicht an.** Die Rolle „Bau"
liefert eine technische Spezifikation; daraus wird bei Freigabe ein
GitHub-Issue, das in Claude Code umgesetzt wird — Branch, Tests, PR, Merge wie
bisher. Das ist Absicht: ein Automat, der unbeaufsichtigt in `main` schreibt,
ist genau das Risiko, gegen das der ganze Rest hier gebaut ist.

## Drei Sicherheitsentscheidungen, die nicht verhandelbar sind

1. **Eigenes Supabase-Projekt für die Agency.** n8n braucht einen
   Service-Role-Key, und der umgeht RLS. Läge das Agency-Schema im
   MyImmo-Produktionsprojekt, hätte ein kompromittierter n8n-Server Zugriff auf
   alle Vermieter- **und Mieterdaten**. Das Free-Tier reicht.
2. **Kennzahlen nur über die geschützte Route.** `/api/intern/kennzahlen`
   läuft serverseitig mit dem Service-Key und gibt ausschließlich Aggregate
   heraus (Anzahlen, Quoten). n8n bekommt keinen Datenbankzugang zu MyImmo.
3. **Tabellen liegen im Schema `agency`, nicht in `public`.** Damit sind sie
   über die Supabase-REST-Schnittstelle nicht erreichbar. Zugriff nur über die
   `public.agency_*`-Funktionen, die ausschließlich `service_role` ausführen
   darf. Technische Umsetzung von „kein Agent eskaliert seine eigenen Rechte".

---

## Einrichtung in acht Schritten

### 1 · n8n bereitstellen
Entweder **n8n Cloud** (Starter ~24 €/Monat, nichts zu betreiben) oder
**selbst gehostet** per Docker auf einem kleinen VPS (~5 €/Monat, dafür
Updates, Backups und TLS in Eigenregie).

```bash
docker run -d --name n8n -p 5678:5678 \
  -e N8N_HOST=agency.example.de -e WEBHOOK_URL=https://agency.example.de/ \
  -e GENERIC_TIMEZONE=Europe/Berlin \
  -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

> Webhooks müssen von außen erreichbar sein (die Freigabe-Links im E-Mail
> gehen dorthin). Selbst gehostet: Reverse Proxy mit TLS davor, **kein**
> offener Port ohne HTTPS.

### 2 · Agency-Datenbank anlegen
Neues Supabase-Projekt (Name z. B. `myimmo-agency`, Region `eu-central-1`).
Dann SQL-Editor → Inhalt von [`sql/01_agency_schema.sql`](sql/01_agency_schema.sql)
einfügen → Run. Das Skript ist idempotent, wiederholtes Ausführen ist harmlos.

### 3 · Monatsdeckel setzen — sonst läuft nichts
Der Deckel steht bewusst auf `0`, damit kein Vorgang startet, bevor eine Zahl
entschieden ist. Im SQL-Editor:

```sql
update agency.einstellungen set wert = '25' where schluessel = 'monatsdeckel_usd';
```

Zur Einordnung (Preise Stand 09/2026, `claude-opus-5`: 5 USD je Mio.
Eingabe-Token, 25 USD je Mio. Ausgabe-Token): Ein mittlerer Vorgang mit Audit
liegt grob bei 0,10–0,40 USD. 25 USD sind also rund 60–250 Vorgänge im Monat —
mehr, als ein Mensch im Nebenerwerb sinnvoll lesen kann. Fang klein an.

Optional die Pflichtschwellen (Standard: beide ab `hoch`):
```sql
update agency.einstellungen set wert = 'mittel' where schluessel = 'auditpflicht_ab';
```

### 4 · Rollen einspielen
```bash
AGENCY_SUPABASE_URL=https://<ref>.supabase.co \
AGENCY_SUPABASE_SERVICE_KEY=<service-role-key> \
node agency/scripts/rollen-laden.mjs
```
Vorher ohne Datenbank prüfen: `node agency/scripts/rollen-laden.mjs --trocken`.

Die Prompts liegen unter [`rollen/`](rollen/) und gehören ins Repo — sie sind
die eigentliche Logik dieser Organisation. Nach jeder Änderung das Skript
erneut laufen lassen.

### 5 · Zugangsdaten in n8n anlegen
Fünf Einträge unter *Credentials*. **Keiner davon steht im Workflow-JSON.**

| Name in n8n | Typ | Inhalt |
|---|---|---|
| `Agency Supabase` | Supabase API | Host = Agency-Projekt-URL, Service-Role-Key |
| `Anthropic x-api-key` | Header Auth | Name `x-api-key`, Wert = Anthropic-API-Key |
| `Brevo api-key` | Header Auth | Name `api-key`, Wert = `BREVO_API_KEY` |
| `MyImmo CRON_SECRET` | Header Auth | Name `Authorization`, Wert `Bearer <CRON_SECRET>` |
| `GitHub Token` | Header Auth | Name `Authorization`, Wert `Bearer <PAT mit repo-Scope>` |

> Der GitHub-Eintrag wird nur von Workflow 04 gebraucht. Wer noch keine
> Ausführung will, lässt ihn weg — der Knoten ist auf „Fehler nicht
> weiterreichen" gestellt und blockiert die Freigabe nicht.

### 6 · Workflows importieren
n8n → *Workflows* → *Import from File*, in dieser Reihenfolge:

| Datei | Auslöser | Zweck |
|---|---|---|
| [`n8n/02-auditor.json`](n8n/02-auditor.json) | Webhook `agency-auditor` | Prüfung, wird von 01 gerufen |
| [`n8n/01-vorgang.json`](n8n/01-vorgang.json) | Webhook `agency-vorgang` | der Hauptweg |
| [`n8n/03-wochenbericht.json`](n8n/03-wochenbericht.json) | Cron Mo 07:00 | die fünf Zahlen |
| [`n8n/04-freigabe.json`](n8n/04-freigabe.json) | Webhook `agency-freigabe` | Freigabe-Links + Ausführung |

In **jedem** Workflow den Knoten **Konfiguration** öffnen und den Block oben
ausfüllen (Supabase-URL, die eigenen Webhook-URLs, E-Mail-Adressen,
GitHub-Repo). Das ist der einzige Ort, an dem etwas anzupassen ist.

Danach jeden Workflow aktivieren und die Zugangsdaten in den HTTP-Knoten
zuordnen (n8n fragt beim ersten Öffnen danach).

### 7 · MyImmo-Seite vorbereiten
`/api/intern/kennzahlen` ist bereits Teil der App. Nötig sind die vorhandenen
Vercel-Env `CRON_SECRET` und `SUPABASE_SERVICE_ROLE_KEY`. Optional:

```
INTERN_AUSSCHLUSS=j.scharp,@meinetestdomain.de
```
Komma-Liste eigener und Test-Konten, die nicht als Kunden zählen sollen. Das
Demo-Konto und `@example.com` sind immer ausgeschlossen.

Prüfen:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://www.myimmoapp.de/api/intern/kennzahlen | jq
```

### 8 · Erster Testlauf (niedriges Risiko, kein Audit, keine Freigabe)
```bash
curl -X POST https://DEIN-N8N/webhook/agency-vorgang \
  -H "content-type: application/json" \
  -d '{
    "titel": "Rückkehrer-Quote verstehen",
    "ziel": "Von 15 externen Konten sind 3 an einem zweiten Tag wiedergekommen. Nenne die drei wahrscheinlichsten Ursachen und für jede das billigste Experiment, das sie bestätigt oder ausschließt.",
    "rolle": "produkt",
    "risiko": "niedrig"
  }'
```
Erwartung: Antwort mit Ergebnis, `urteil: PASS (übersprungen)`, gebuchte Kosten
und eine E-Mail. In der Datenbank steht ein Vorgang mit einem Lauf.

Danach dasselbe mit `"risiko": "hoch"` — jetzt läuft das Audit, und die E-Mail
enthält zwei Knöpfe (Freigeben / Ablehnen).

---

## Die Schnittstelle

`POST https://DEIN-N8N/webhook/agency-vorgang`

```json
{
  "titel":  "kurzer Titel",
  "ziel":   "was genau herauskommen soll",
  "rolle":  "produkt | bau | recht | wachstum",
  "risiko": "niedrig | mittel | hoch | kritisch",
  "kontext":"optional: Zahlen, Vorgeschichte, Randbedingungen"
}
```

**Die Risikostufe steuert alles Weitere** (Standard: Audit und Freigabe ab `hoch`):

| Stufe | Beispiele | Folge |
|---|---|---|
| `niedrig` | Recherche, Analyse, Entwurf | läuft durch |
| `mittel` | Inhalte, SEO, nicht-kritische Produktänderung | läuft durch, E-Mail zur Kenntnis |
| `hoch` | Produktions-Deploy, Ausgaben, Sicherheit, Kundendaten, Außenkommunikation | Audit **und** Freigabe |
| `kritisch` | unumkehrbares Löschen, Verträge, rechtliche Bindung | Audit **und** Freigabe |

Die Stufe wird vom Aufrufer gesetzt und nicht vom Modell — bewusst: ein System,
das seine eigene Risikoeinstufung wählt, stuft sich herunter.

---

## Was das Ganze davon abhält, ins Leere zu laufen

- **Budget:** Jeder Lauf wird mit Token und Kosten gebucht. Ist der Monatsdeckel
  erreicht, wird kein neuer Vorgang mehr angelegt — der Aufruf antwortet mit
  einer Begründung statt zu starten. Cache-Token werden zum vollen
  Eingangspreis gebucht: lieber zu hoch schätzen als einen Deckel, der nicht hält.
- **Audit:** Der Auditor prüft drei Dinge gegen die Wirklichkeit — Annahme als
  Tatsache formuliert, widersprechende oder fehlende Messzahl, billigeres
  Experiment. `FAIL` beendet den Vorgang **in der Datenbank**, nicht im
  Workflow; damit kann kein anderer Schritt das Urteil umdeuten.
- **Freigabe:** Der Link trägt einen Zufallstoken aus der Datenbank und wirkt
  genau einmal. Eine erratene Vorgangs-ID reicht nicht.
- **Wochenbericht:** prüft jeden Montag die Abbruchkriterien aus
  `docs/zukunft/AI-AGENCY-OS.md` 4.4 und schreibt sie in die Mail. Damit stehen
  sie nicht nur im Dokument.

## Wartung

```bash
node agency/scripts/workflows-pruefen.mjs   # vor jedem Import
node agency/scripts/rollen-laden.mjs        # nach jeder Prompt-Änderung
```

Bei neuen Modellen oder Preisänderungen `agency.preise` aktualisieren —
sonst rechnet der Deckel mit veralteten Zahlen. Ein unbekanntes Modell wird
**nicht** mit 0 gebucht, sondern abgelehnt.

## Was bewusst fehlt

Kein Dashboard (fünf Zahlen passen in eine E-Mail), keine 29 Agenten, keine 12
Vorgangszustände, kein Paperclip, keine automatische Ausführung in der
Produktion. Begründung je Punkt: `docs/zukunft/AI-AGENCY-OS.md`, Abschnitt 7.

## Rückbau

Workflows in n8n deaktivieren, Agency-Supabase-Projekt pausieren. In MyImmo
bleibt nur `/api/intern/kennzahlen` — die Route ist auch ohne n8n nützlich und
kostet nichts.
