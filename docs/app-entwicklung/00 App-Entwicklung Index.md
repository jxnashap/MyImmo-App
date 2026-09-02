# App-Entwicklung — Wissensspeicher

> **Zweck:** Aus einer Ideenskizze eine fertige App bauen, ohne Entscheidungen,
> Verträge und Fallstricke neu zu erarbeiten. Alles hier ist aus dem Bau von
> **MyImmo** gewonnen — 358 Dateien, 46.019 Zeilen, 395 Testfälle, 18
> Migrationen, 66 Seiten, 20 API-Routen (Stand 02.09.2026).
>
> **Aufnahmeschwelle: `docs/VAULT-REGELN.md` — vor dem Schreiben lesen.**

## Reihenfolge beim Bauen

- [[01 Vorgehen von der Idee zur Live-App]] — die Etappen, was in welcher zuerst
- [[02 Code-Regeln und Architektur]] — wie der Code aussehen muss
- [[03 Design und Layout]] — Marke, Token, Dokumente, Icons
- [[04 Rechner und Kalkulatoren]] — der heikelste Teil, eigene Regeln
- [[05 Anbindungen und Vertraege]] — Anbieter, Env, was Geld kostet
- [[06 Recht und Compliance]] — DSGVO, Gewerbe, Berufsrecht
- [[07 Volatile Kennzahlen und Pruefzyklus]] — was altert und wann geprüft wird
- [[08 Fehlerkatalog]] — echte Fehler mit Ursache und Gegenprüfung
- [[09 Neue App bauen]] — der Ablauf für die nächste App (Neubau)
- [[10 Bestehendes Projekt ueberarbeiten]] — Ablauf, wenn schon Code existiert

## Die fünf Sätze, die am meisten gekostet haben

1. **„Das fehlt noch."** — Mehrere Punkte standen monatelang als offen, obwohl
   sie längst gebaut waren (Onboarding-Tour, Open Banking Etappen 1–4). **Vor
   jeder solchen Aussage in `docs/PROJEKT-STATUS.md` nachsehen.**
2. **„Der Schalter ist gesetzt, also greift er."** — Supabase Leaked Password
   Protection ist auf dem Free-Plan sichtbar, aber wirkungslos. Empirisch
   geprüft: „Password123!" ging durch. Schalter ≠ Wirkung.
3. **„Sieht gut aus."** — Zwölf App-Icons wurden mit einem 87 px hohen schwarzen
   Streifen ausgeliefert, weil der Renderer nicht auf voller Höhe zeichnete.
   Sichtbar, aber nicht gemessen. **Was ausgeliefert wird, wird gemessen.**
4. **„Ich rechne das kurz nach."** — Die Grunderwerbsteuer war einmal um Faktor
   1000 verrechnet, weil ein Maschinenwert (`0.035`) durch den deutschen
   Zahlenparser lief. Rechenlogik gehört in reine Funktionen mit Tests.
5. **„Das ist doch nur ein Text im Icon."** — Eine Wortmarke, die unter 120 px
   zerfällt, und ein Alphakanal führen zur Ablehnung im App Store. Plattform-
   Vorgaben sind keine Geschmacksfrage.

## Was diesen Stack ausmacht

**Next.js 14 (App Router) · Supabase (Postgres + Auth + RLS) · Vercel ·
TypeScript · vitest.** Kein Storage-Bucket (Dateien als Base64 in Spalten),
keine eigene Backend-Schicht, keine ORM-Zwischenlage. Server Actions statt
API-Routen, wo möglich. Die Zugriffskontrolle liegt **in der Datenbank** (RLS),
nicht in der Anwendung.

Diese Wahl trägt bis in den mittleren fünfstelligen Nutzerbereich und kostet bis
dahin fast nichts. Ihre Grenze: alles, was lange läuft (Video, große Batches),
und alles, was Echtzeit-Kollaboration braucht.
