# Live auf Vercel deployen

Ziel: eine feste URL, die bei jeder Änderung automatisch neu baut.
Dafür braucht Vercel den Code aus einem **GitHub-Repo**. Zwei Wege —
wähle einen.

---

## Weg A — GitHub + Vercel (empfohlen, auto-Deploy bei jeder Änderung)

**Schritt 1 — Repo auf GitHub anlegen und Code hochladen**
1. Auf https://github.com/new ein Repository erstellen, z.B. `myimmo` (privat).
2. Den Inhalt des Ordners `myimmo` hochladen — am einfachsten mit
   **GitHub Desktop** (https://desktop.github.com): „Add Local Repository"
   → Ordner `myimmo` wählen → „Publish".
   (Die `.env.local` wird dank `.gitignore` automatisch NICHT mit hochgeladen — gut so.)

**Schritt 2 — In Vercel importieren**
1. Auf https://vercel.com → **Add New… → Project** → das Repo `myimmo` importieren.
   Vercel erkennt Next.js automatisch.
2. Unter **Environment Variables** diese zwei eintragen:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://kozhxrvyilkchjpcuwcm.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (siehe `.env.local`, Zeile 2) |

3. **Deploy** klicken. Nach ~1 Min bekommst du eine URL wie
   `https://myimmo-xxxx.vercel.app`.

Ab jetzt: jede Änderung, die ich mache und die du nach GitHub schiebst,
deployt Vercel automatisch auf dieselbe URL.

---

## Weg B — Schnell ohne GitHub (Vercel CLI, einmalige URL)

Im Ordner `myimmo` im Terminal:

```bash
npm install        # einmalig
npx vercel         # fragt nach Login, dann Enter für die Vorgaben
```

Beim ersten Lauf fragt die CLI nach den beiden Env-Variablen oben
(oder du trägst sie danach im Vercel-Dashboard nach). Ergebnis: eine
Preview-URL. Für die finale Adresse:

```bash
npx vercel --prod
```

---

## Wichtig: Supabase Auth-Redirect

Damit Login auf der Live-URL funktioniert, in Supabase einmal die URL
freigeben: **Dashboard → Authentication → URL Configuration →
Site URL / Redirect URLs** → deine Vercel-URL eintragen.
