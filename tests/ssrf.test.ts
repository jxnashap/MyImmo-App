import { describe, it, expect } from "vitest";
import { istPrivateIp, pruefeZielUrl, ZielNichtErlaubtFehler } from "@/lib/net/ssrf";

// Der alte Schutz prüfte nur den Hostnamen der Eingabe-URL gegen eine
// Regex-Liste. Diese Tests decken genau die Wege ab, die daran vorbeikamen.

describe("istPrivateIp — IPv4", () => {
  it.each([
    ["127.0.0.1", "Loopback"],
    ["127.1.2.3", "Loopback-Bereich"],
    ["10.0.0.1", "privat"],
    ["172.16.0.1", "privat"],
    ["172.31.255.254", "privat (obere Grenze)"],
    ["192.168.1.1", "privat"],
    ["169.254.169.254", "Cloud-Metadaten"],
    ["0.0.0.0", "unspezifiziert"],
    ["100.64.0.1", "Carrier-Grade NAT"],
    ["198.18.0.1", "Benchmark-Netz"],
    ["224.0.0.1", "Multicast"],
    ["255.255.255.255", "Broadcast"],
  ])("blockt %s (%s)", (ip) => {
    expect(istPrivateIp(ip)).toBe(true);
  });

  it.each([["93.184.216.34"], ["8.8.8.8"], ["172.32.0.1"], ["172.15.0.1"], ["1.1.1.1"]])(
    "lässt öffentliche Adresse %s durch",
    (ip) => {
      expect(istPrivateIp(ip)).toBe(false);
    },
  );
});

describe("istPrivateIp — IPv6", () => {
  it.each([
    ["::1", "Loopback — vom alten Regex NICHT erfasst"],
    ["::", "unspezifiziert"],
    ["fe80::1", "Link-local"],
    ["fd00::1", "Unique local"],
    ["fc00::1", "Unique local"],
    ["ff02::1", "Multicast"],
    ["::ffff:127.0.0.1", "IPv4-mapped Loopback"],
    ["::ffff:169.254.169.254", "IPv4-mapped Metadaten"],
    ["fe80::1%eth0", "Link-local mit Zonen-Index"],
  ])("blockt %s (%s)", (ip) => {
    expect(istPrivateIp(ip)).toBe(true);
  });

  it("lässt öffentliche IPv6 durch", () => {
    expect(istPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("istPrivateIp — Ungültiges", () => {
  it.each([["kein-ip"], [""], ["999.1.1.1"], ["2130706433"], ["0x7f000001"]])(
    "blockt %s (kein gültiges IP-Literal)",
    (s) => {
      expect(istPrivateIp(s)).toBe(true);
    },
  );
});

describe("pruefeZielUrl", () => {
  const fehlerBei = async (u: string) => {
    try {
      await pruefeZielUrl(new URL(u));
      return null;
    } catch (e) {
      return e as Error;
    }
  };

  it("lehnt nicht-http(s)-Protokolle ab", async () => {
    const e = await fehlerBei("file:///etc/passwd");
    expect(e).toBeInstanceOf(ZielNichtErlaubtFehler);
  });

  it("lehnt IPv4-Loopback als Literal ab", async () => {
    expect(await fehlerBei("http://127.0.0.1/admin")).toBeInstanceOf(ZielNichtErlaubtFehler);
  });

  it("lehnt IPv6-Loopback ab (kam am alten Regex vorbei)", async () => {
    expect(await fehlerBei("http://[::1]/admin")).toBeInstanceOf(ZielNichtErlaubtFehler);
  });

  it("lehnt die Cloud-Metadaten-Adresse ab", async () => {
    expect(await fehlerBei("http://169.254.169.254/latest/meta-data/")).toBeInstanceOf(
      ZielNichtErlaubtFehler,
    );
  });

  it("lehnt dezimal kodiertes 127.0.0.1 ab (kam am alten Regex vorbei)", async () => {
    // 2130706433 ist kein IP-Literal → wird aufgelöst; der Resolver macht
    // daraus 127.0.0.1, was die IP-Prüfung fängt. Schlägt die Auflösung fehl,
    // gilt das Ziel ebenfalls als nicht erlaubt.
    expect(await fehlerBei("http://2130706433/")).toBeInstanceOf(ZielNichtErlaubtFehler);
  });

  it("lehnt localhost ab", async () => {
    expect(await fehlerBei("http://localhost:3000/")).toBeInstanceOf(ZielNichtErlaubtFehler);
  });

  it("lehnt nicht auflösbare Hosts ab", async () => {
    expect(await fehlerBei("http://kein.host.invalid/")).toBeInstanceOf(ZielNichtErlaubtFehler);
  });
});
