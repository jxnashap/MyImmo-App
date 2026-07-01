import Bankgespraech from "@/components/kalkulator/Bankgespraech";
import PrintButton from "@/components/PrintButton";

export default function BankgespraechPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Bankgespräch</div>
          <div className="topbar-sub">Druckfertige Übersicht für deine Bank</div>
        </div>
        <div style={{ marginLeft: "auto" }}><PrintButton /></div>
      </div>
      <Bankgespraech />
    </div>
  );
}
