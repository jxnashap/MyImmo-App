"use client";

// Echter Toggle (role="switch") für Einstellungen mit Sofortwirkung —
// z. B. Dark/Light, Reauth-Erinnerung, private Umsätze ausblenden.
// Checkbox bleibt für Mehrfachauswahl; dies ist nur für binäre Sofort-Toggles.
// Vorgehaltenes Primitive — Adoption in Folge-Runde (z. B. Dark/Light-Toggle in SettingsView).
export default function Switch({
  checked,
  onChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch"
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    />
  );
}
