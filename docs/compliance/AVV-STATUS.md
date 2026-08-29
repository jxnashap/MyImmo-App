# AVV-/DPA-Status & Abschluss-Checkliste

Stand: 28.08.2026 · Ergänzt das AVV-Dossier und `docs/MASTERPLAN.md`.
Trägt den tatsächlichen Abschluss-/Erledigungsstand nach (Datum + „von wem").

## Status je Anbieter

| Anbieter | Rolle | Mechanismus (USA) | Abschluss | Erledigt am |
|---|---|---|---|---|
| **Anthropic** | Auftragsverarbeiter (OCR) | **SCCs** im DPA (NICHT DPF) | automatisch mit Commercial Terms | **15.07.2026 archiviert** (`anthropic-dpa-archiv.md`) |
| **Supabase** | Auftragsverarbeiter (DB/Auth) | SCCs + TIA (kein DPF) | Dashboard → Org → Documents (PandaDoc) | ✅ **24.07.2026 signiert** (Jonas Scharp/Owner, PandaDoc; `supabase-dpa-signiert-2026-07-24.pdf` + `supabase-tia-2025-03-14.pdf`) |
| **Vercel** | Auftragsverarbeiter (Hosting) | DPF ✓ + SCCs | automatisch in ToS ab Pro-Plan | ✅ **29.07.2026** — Konto ist auf Pro, AVV greift über die ToS |
| **Google** | eigenständig Verantwortlicher (OAuth-Login) | DPF ✓ (Google LLC) | **kein AVV** — nur Datenschutzerklärungs-Passus | ✅ Passus vorhanden |
| **Brevo** (Sendinblue GmbH/SAS) | Auftragsverarbeiter (Vorlagen-Verteiler) | Sitz Frankreich, **Verarbeitung EU** — Transfer als **SCC** ausweisen (kein DPF) | **Anlage 2 („Annex 2 — DPA") zu den Nutzungsbedingungen**, gilt automatisch mit Vertragsschluss — i. d. R. **keine gesonderte Unterschrift** | ⬜ **offen**: Konto → Einstellungen → Rechtsdokumente prüfen, Firmendaten auf die Gewerbeanmeldung bringen, DPA-PDF archivieren (`brevo-dpa-archiv.md`) |
| ~~Enable Banking~~ | — | — | **Feature zurückgestellt (29.08.2026), aus der App entfernt** — kein AVV nötig, bis Open Banking wieder aufgebaut wird (`docs/zukunft/OPEN-BANKING.md`) | ⏸️ entfällt |
| **Paddle** (Bezahlsystem, inaktiv) | **Merchant of Record = eigenständig Verantwortlicher**, kein AVV | — | vor dem ersten Checkout: Datenschutz-Passus statt AVV | ⬜ offen (erst bei Aktivierung, `docs/BEZAHLSYSTEM.md`) |
| **MyImmo → Nutzer** | MyImmo = Auftragsverarbeiter der Vermieter | — | eigener AVV unter `/avv`, AGB-Einbeziehung | ⬜ anwaltlich prüfen |

## Anthropic — erledigt (15.07.2026)
- DPA-Kopie archiviert: `docs/compliance/anthropic-dpa-archiv.md`.
- DPF-Status geprüft: **Anthropic listet DPF nicht** auf der eigenen
  Zertifizierungsseite → Transfer über **SCCs** (Art. 46 DSGVO), die im DPA
  eingebunden sind. In der Datenschutzerklärung entsprechend als SCC-Transfer
  ausweisen (nicht auf DPF stützen).

## Supabase — Signier-Anleitung (✅ erledigt 24.07.2026 — PDF + TIA liegen in diesem Ordner)
Der DPA erfordert eine rechtsverbindliche Unterschrift mit euren Firmendaten —
das kann nur der Betreiber im eingeloggten Dashboard tun. Schritte:

1. **https://supabase.com/dashboard** öffnen → Organisation wählen.
2. **Organization → Documents** (Legal Documents):
   `https://supabase.com/dashboard/org/_/documents`.
3. **„Data Processing Addendum" / „Request DPA"** wählen → das **PandaDoc**-
   Formular öffnet sich.
4. Firmendaten ausfüllen (Rechtsform, Anschrift, Unterzeichner) und
   **elektronisch signieren**. Kostenlos, auch im Free-Plan.
5. Die gegengezeichnete Fassung herunterladen und hier ablegen
   (`docs/compliance/supabase-dpa-signiert-<datum>.pdf`).
6. Zusätzlich das **Transfer Impact Assessment** von Supabase ablegen:
   `https://supabase.com/downloads/docs/Supabase+TIA+250314.pdf`.

Danach in dieser Tabelle „Erledigt am" nachtragen.

## Offene Prüfaufträge
- [ ] Genutzte OCR-Modell-ID gegen die Anthropic-Retention-Klasse prüfen
      (Standard: minimale Speicherung / 30 Tage).
- [x] ~~Vercel auf Pro upgraden~~ ✅ 29.07.2026 erledigt — DPA gilt über die ToS.
- [ ] Eigenen Nutzer-AVV (`/avv`) + AGB anwaltlich prüfen lassen.
- [x] ~~Datenschutz-Passus für den Vorlagen-Verteiler (Brevo)~~ ✅ **28.08.2026** —
      `/datenschutz` Ziffer 3 g + Brevo in der Subprozessoren-Liste (Ziffer 4).
- [ ] **Brevo-AVV** abschließen/archivieren (Schritte in der Tabelle oben und in `CLAUDE.md`);
      Datenschutzkontakt **dpo@brevo.com** ins Verarbeitungsverzeichnis, Unterauftrags-
      verarbeiterliste und Benachrichtigungsadresse prüfen (Widerspruchsrecht).
