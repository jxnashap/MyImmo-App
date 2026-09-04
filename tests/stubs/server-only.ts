// Leerer Ersatz fuer das Paket `server-only` in der Testumgebung.
//
// `import "server-only"` laesst den Build fehlschlagen, sobald ein Modul
// versehentlich aus einer Client-Komponente importiert wird — bei Tarif- und
// Zahlungslogik (lib/planGate.ts) genau die Absicherung, die man haben will.
// Vitest laeuft aber im Node-Environment ohne Next-Aufloesung und fand das
// Paket nicht. Der Import bleibt deshalb im Quellcode stehen; nur die Tests
// bekommen hier ein leeres Modul untergeschoben (vitest.config.ts).
export {};
