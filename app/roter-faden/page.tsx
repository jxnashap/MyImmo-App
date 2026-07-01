import RoterFaden from "@/components/kalkulator/RoterFaden";

export default function RoterFadenPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Roter Faden</div>
          <div className="topbar-sub">Schnell-Kalkulation Schritt für Schritt</div>
        </div>
      </div>
      <RoterFaden />
    </div>
  );
}
