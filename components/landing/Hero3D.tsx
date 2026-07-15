// 3D-Hero-Szene in reinem CSS: ein langsam rotierendes, goldenes Gebäude
// (Quader mit Fenster-Raster) mit schwebenden Kennzahl-Chips davor.
// Kein JavaScript, keine externen Assets — läuft unter der strikten CSP
// und wird bei prefers-reduced-motion eingefroren.
// (Kann später durch ein gerendertes 3D-Asset ersetzt werden.)

export default function Hero3D() {
  return (
    <div className="h3d-wrap" aria-hidden>
      <div className="h3d-glow" />
      <div className="h3d-scene">
        <div className="h3d-haus">
          {/* Quader: 4 Wände + Dachfläche */}
          <div className="h3d-face h3d-front">
            {Array.from({ length: 12 }, (_, i) => <i key={i} className={i % 5 === 1 ? "an" : undefined} />)}
          </div>
          <div className="h3d-face h3d-back">
            {Array.from({ length: 12 }, (_, i) => <i key={i} />)}
          </div>
          <div className="h3d-face h3d-links">
            {Array.from({ length: 8 }, (_, i) => <i key={i} className={i === 2 ? "an" : undefined} />)}
          </div>
          <div className="h3d-face h3d-rechts">
            {Array.from({ length: 8 }, (_, i) => <i key={i} className={i === 5 ? "an" : undefined} />)}
          </div>
          <div className="h3d-face h3d-dach" />
          <div className="h3d-boden" />
        </div>

        {/* Schwebende Kennzahl-Chips */}
        <div className="h3d-chip h3d-chip1">
          <span className="lbl">Cashflow / Mo.</span>
          <span className="val plus">+ 640 €</span>
        </div>
        <div className="h3d-chip h3d-chip2">
          <span className="lbl">Miete eingegangen</span>
          <span className="val ok">✓ bestätigt</span>
        </div>
        <div className="h3d-chip h3d-chip3">
          <span className="lbl">Auftrag freigegeben</span>
          <span className="val gold">von unterwegs</span>
        </div>
      </div>
    </div>
  );
}
