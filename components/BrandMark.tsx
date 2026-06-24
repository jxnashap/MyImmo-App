// MyImmo-Wortmarke (wie im Logo): "My" in Textfarbe, "Immo" gold-kursiv,
// darunter gesperrte Unterzeile. Theme-fähig über CSS-Variablen
// (passt sich Hell-/Dunkelmodus automatisch an).

export default function BrandMark({
  size = "lg",
  subtitle = true,
}: {
  size?: "sm" | "lg";
  subtitle?: boolean;
}) {
  const fs = size === "lg" ? "2.5rem" : "1.75rem";
  return (
    <div className="select-none text-center">
      <div className="serif leading-none" style={{ fontSize: fs }}>
        <span style={{ color: "var(--text)" }}>My</span>
        <span style={{ color: "var(--gold)", fontStyle: "italic" }}>Immo</span>
      </div>
      {subtitle && (
        <div
          className="mt-2 font-medium uppercase"
          style={{ fontSize: "0.62rem", letterSpacing: "0.28em", color: "var(--muted)" }}
        >
          Privates Immobilien-Management
        </div>
      )}
    </div>
  );
}
