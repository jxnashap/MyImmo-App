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
    },
  },
  plugins: [],
};
export default config;
