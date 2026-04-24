import { useState } from 'react';

function ChevronIcon({ open }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function OptimizationAccordion({ data }) {
  const [open, setOpen] = useState(false);

  return (
    <section style={{ marginBottom: '32px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          backgroundColor: '#111111',
          border: '1px solid #1e1e1e',
          borderRadius: open ? '12px 12px 0 0' : '12px',
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          color: '#ffffff',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a1a1a')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111111')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            className="label-caps"
            style={{ color: '#aaaaaa', fontSize: '0.72rem' }}
          >
            Optimization Data
          </span>
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          style={{
            backgroundColor: '#0d0d0d',
            border: '1px solid #1e1e1e',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            padding: '28px 32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '24px',
          }}
        >
          {data.map((item) => (
            <div key={item.label}>
              <div
                className="label-caps"
                style={{ color: '#444444', marginBottom: '10px' }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  marginBottom: '6px',
                }}
              >
                {item.value}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#555555' }}>
                {item.note}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
