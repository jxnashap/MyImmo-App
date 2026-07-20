"use client";

import { useState } from "react";
import { Building2, Home, ExternalLink, Landmark, Info } from "lucide-react";
import {
  filterProgramme, LANDESBANKEN, type Nutzung, type Vorhaben,
} from "@/lib/kauf/foerderung";

const VORHABEN: { id: Vorhaben; label: string }[] = [
  { id: "kauf_bestand", label: "Bestand kaufen" },
  { id: "neubau", label: "Neubau / Ersterwerb" },
  { id: "sanierung", label: "Sanieren" },
  { id: "heizung", label: "Heizung tauschen" },
];

const ART_BADGE: Record<string, { label: string; cls: string }> = {
  kredit: { label: "Kredit", cls: "badge-neutral" },
  zuschuss: { label: "Zuschuss", cls: "badge-green" },
  steuer: { label: "Steuerbonus", cls: "badge-green" },
};

export default function FoerderCheck() {
  const [nutzung, setNutzung] = useState<Nutzung>("vermieten");
  const [vorhaben, setVorhaben] = useState<Vorhaben>("kauf_bestand");
  const [land, setLand] = useState("");

  const treffer = filterProgramme(nutzung, vorhaben);
  const landesbank = land ? LANDESBANKEN[land] : null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Filter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg3)", border: "1px solid var(--line)" }}>
          {([["vermieten", "Vermieten", Building2], ["eigennutzen", "Selbst nutzen", Home]] as const).map(([id, label, Icon]) => {
            const aktiv = nutzung === id;
            return (
              <button key={id} type="button" onClick={() => setNutzung(id)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                  padding: "8px 14px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600,
                  background: aktiv ? "var(--gold)" : "transparent", color: aktiv ? "#1a1814" : "var(--muted)",
                  transition: "background .2s, color .2s",
                }}>
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {VORHABEN.map((v) => (
            <button key={v.id} type="button" onClick={() => setVorhaben(v.id)}
              className={`btn ${vorhaben === v.id ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: 12 }}>
              {v.label}
            </button>
          ))}
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 11.5, color: "var(--muted)", marginLeft: "auto" }}>
          Bundesland (Landesförderung)
          <select value={land} onChange={(e) => setLand(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 12.5, color: "var(--text)" }}>
            <option value="">– wählen –</option>
            {Object.keys(LANDESBANKEN).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>

      {/* Neutrale Einordnung (§ 34i GewO): informieren, nicht empfehlen. */}
      {treffer.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
          <strong>{treffer.length}</strong> {treffer.length === 1 ? "Programm kommt" : "Programme kommen"} laut
          deinen Angaben in Frage — <span style={{ color: "var(--faint)" }}>keine Empfehlung, du entscheidest selbst,
          was zu dir passt.</span>
        </p>
      )}

      {/* Treffer */}
      <div style={{ display: "grid", gap: 8 }}>
        {treffer.map((p) => (
          <a key={p.key} href={p.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", padding: "11px 14px", borderRadius: 10, background: "var(--bg3)", border: "1px solid var(--line)", textDecoration: "none", color: "var(--text)", transition: "border-color .2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
              <span className={`badge ${ART_BADGE[p.art].cls}`}>{ART_BADGE[p.art].label}</span>
              <span style={{ fontSize: 10.5, color: "var(--faint)", marginLeft: "auto" }}><ExternalLink size={11} style={{ verticalAlign: "-1px" }} /> {p.traeger}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{p.text}</div>
            {p.hinweis && <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{p.hinweis}</div>}
          </a>
        ))}
      </div>

      {/* Landesförderbank */}
      {landesbank && (
        <a href={landesbank.url} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--gold)", background: "var(--gold-pale, rgba(212,175,90,0.08))", textDecoration: "none", color: "var(--text)" }}>
          <Landmark size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 12.5 }}>
            <strong>Landesförderung {land}:</strong> {landesbank.bank}
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Eigene Wohnraum-Programme des Landes — oft mit KfW kombinierbar. Aktuelle Konditionen auf der Website prüfen.</div>
          </div>
          <ExternalLink size={13} color="var(--muted)" style={{ marginLeft: "auto", flexShrink: 0 }} />
        </a>
      )}

      <div style={{ display: "flex", gap: 7, fontSize: 10.5, color: "var(--faint)" }}>
        <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Stand 2026 — Programme und Konditionen ändern sich; vor dem Antrag beim Träger prüfen. Wichtig: Förderanträge fast immer <strong>vor</strong> Kaufvertrag bzw. Vorhabensbeginn stellen.</span>
      </div>
    </div>
  );
}
