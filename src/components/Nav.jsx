import { Link, useParams, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Dashboard', path: '' },
  { label: 'Ads', path: '/ads' },
  { label: 'Social Media', path: '/social' },
  { label: 'Influencer Partnerships', path: '/influencer' },
  { label: 'Blog', path: '/blog' },
  { label: 'Emails', path: '/emails' },
];

export default function Nav({ restaurantName }) {
  const { slug } = useParams();
  const location = useLocation();

  const getTabPath = (tabPath) => `/${slug}${tabPath}`;

  const isActive = (tabPath) => {
    const full = getTabPath(tabPath);
    if (tabPath === '') {
      return location.pathname === `/${slug}` || location.pathname === `/${slug}/`;
    }
    return location.pathname.startsWith(full);
  };

  return (
    <nav
      style={{
        backgroundColor: '#0a0a0a',
        borderBottom: '1px solid #1e1e1e',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'stretch',
          gap: '32px',
          height: '52px',
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: '1.1rem',
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            OldTown
          </span>
        </Link>

        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#555',
            fontSize: '0.8rem',
            flexShrink: 0,
          }}
        >
          <Link to="/" style={{ color: '#555', textDecoration: 'none' }}>
            OldTown
          </Link>
          <span style={{ margin: '0 6px' }}>&rsaquo;</span>
          <span style={{ color: '#999' }}>{restaurantName}</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              to={getTabPath(tab.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                fontSize: '0.82rem',
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive(tab.path) ? '#ffffff' : '#666666',
                borderBottom: isActive(tab.path)
                  ? '2px solid #22c55e'
                  : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
