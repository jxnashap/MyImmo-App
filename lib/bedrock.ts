// Amazon-Bedrock-Anbindung für die KI-Routen (OCR / Objekt-Import).
//
// Zweck: Die Claude-Aufrufe laufen über Bedrock in eu-central-1 (AWS
// Frankfurt) statt über die direkte Anthropic-US-API. Damit bleibt die
// Verarbeitung der Nutzerdaten in der EU (kein Drittland-Transfer, AVV/DPA
// über AWS statt SCCs mit Anthropic-USA).
//
// Bewusst OHNE aws-sdk: eine schlanke SigV4-Signierung mit Node-crypto, damit
// keine schwere Dependency ins Bundle wandert. Das Antwort-Format von Bedrock
// ist identisch zur Anthropic-Messages-API (content-Array), sodass die
// Aufrufer (aiRoute/aiImport/nk-ocr) unverändert bleiben — callBedrock gibt
// ein echtes fetch-Response zurück.
//
// Aktivierung per Env (nur wenn ALLE gesetzt sind, sonst direkter API-Call):
//   BEDROCK_REGION           z. B. "eu-central-1" (Default, falls leer)
//   BEDROCK_ACCESS_KEY_ID    IAM-Access-Key mit bedrock:InvokeModel
//   BEDROCK_SECRET_ACCESS_KEY
//   BEDROCK_MODEL_ID         Bedrock-/Inference-Profile-ID des Modells,
//                            z. B. "eu.anthropic.claude-sonnet-4-...-v1:0"
//   BEDROCK_SESSION_TOKEN    optional (nur bei temporären STS-Credentials)

import { createHash, createHmac } from "crypto";

const SERVICE = "bedrock";
const DEFAULT_REGION = "eu-central-1";
const ANTHROPIC_BEDROCK_VERSION = "bedrock-2023-05-31";

export function bedrockKonfiguriert(): boolean {
  return Boolean(
    process.env.BEDROCK_ACCESS_KEY_ID &&
      process.env.BEDROCK_SECRET_ACCESS_KEY &&
      process.env.BEDROCK_MODEL_ID,
  );
}

const sha256Hex = (data: string | Buffer): string =>
  createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string): Buffer =>
  createHmac("sha256", key).update(data, "utf8").digest();

/** SigV4-Signaturschlüssel (verschachtelte HMAC-Kette). */
function signingKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export type SigV4Input = {
  method: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  canonicalUri: string;
  query?: string;
  /** Alle zu signierenden Header (Groß-/Kleinschreibung egal). */
  headers: Record<string, string>;
  payload: string;
  amzDate: string; // YYYYMMDDTHHMMSSZ
};

/**
 * Baut den Authorization-Header nach AWS Signature Version 4 (generisch, gegen
 * die offizielle AWS-Testsuite verifizierbar — siehe tests/bedrock.test.ts).
 */
export function sigV4Authorization(input: SigV4Input): { authorization: string; signedHeaders: string } {
  const dateStamp = input.amzDate.slice(0, 8);
  const payloadHash = sha256Hex(input.payload);

  // Header normalisieren: Key klein, Wert getrimmt; alphabetisch sortiert.
  const paare = Object.entries(input.headers)
    .map(([k, v]) => [k.toLowerCase(), v.trim()] as [string, string])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const canonicalHeaders = paare.map(([k, v]) => `${k}:${v}\n`).join("");
  const signedHeaders = paare.map(([k]) => k).join(";");

  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    input.query ?? "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    input.amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    signingKey(input.secretAccessKey, dateStamp, input.region, input.service),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, signedHeaders };
}

/** YYYYMMDDTHHMMSSZ aus einem Date. */
export function amzDate(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

/**
 * Ruft Claude über Bedrock (InvokeModel) auf und gibt ein fetch-Response
 * zurück, dessen Body Anthropic-kompatibel ist (content[].text). Das Feld
 * `model` aus dem Payload wird ignoriert — Bedrock adressiert das Modell über
 * die URL (BEDROCK_MODEL_ID).
 */
export async function callBedrock(payload: unknown, timeoutMs = 45_000): Promise<Response> {
  const region = process.env.BEDROCK_REGION || DEFAULT_REGION;
  const accessKeyId = process.env.BEDROCK_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.BEDROCK_SECRET_ACCESS_KEY!;
  const sessionToken = process.env.BEDROCK_SESSION_TOKEN || undefined;
  const modelId = process.env.BEDROCK_MODEL_ID!;

  // Payload für Bedrock umformen: model raus, anthropic_version rein.
  const { model: _model, ...rest } = (payload ?? {}) as Record<string, unknown>;
  const body = JSON.stringify({ anthropic_version: ANTHROPIC_BEDROCK_VERSION, ...rest });

  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const canonicalUri = `/model/${encodeURIComponent(modelId)}/invoke`;
  const url = `https://${host}${canonicalUri}`;
  const date = amzDate(new Date());

  const headers: Record<string, string> = {
    "content-type": "application/json",
    host,
    "x-amz-date": date,
  };
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;

  const { authorization } = sigV4Authorization({
    method: "POST",
    accessKeyId,
    secretAccessKey,
    region,
    service: SERVICE,
    canonicalUri,
    headers,
    payload: body,
    amzDate: date,
  });

  // fetch setzt host selbst; Authorization + X-Amz-* explizit mitgeben.
  const fetchHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Amz-Date": date,
    Authorization: authorization,
  };
  if (sessionToken) fetchHeaders["X-Amz-Security-Token"] = sessionToken;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "POST", headers: fetchHeaders, body, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
