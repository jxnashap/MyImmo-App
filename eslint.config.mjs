// ESLint (Flat Config) — eingerichtet mit der Next-16-Migration (30.09.2026).
//
// Bis dahin hat `npm run lint` NIE gelint: Es gab keine Konfiguration, und
// `next lint` startete nur den interaktiven Einrichtungsdialog. Next 16 hat
// `next lint` entfernt; ESLint läuft jetzt eigenständig.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Bewusst unbenutzte Platzhalter (Schnittstellen-Parameter, herausgefilterte
    // Felder) tragen einen Unterstrich — so steht die Absicht im Namen.
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_",
        caughtErrors: "none",
      }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Fremdcode: installierte Skills (MIT, emilkowalski/skills).
    ".agents/**",
    // Arbeitsordner des Design-Scans (gitignored, scripts/designscan/).
    ".scan/**",
  ]),
]);
