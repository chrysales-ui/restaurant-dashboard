function KpiCell({ kpi }) {
  return (
    <div style={{ flex: 1, padding: '32px 40px' }}>
      <div
        className="label-caps"
        style={{ color: '#666666', marginBottom: '16px' }}
      >
        {kpi.label}
      </div>
      <div
        style={{
          fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: '#ffffff',
          marginBottom: '12px',
        }}
      >
        {kpi.value}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.8rem', color: '#555555' }}>
          prev 4wk: {kpi.prev}
        </span>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: kpi.positive ? '#22c55e' : '#ef4444',
          }}
        >
          {kpi.change}
        </span>
      </div>
    </div>
  );
}

export default function KpiRow({ kpis }) {
  const cells = Object.values(kpis);

  return (
    <section
      style={{
        backgroundColor: '#111111',
        border: '1px solid #1e1e1e',
        borderRadius: '12px',
        display: 'flex',
        marginBottom: '24px',
        overflow: 'hidden',
      }}
    >
      {cells.map((kpi, i) => (
        <div
          key={kpi.label}
          style={{
            display: 'flex',
            flex: 1,
            borderLeft: i > 0 ? '1px solid #1e1e1e' : 'none',
          }}
        >
          <KpiCell kpi={kpi} />
        </div>
      ))}
    </section>
  );
}
