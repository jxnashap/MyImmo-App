"use client";

// E-Mail-Hinweise an/aus (02.10.2026) — für Mieter (/konto) und Vermieter
// (Einstellungen → Sicherheit). Die Mails sagen nur, DASS etwas bereitliegt.
import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { setzeBenachrichtigungen } from "@/lib/actions/benachrichtigung";

export default function BenachrichtigungSchalter({ aus: anfangsAus, mieter }: { aus: boolean; mieter: boolean }) {
  const [aus, setAus] = useState(anfangsAus);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  return (
    <div className="section" style={{ margin: 0 }}>
      <div className="section-header"><h3><Bell size={15} style={{ verticalAlign: "-2px" }} /> Benachrichtigungen</h3></div>
      <div className="section-body" style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!aus}
            disabled={pending}
            onChange={(e) => {
              const neuAus = !e.target.checked;
              startTransition(async () => {
                const f = actionFehler(await setzeBenachrichtigungen(neuAus));
                if (f) { toast(f, "error"); return; }
                setAus(neuAus);
                toast(neuAus ? "E-Mail-Hinweise abgeschaltet." : "E-Mail-Hinweise eingeschaltet.");
              });
            }}
          />
          <span>
            E‑Mail, wenn im Mieterportal etwas Neues für mich bereitliegt
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {mieter
                ? "Neue Dokumente, Nachrichten und Terminvorschläge deines Vermieters."
                : "Neue Anliegen, Nachrichten und Terminbestätigungen deiner Mieter."}{" "}
              Die E‑Mail nennt keinen Inhalt — den siehst du nur nach der Anmeldung.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
