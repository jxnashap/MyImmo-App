# Brevo — Data Protection Agreement (archivierte Kopie)

**Snapshot-Datum:** 30.08.2026 · **Quelle:** <https://corp-backend.brevo.com/wp-content/uploads/2024/08/BREVO-Annex-2-DPA-150524.pdf>
(verlinkt von <https://www.brevo.com/legal/termsofuse/>)
**Bezeichnung laut Dokument:** „ANNEX 2 — DATA PROTECTION AGREEMENT ('DPA')"
**Stand:** Dateiname `…-DPA-150524` → **15.05.2024**; PDF-Erstellung 07.08.2024. Eine
Versionsnummer im Fließtext gibt es nicht — deshalb ist die Datei selbst der Nachweis.

> Archivierte Zusammenfassung der Kernklauseln zum Nachweis nach Art. 28 DSGVO.
> Verbindlich ist der Volltext; er liegt vollständig daneben:
> **`brevo-dpa-2024-05-15.pdf`** (abgerufen 30.08.2026).

## Abschluss / Wirksamkeit — keine Unterschrift nötig
Der DPA ist **Anlage zu den Brevo General Terms and Conditions**:

> „This DPA is annexed to the Brevo General Terms and Conditions."

Und in Schedule 3 ausdrücklich zur Unterschriftsfrage:

> „Signature and date: The Parties agree that execution of the General Terms and Conditions
> and the DPA constitutes execution of this Schedule by both Parties."

➡️ Mit dem Vertragsschluss (Kontoeröffnung / Annahme der Nutzungsbedingungen) ist der AVV
**bereits wirksam**. Das ist das Muster von Vercel und Anthropic — **nicht** das von Supabase,
wo eine Fassung gesondert signiert wurde.

## Vertragspartner
**Sendinblue SAS** (Marke „Brevo"), Sitz Frankreich.
Datenschutzbeauftragter: **dpo@brevo.com**, postalisch: Sendinblue/Brevo, DPO,
7 rue de Madrid, 75008 Paris, Frankreich. (Section 11)

## Kernklauseln
- **Rolle:** Brevo ist Auftragsverarbeiter des Kunden — oder Unterauftragsverarbeiter, wenn
  der Kunde selbst Auftragsverarbeiter ist (Präambel, Fall (ii)). **Für MyImmo gilt Fall (i)**:
  MyImmo ist beim Vorlagen-Verteiler Verantwortlicher, Brevo Auftragsverarbeiter.
- **Standardvertragsklauseln (SCCs):** *Section 7.3* — bei Übermittlung ohne
  Angemessenheitsbeschluss sind die SCCs Bestandteil des DPA.
  **Module Two** (Verantwortlicher → Auftragsverarbeiter) ist der für MyImmo einschlägige Fall.
  Ausgestaltung: Klausel 7 (Docking) gilt **nicht**; Klausel 9(a) **Option 2** (allgemeine
  Genehmigung) mit der Frist aus Section 6.2; Klausel 17 Option 1, **anwendbares Recht: Frankreich**;
  Klausel 18(b): **Gerichtsstand Paris**. Bei Widerspruch zwischen DPA und SCCs gehen die
  **SCCs vor** (*Section 7*).
- **Unterauftragsverarbeiter:** *Section 6.2* — Ankündigung von Neuaufnahme oder Austausch
  **mindestens 10 Werktage** vorher, mit **Widerspruchsrecht** aus berechtigten
  Datenschutzgründen. Findet Brevo keine Alternative, darf der Kunde die betroffenen Leistungen
  **kündigen**. ⚠️ Die Ankündigung geht an die im Konto hinterlegte Adresse — **die muss also
  gelesen werden**, sonst läuft die Frist ins Leere.
- **Datenschutzverletzung:** *Section 5.3* — Meldung an den Kunden binnen **72 Stunden** ab
  Kenntnis, mit den für eine Behördenmeldung nötigen Angaben.
- **Löschung:** *Section 8.1* — Vernichtung oder Anonymisierung nach einer „incompressible
  period" von **100 Tagen** nach Vertragsende. ⚠️ Deutlich länger als bei Anthropic (30 Tage).
  Eigene Sicherung/Übertragung muss **innerhalb** dieser Frist erfolgen.
- **Audit:** *Section 10* — Brevo stellt die Nachweise zur Compliance bereit, testet die
  Sicherheitsmaßnahmen regelmäßig und übergibt auf Anfrage den jeweils aktuellen Prüfbericht
  an den Kunden oder dessen Auditor.
- **TOM:** Schedule 2 (Zugangs-/Zugriffskontrolle, Protokollierung, 24/7-Logüberwachung,
  Verschlüsselung nach Stand der Technik, Mitarbeiterschulungen).

## Unterauftragsverarbeiter (Schedule 1, Stand 15.05.2024)

| Unterauftragsverarbeiter | Zweck | Sitz | Serverstandort | Absicherung |
|---|---|---|---|---|
| Google Cloud Platform | Hosting | Frankreich | Belgien | DPF + SCC |
| Scaleway/Iliad | Hosting | Frankreich | Frankreich | — (EU) |
| OVH | Hosting | Frankreich | Frankreich | — (EU) |
| Hetzner Online GmbH | Hosting | Deutschland | Deutschland | — (EU) |
| Cloudflare | CDN & WAF | USA | USA/EU | DPF + SCC |
| Zendesk | Ticket-/Supportsystem | USA | EU/USA | BCR + SCC (Data-Centre-Add-on) |
| **Datadog** | **Logüberwachung & Debugging** | USA/EU | **USA** | **nur DPF** |
| Looker (auf GCP) | Dashboards | USA | EU/USA | DPF + SCC |
| Integry | Integration Drittsoftware | USA | EU/USA | SCC |
| Convrrt | Landingpages | USA | USA | SCC |
| Sendinblue GmbH | Konzern: Support & Wartung | Deutschland | DE/FR/BE | — (EU) |
| Silver Line LLC | Konzern: Support & Wartung | **Indien** | FR/BE | SCC |
| Sendinblue Inc. | Konzern: Support & Wartung | USA | FR/BE | DPF + SCC |
| Sendinblue Canada Inc. | Konzern: Support & Wartung | Kanada | FR/BE | Angemessenheitsbeschluss |

**Die letzten drei Spalten waren der Grund, die Datenschutzerklärung am 30.08.2026 zu ändern.**
Dort stand „die Verarbeitung findet in der EU statt" — das stimmt für die Verteiler- und
Versanddaten, ist als pauschale Aussage aber **falsch**: Datadog verarbeitet Protokolldaten in
den **USA**, Zendesk und Convrrt ebenfalls, Support und Wartung laufen unter anderem über
**Indien**. Die Erklärung weist das jetzt aus (Ziffern 3 g, 4 und 5).

## Für das Verarbeitungsverzeichnis (Art. 30 DSGVO)
- Auftragsverarbeiter: **Sendinblue SAS**, 7 rue de Madrid, 75008 Paris, Frankreich
- Datenschutzkontakt: **dpo@brevo.com**
- Vertragsgrundlage: Annex 2 (DPA) zu den General Terms and Conditions, Stand 15.05.2024
- Transfermechanismus: **SCCs Module Two**, Recht Frankreichs, Gerichtsstand Paris
- Löschfrist nach Vertragsende: **100 Tage**
- Meldefrist bei Datenpanne: **72 Stunden**

## Was hier NICHT erledigt ist
Zwei Punkte lassen sich nur im eingeloggten Brevo-Konto erledigen und liegen beim Betreiber:

1. **Rechtsdokumente im Konto prüfen** (Kontoname oben rechts → Einstellungen →
   Rechtsdokumente): ob dort eine signierbare oder eine neuere Fassung als 15.05.2024 liegt.
   Falls ja, diese Datei hier ersetzen.
2. **Firmendaten im Konto auf die Gewerbeanmeldung bringen** (MyImmo, Einzelunternehmen,
   Bad Schwartau). Der AVV lautet auf die im Konto hinterlegte Partei — stimmen die Daten
   nicht, ist der Vertragspartner formal der Falsche. Dabei zugleich prüfen, an welche Adresse
   die Unterauftragsverarbeiter-Ankündigungen gehen (10-Werktage-Frist, siehe oben).
