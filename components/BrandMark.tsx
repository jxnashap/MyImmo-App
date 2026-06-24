// MyImmo-Wortmarke (wie im Dokument-/PDF-Logo): "My" dunkel, "Immo" gold-kursiv,
// darunter gesperrte Unterzeile. Bewusst feste helle Farben für die Auth-Screens.

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
        <span style={{ color: "#1f1e1b" }}>My</span>
        <span style={{ color: "#bf962e", fontStyle: "italic" }}>Immo</span>
      </div>
      {subtitle && (
        <div
          className="mt-2 font-medium uppercase"
          style={{ fontSize: "0.62rem", letterSpacing: "0.28em", color: "rgba(0,0,0,0.42)" }}
        >
          Privates Immobilien-Management
        </div>
      )}
    </div>
  );
}
