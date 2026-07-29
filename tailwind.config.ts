import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: "var(--gold)", // folgt jetzt dem Theme (dunkel #D4A847 / hell #B8860B)
        ink: "#0F0F0E",      // bleibt fix = dunkler Text auf Gold, in beiden Themes korrekt
      },
      // Radien folgen den CSS-Tokens aus app/globals.css — sonst gaebe es zwei
      // Wahrheiten: `rounded-md` in TSX haette Tailwinds 6px genommen, waehrend
      // `var(--r-md)` im Stylesheet 12px bedeutet.
      //
      // Die Zuordnung ist so gewaehlt, dass sich am gerenderten Ergebnis NICHTS
      // aendert: xl und 2xl trafen mit 12px/16px schon die Tokenwerte, und die
      // neun Stellen mit `rounded-lg` (Tailwind-Standard 8px = Bedienelemente)
      // wurden auf `rounded-sm` umbenannt. `rounded-lg` steht ab jetzt fuer
      // grosse Karten (16px), wie im Stylesheet.
      borderRadius: {
        sm: "var(--r-sm)",     //  8px — Buttons, Inputs, Badges
        md: "var(--r-md)",     // 12px — Karten, Panels
        lg: "var(--r-lg)",     // 16px — grosse Karten, Modals
        xl: "var(--r-md)",     // Bestandsnutzung: war 12px, bleibt 12px
        "2xl": "var(--r-lg)",  // Bestandsnutzung: war 16px, bleibt 16px
        full: "var(--r-full)",
      },
    },
  },
  plugins: [],
};
export default config;
