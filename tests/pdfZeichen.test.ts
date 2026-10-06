import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfText } from "@/lib/pdf/zeichen";

// Design-Scan 06.10.2026: „Yılmaz“ wurde in jedem PDF zu „Y?lmaz“, „−“ im Jahresbericht zu „?“.
describe("pdfText()", () => {
  it("Buchstaben ohne Zerlegung bekommen einen Ersatz statt „?“", () => {
    expect(pdfText("Yılmaz")).toBe("Yilmaz");
    expect(pdfText("Łukasz Wałęsa")).toBe("Lukasz Walesa");
    expect(pdfText("Đorđević")).toBe("Dordevic");
  });
  it("Akzente werden abgestreift, Umlaute, ß und € bleiben", () => {
    expect(pdfText("Čapek, Ștefan")).toBe("Capek, Stefan");
    expect(pdfText("Müßiggang 1.250,00 €")).toBe("Müßiggang 1.250,00 €");
  });
  it("Satzzeichen außerhalb WinAnsi werden ersetzt", () => {
    expect(pdfText("Kreditrate − Zins")).toBe("Kreditrate - Zins");
    expect(pdfText("„Text“ – … ≥ 3")).toBe("„Text“ – … >= 3");
    expect(pdfText("1 234 €")).toBe("1 234 €");
  });
  it("nur wo nichts hilft, kommt „?“", () => {
    expect(pdfText("Иван")).toBe("????");
  });
  it("jedes Ergebnis lässt sich mit Helvetica zeichnen", async () => {
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    const roh = "Yılmaz Čapek − „x“ … ≥ ẞ œ → ✓ Иван € ÄÖÜß ­";
    expect(() => f.widthOfTextAtSize(pdfText(roh), 10)).not.toThrow();
  });
});
