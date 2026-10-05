import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` existiert nur im Next-Build. Ohne diesen Ersatz koennen
      // Tests keine Datei importieren, die es verwendet (u. a. lib/planGate.ts).
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Standard sind 5 s. Tests, die eine Route samt Abhängigkeiten zum ersten Mal importieren,
    // brauchten unter Last im vollen Lauf 5,0–5,6 s (allein 1,2 s) und fielen sporadisch aus —
    // ein Zeitlimit, kein Fehler im Code. 20 s lässt echte Hänger weiterhin scheitern.
    testTimeout: 20_000,
  },
});
