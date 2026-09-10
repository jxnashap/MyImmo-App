# Betreiber-Checkliste

Stand **10.09.2026**. Alles hier ist **kein Code** — ein Dashboard, ein Anwalt oder ein
Blick in einen Browser. Claude kann es weder erledigen noch nachprüfen.

Kurzfassung mit Reihenfolge steht in `CLAUDE.md` unter „👤 NUR DER BETREIBER".
Hier stehen die Wortlaute und die Begründungen.

---

## 1. Supabase: URL-Konfiguration ⚠️ dringend

**Authentication → URL Configuration**

| Feld | Wert |
|---|---|
| Site URL | `https://www.myimmoapp.de` |
| Redirect URLs | `https://www.myimmoapp.de/auth/passwort` ergänzen |

**Warum es zählt:** `redirectTo` wirkt nur, wenn die URL **wörtlich** in der Liste steht.
Fehlt sie, verwirft Supabase das Ziel **stillschweigend** — keine Fehlermeldung — und nimmt
die Site URL. Steht die noch auf `http://localhost:3000`, führt jeder Mail-Link ins Nichts.

**Bitte melden, was vorher drinstand.** Steht dort `localhost`, sind auch die
**Registrierungs-Bestätigungsmails** betroffen, und das wäre ein zweiter kaputter Weg.

---

## 2. Supabase: E-Mail-Vorlage „Reset Password" ⚠️ dringend

**Authentication → Emails → Reset Password**

```html
<h2>Passwort zurücksetzen</h2>
<p>Klicke hier, um ein neues Passwort zu wählen:</p>
<p><a href="{{ .SiteURL }}/auth/passwort?token_hash={{ .TokenHash }}&type=recovery">Neues Passwort wählen</a></p>
```

**Warum:** Die Standard-Vorlage schickt einen PKCE-`code`. Der lässt sich **nur in dem
Browser** einlösen, der den Reset angefordert hat — der zugehörige Schlüssel liegt dort
lokal. Reset am Rechner anstoßen und die Mail am Handy öffnen scheitert damit zwangsläufig,
und das ist der Normalfall, nicht die Ausnahme.

`token_hash` hat das Problem nicht: Den prüft der Server direkt bei Supabase.

Setzt voraus, dass die **Site URL** (Punkt 1) stimmt — die Vorlage baut den Link daraus.

---

## 3. „Passwort vergessen" testen ⚠️ dringend

Der Weg ist gebaut (PR #325–#328), aber **nie mit einer echten Mail erfolgreich
durchlaufen**. Nur der Test zeigt, ob er hält.

1. `/login` → „Passwort vergessen?"
2. Mail öffnen, Link klicken
3. **Erwartung:** Seite „Neues Passwort wählen", zwei Felder, **keins fürs alte Passwort**
4. Nach dem Speichern: auf allen Geräten abgemeldet — das ist Absicht

**Wenn es scheitert**, steht in der Adresszeile ein `grund=`. Den bitte melden:

| `grund=` | Bedeutung | Nächster Schritt |
|---|---|---|
| `geraet` | `code` kam an, ließ sich nicht einlösen — anderer Browser, oder Link schon benutzt | Punkt 2 erledigen |
| `ohne-token` | Beim Server kam **keine** Kennung an (Token steckt im URL-Fragment, das der Browser nie sendet) | Punkt 2 erledigen |
| `abgelaufen` | Link war wirklich alt oder schon benutzt | neuen anfordern |

Bitte **beide Fälle** durchspielen: Mail auf demselben Gerät öffnen, und Mail auf dem Handy.

---

## 4. Die zwei restlichen Passwort-Schalter

**Authentication → Sign In / Providers → Email → Password Security**

- „Secure password change"
- „Require current password when updating"

**Erst nach Punkt 3.** Die Voraussetzungen im Code sind gebaut (PR #327), aber:

Die Supabase-Doku nennt **keine Ausnahme für Recovery** bei „Require current password".
Es ist offen, ob dieser Schalter den gerade gebauten Reset-Weg blockiert —
`components/PasswortNeu.tsx` kann kein altes Passwort mitschicken, weil der Nutzer keines
hat. **Unmittelbar nach dem Umlegen erneut testen.** Bricht es: Schalter wieder aus. Die
Absicherung leisten dann der Anmeldeversuch in der App plus „Secure password change" —
immer noch deutlich mehr als vorher.

---

## 5. Leaked Password Protection: Gegenprobe

Der Schalter ist seit 09.09.2026 an. **Die Wirkung ist ungeprüft.**

Registrierung mit `Password123!` versuchen — muss **scheitern**.

**Warum die Probe nötig ist:** Am 29.07.2026 ging genau diese Registrierung durch,
**obwohl der Schalter gesetzt war**. Ein Schalter, dessen Wirkung nie beobachtet wurde,
ist eine Annahme.

---

## 6. Zwei-Faktor einmal durchspielen

Einstellungen → Sicherheit → einrichten · abmelden · mit Code anmelden ·
„Handy nicht zur Hand?" mit einem Wiederherstellungscode einlösen.

Die Logik ist durchgetestet, **der Ablauf im Browser nie**.

---

## 7. StBerG-Anfrage an den Anwalt

`docs/compliance/StBerG-ANFRAGE.md` ist fertig formuliert — die vier Steuerfunktionen,
die Bildschirmtexte, drei Fragen, und was bis zur Antwort gilt. Nur noch verschicken.

Auf derselben Liste stehen: § 34i GewO (Finanzierungs-Assistent), Impressum,
Datenschutzerklärung und der Nutzer-AVV.

---

## 8. Vercel: Log-Aufbewahrung

**Dashboard → Observability → Logs** (oder Plan-Vergleich): Wie lange werden
Runtime-Logs aufbewahrt?

Die Zahl fehlt als einzige konkrete Angabe in `/datenschutz` Ziffer 3 d. Weder die
öffentliche Doku noch die API geben sie her — deshalb steht dort derzeit, was
nachweislich stimmt („wir legen keine eigenen Kopien an") statt einer erfundenen Frist.
Art. 13 Abs. 2 lit. a DSGVO will Dauer **oder** Kriterien; besser wäre die Zahl.

---

## 9. Kleinsttexte 11px → 12px

`app/globals.css`, Token `--text-xs` auf `12px`, dann Seiten durchklicken.

Bricht etwas — `.tz-rest` hat eine feste Breite von 84px, Badges und Kpi-Labels sind in
gesperrten Großbuchstaben gesetzt — **eine Zeile zurück**.

**Kein Test findet einen hässlichen Umbruch.** Das muss jemand ansehen.

---

## 10. Brevo-Konto (AVV-Rest)

1. Einstellungen → Rechtsdokumente: gibt es eine neuere Fassung als 15.05.2024?
2. Firmendaten auf die Gewerbeanmeldung bringen (MyImmo, Einzelunternehmen, Bad Schwartau)
   — sonst lautet der Vertrag auf die falsche Partei.
3. An welche Adresse gehen die Unterauftragsverarbeiter-Ankündigungen? Die
   10-Werktage-Widerspruchsfrist verfällt ungelesen.

---

## 11. Altes kurzes Passwort

Stichprobe: Kann sich ein Bestandskonto mit weniger als 8 Zeichen noch anmelden?
Die Regel gilt für **neue und geänderte** Passwörter, nicht rückwirkend.
