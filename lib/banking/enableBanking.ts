// Enable-Banking-Client (Open Banking, NUR Lesezugriff / AISP).
// Auth: selbst signierter JWT (RS256) mit dem privaten Schlüssel der
// registrierten Application — Header `kid` = Application ID.
// Env (Vercel): ENABLE_BANKING_APP_ID + ENABLE_BANKING_PRIVATE_KEY
// (privater Schlüssel wie DATA_ENCRYPTION_KEY behandeln: nie ins Repo/Logs).
// Nur serverseitig verwenden (Server Actions / Route Handler) — der private
// Schlüssel darf nie in Client-Bundles gelangen.
import { createHash, createPrivateKey, createSign } from "crypto";

const BASE = "https://api.enablebanking.com";

export function ebKonfiguriert(): boolean {
  return !!process.env.ENABLE_BANKING_APP_ID && !!process.env.ENABLE_BANKING_PRIVATE_KEY;
}

const b64url = (input: Buffer | string) =>
  (typeof input === "string" ? Buffer.from(input) : input).toString("base64url");

/** Kurzlebiger JWT für einen API-Call (RS256, 1 h Gültigkeit). */
function jwt(): string {
  const appId = process.env.ENABLE_BANKING_APP_ID;
  const pem = (process.env.ENABLE_BANKING_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!appId || !pem) throw new Error("Enable Banking ist nicht konfiguriert (Env-Variablen fehlen).");
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const payload = { iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = createSign("RSA-SHA256").update(input).sign(createPrivateKey(pem));
  return `${input}.${b64url(sig)}`;
}

async function ebFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Fehlertext bewusst gekürzt loggen — keine Tokens/Nutzdaten.
    throw new Error(`Enable Banking ${res.status} bei ${path}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------- Banken ----
export type Aspsp = { name: string; country: string; logo?: string | null };

/** Verfügbare Banken. In der Sandbox liefert u. a. "Mock ASPSP" (Testbank). */
export async function holeBanken(laender: string[] = ["DE", "FI"]): Promise<Aspsp[]> {
  const alle: Aspsp[] = [];
  for (const land of laender) {
    try {
      const r = await ebFetch<{ aspsps: Aspsp[] }>(`/aspsps?country=${land}`);
      alle.push(...(r.aspsps ?? []));
    } catch {
      // einzelnes Land darf fehlschlagen (z. B. leere Sandbox-Liste)
    }
  }
  const gesehen = new Set<string>();
  return alle.filter((a) => {
    const k = `${a.name}|${a.country}`;
    if (gesehen.has(k)) return false;
    gesehen.add(k);
    return true;
  });
}

// ---------------------------------------------------------- Autorisierung ----
/** Startet die Konto-Freigabe bei der Bank; liefert die Weiterleitungs-URL. */
export async function starteAutorisierung(opts: {
  aspspName: string;
  aspspCountry: string;
  redirectUrl: string;
  state: string;
  gueltigBis: Date; // PSD2: max. 90 Tage
}): Promise<string> {
  const r = await ebFetch<{ url: string }>(`/auth`, {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: opts.gueltigBis.toISOString() },
      aspsp: { name: opts.aspspName, country: opts.aspspCountry },
      state: opts.state,
      redirect_url: opts.redirectUrl,
      psu_type: "personal",
    }),
  });
  return r.url;
}

// ---------------------------------------------------------------- Session ----
export type EbSession = {
  session_id: string;
  accounts: (string | { uid?: string; identification_hash?: string })[];
  access?: { valid_until?: string };
  aspsp?: { name?: string; country?: string };
};

/** Tauscht den Redirect-Code gegen eine Session (enthält die Konto-UIDs). */
export async function erstelleSession(code: string): Promise<EbSession> {
  return ebFetch<EbSession>(`/sessions`, { method: "POST", body: JSON.stringify({ code }) });
}

export function accountUids(s: EbSession): string[] {
  return (s.accounts ?? [])
    .map((a) => (typeof a === "string" ? a : a.uid ?? ""))
    .filter(Boolean);
}

// ------------------------------------------------------------ Kontodetails ----
export type KontoDetails = {
  account_id?: { iban?: string | null };
  name?: string | null;
  currency?: string | null;
  product?: string | null;
};

export async function holeKontoDetails(accountUid: string): Promise<KontoDetails | null> {
  try {
    return await ebFetch<KontoDetails>(`/accounts/${accountUid}/details`);
  } catch {
    return null; // Details sind optional — Verbindung funktioniert auch ohne
  }
}

// ------------------------------------------------------------ Transaktionen ----
export type EbTransaktion = {
  entry_reference?: string | null;
  transaction_amount: { amount: string; currency?: string | null };
  credit_debit_indicator: "CRDT" | "DBIT";
  status?: string | null; // BOOK | PDNG
  booking_date?: string | null;
  value_date?: string | null;
  creditor?: { name?: string | null } | null;
  debtor?: { name?: string | null } | null;
  remittance_information?: string[] | null;
};

/** Alle gebuchten Transaktionen eines Kontos (folgt der Pagination). */
export async function holeTransaktionen(accountUid: string): Promise<EbTransaktion[]> {
  const alle: EbTransaktion[] = [];
  let continuation: string | null = null;
  for (let i = 0; i < 20; i++) {
    const q: string = continuation ? `?continuation_key=${encodeURIComponent(continuation)}` : "";
    const r = await ebFetch<{ transactions: EbTransaktion[]; continuation_key?: string | null }>(
      `/accounts/${accountUid}/transactions${q}`,
    );
    alle.push(...(r.transactions ?? []));
    continuation = r.continuation_key ?? null;
    if (!continuation) break;
  }
  return alle.filter((t) => (t.status ?? "BOOK") === "BOOK");
}

/** Stabile Referenz zum Deduplizieren (Fallback: Hash der Kernfelder). */
export function transaktionsRef(t: EbTransaktion): string {
  if (t.entry_reference) return t.entry_reference;
  const basis = [
    t.booking_date ?? t.value_date ?? "",
    t.transaction_amount.amount,
    t.credit_debit_indicator,
    (t.remittance_information ?? []).join(" "),
    t.creditor?.name ?? t.debtor?.name ?? "",
  ].join("|");
  return "h:" + createHash("sha256").update(basis).digest("hex").slice(0, 40);
}
