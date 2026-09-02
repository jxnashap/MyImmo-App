# MyImmo — Handoff (veraltet, ersetzt)

> **Dieses Dokument wird nicht mehr gepflegt.**
> Sein Inhalt stammte aus einer sehr frühen Projektphase (13 Tabellen, 18 Tests,
> alte Vercel-Domain) und war zuletzt an mehreren Stellen schlicht falsch.
> Am 28.08.2026 auf einen Zeiger reduziert, statt es weiter halb-aktuell zu halten.

Der aktuelle Stand steht in:

- **`docs/BRIEFING.md`** — für neue Chats/Sessions **zuerst lesen** (Kurzeinstieg).
- **`docs/PROJEKT-STATUS.md`** — vollständiges Feature-Inventar, Kennzahlen,
  „gebaut aber inaktiv", „nur der Betreiber kann das".
- **`CLAUDE.md`** — Arbeitsweise, Merkliste, Deployment, Env-Variablen.
- **`docs/MASTERPLAN.md`** — Markt, Compliance, Roadmap.

Zwei Punkte aus der alten Fassung, die weiterhin gelten und sonst verloren gingen:

- **Squash-Merge-Gotcha:** Nach dem Merge nicht auf demselben Branch weiterarbeiten —
  lokal auf `origin/main` zurücksetzen **und** `origin/<branch>` mit
  `--force-with-lease` nachziehen, sonst meldet der Stop-Hook „unverified".
- **SWC** stolpert über `<` in JSX-Kommentaren (`{/* … < … */}`) → vermeiden.
