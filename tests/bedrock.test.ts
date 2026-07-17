import { describe, it, expect } from "vitest";
import { sigV4Authorization, amzDate } from "@/lib/bedrock";

// Verifiziert die SigV4-Signierung gegen den offiziellen AWS-Testvektor
// „get-vanilla" der aws-sig-v4-test-suite. Damit ist der einzige nicht gegen
// echtes AWS testbare Baustein (die Signatur) belegbar korrekt.
describe("sigV4Authorization – AWS-Testvektor get-vanilla", () => {
  it("erzeugt exakt die erwartete Signatur", () => {
    const { authorization, signedHeaders } = sigV4Authorization({
      method: "GET",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      region: "us-east-1",
      service: "service",
      canonicalUri: "/",
      query: "",
      headers: {
        Host: "example.amazonaws.com",
        "X-Amz-Date": "20150830T123600Z",
      },
      payload: "",
      amzDate: "20150830T123600Z",
    });
    expect(signedHeaders).toBe("host;x-amz-date");
    expect(authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
        "SignedHeaders=host;x-amz-date, " +
        "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
  });
});

describe("amzDate", () => {
  it("formatiert nach YYYYMMDDTHHMMSSZ", () => {
    expect(amzDate(new Date("2026-07-17T08:09:10.123Z"))).toBe("20260717T080910Z");
  });
});
