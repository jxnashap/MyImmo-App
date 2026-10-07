// EINE Regel „selbst bewohnt“ (Gesamtprüfung 07.10.2026, A2). Selbst bewohnte Objekte bringen keine
// Einkünfte nach § 21 EStG — keine Anlage V, keine AfA und keine Kosten als Werbungskosten. Vorher
// kannte nur die Abo-Kostenbuchung diese Regel; die Anlage V führte solche Objekte mit AfA.

export const istSelbstBewohnt = (objStatus: string | null | undefined): boolean => /selbst\s*bewohnt/i.test(objStatus ?? "");
