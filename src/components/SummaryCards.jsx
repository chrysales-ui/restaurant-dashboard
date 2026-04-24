export default function SummaryCards({ cards }) {
  return (
    <section style={{ marginBottom: '24px' }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#ffffff',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          4-Week Period Summary
        </h2>
        <span
          className="label-caps"
          style={{
            color: '#444444',
            fontSize: '0.65rem',
          }}
        >
          Feb 2026
        </span>
      </div>

      {/* Cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
        }}
      >
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              backgroundColor: '#111111',
              border: '1px solid #1e1e1e',
              borderRadius: '10px',
              padding: '28px 28px',
            }}
          >
            <div
              className="label-caps"
              style={{ color: '#555555', marginBottom: '14px' }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#ffffff',
                marginBottom: '8px',
              }}
            >
              {card.value}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#444444' }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
