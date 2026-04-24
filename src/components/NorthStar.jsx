export default function NorthStar({ data }) {
  return (
    <section
      style={{
        backgroundColor: '#111111',
        border: '1px solid #1e1e1e',
        borderRadius: '12px',
        padding: '48px 56px',
        marginBottom: '24px',
      }}
    >
      <div className="label-caps" style={{ color: '#22c55e', marginBottom: '24px' }}>
        The North Star
      </div>

      <div
        style={{
          fontSize: 'clamp(5rem, 12vw, 9rem)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: '#ffffff',
          marginBottom: '16px',
        }}
      >
        {data.value}
      </div>

      <div
        style={{
          fontSize: '1.1rem',
          color: '#aaaaaa',
          marginBottom: '8px',
        }}
      >
        {data.label}
      </div>

      <div
        style={{
          fontSize: '0.9rem',
          color: '#666666',
          marginBottom: '20px',
        }}
      >
        {data.subtitle}
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: '#22c55e',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        {data.trend}
      </div>
    </section>
  );
}
