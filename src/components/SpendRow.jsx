export default function SpendRow({ spend, coversPerVisitor }) {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px',
      }}
    >
      {/* Total Marketing Spend */}
      <div
        style={{
          backgroundColor: '#111111',
          border: '1px solid #1e1e1e',
          borderRadius: '12px',
          padding: '32px 40px',
        }}
      >
        <div
          className="label-caps"
          style={{ color: '#666666', marginBottom: '16px' }}
        >
          Total Mktg Spend
        </div>
        <div
          style={{
            fontSize: 'clamp(2.2rem, 4vw, 3rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            marginBottom: '10px',
          }}
        >
          {spend.total}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#555555' }}>
          {spend.breakdown}
        </div>
      </div>

      {/* Covers Per Web Visitor */}
      <div
        style={{
          backgroundColor: '#111111',
          border: '1px solid #1e1e1e',
          borderRadius: '12px',
          padding: '32px 40px',
        }}
      >
        <div
          className="label-caps"
          style={{ color: '#666666', marginBottom: '16px' }}
        >
          Covers Per Web Visitor
        </div>
        <div
          style={{
            fontSize: 'clamp(2.2rem, 4vw, 3rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            marginBottom: '10px',
          }}
        >
          {coversPerVisitor.value}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#555555' }}>
          {coversPerVisitor.subtitle}
        </div>
      </div>
    </section>
  );
}
