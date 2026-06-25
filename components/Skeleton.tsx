// Wiederverwendbare Lade-Platzhalter (Server-Komponenten, reine CSS-Animation).
// Werden von den loading.tsx-Dateien genutzt und erscheinen automatisch, während
// die Server-Komponente ihre Daten lädt (Next.js Suspense).

export function Skeleton({
  w = "100%",
  h = 14,
  r = 6,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: React.CSSProperties;
}) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function TopbarSkeleton() {
  return (
    <div className="topbar">
      <div style={{ flex: 1 }}>
        <Skeleton w={200} h={26} />
        <Skeleton w={130} h={12} style={{ marginTop: 8 }} />
      </div>
      <Skeleton w={120} h={36} r={8} />
    </div>
  );
}

export function KpiGridSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid-4 mb-20">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="kpi-card">
          <Skeleton w={80} h={10} />
          <Skeleton w={110} h={24} style={{ marginTop: 12 }} />
          <Skeleton w={60} h={11} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="section">
      <div className="section-header">
        <Skeleton w={160} h={14} />
      </div>
      <div className="section-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skeleton w={32} h={32} r={8} />
            <Skeleton w={`${70 - i * 8}%`} h={14} />
            <Skeleton w={70} h={14} style={{ marginLeft: "auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="prop-grid">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="prop-card">
          <div className="prop-card-header">
            <Skeleton w={42} h={42} r={9} />
            <div style={{ flex: 1 }}>
              <Skeleton w="70%" h={15} />
              <Skeleton w="45%" h={11} style={{ marginTop: 8 }} />
            </div>
          </div>
          <div className="prop-card-stats">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="prop-stat">
                <Skeleton w={40} h={14} style={{ margin: "0 auto" }} />
                <Skeleton w={30} h={9} style={{ margin: "6px auto 0" }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
