import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Nav from '../components/Nav';
import { useRestaurantData } from '../hooks/useRestaurantData';

// ── Helpers ────────────────────────────────────────────────────────────────

function addDays(d, n) {
  const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10);
}
function sumW(arr, s, e, keys) {
  const a = Object.fromEntries(keys.map(k => [k, 0]));
  (arr || []).forEach(r => { if (r.date >= s && r.date <= e) keys.forEach(k => { a[k] += (r[k] || 0); }); });
  return a;
}
function pct(a, b) { return b ? ((a - b) / b * 100) : null; }
function fmt(n) { return (n ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 }); }
function fmtK(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n); }
function fmtD(n, dec = 0) { return '$' + (n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }

function compute(data, end) {
  if (!data?.summary?.daily?.length) return null;
  const daily = data.summary.daily;
  const cs = addDays(end, -27), pe = addDays(cs, -1), ps = addDays(pe, -27);
  const su  = sumW(data.ga?.daily || daily, cs, end, ['users', 'sessions']);
  const sup = sumW(data.ga?.daily || daily, ps, pe,  ['users', 'sessions']);
  const rc  = sumW(data.reservations?.daily, cs, end, ['seatedCovers', 'covers']);
  const rcp = sumW(data.reservations?.daily, ps, pe,  ['seatedCovers', 'covers']);
  const fb  = sumW(data.facebook?.daily, cs, end, ['spend', 'reach', 'impressions', 'clicks', 'resEvent', 'profileVisits', 'thruPlays', 'resultsCount']);
  const fbp = sumW(data.facebook?.daily, ps, pe, ['spend', 'reach', 'impressions', 'profileVisits']);
  const ga  = sumW(data.googleAds?.daily, cs, end, ['spend', 'reservations', 'calls', 'storeVisits', 'clicks', 'impressions']);
  const gap = sumW(data.googleAds?.daily, ps, pe, ['spend', 'reservations']);

  const gsp = (data.googlePrivate || []).reduce((s, r) => {
    const ms = r.month + '-01', d2 = new Date(r.month + '-01'); d2.setMonth(d2.getMonth() + 1);
    const me = addDays(d2.toISOString().slice(0, 10), -1);
    if (ms <= end && me >= cs) {
      const td = (new Date(me) - new Date(ms)) / 86400000 + 1;
      const od = (Math.min(new Date(end), new Date(me)) - Math.max(new Date(cs), new Date(ms))) / 86400000 + 1;
      s += (r.spend || 0) * Math.min(1, Math.max(0, od / td));
    }
    return s;
  }, 0);
  const gspp = (data.googlePrivate || []).reduce((s, r) => {
    const ms = r.month + '-01', d2 = new Date(r.month + '-01'); d2.setMonth(d2.getMonth() + 1);
    const me = addDays(d2.toISOString().slice(0, 10), -1);
    if (ms <= pe && me >= ps) {
      const td = (new Date(me) - new Date(ms)) / 86400000 + 1;
      const od = (Math.min(new Date(pe), new Date(me)) - Math.max(new Date(ps), new Date(ms))) / 86400000 + 1;
      s += (r.spend || 0) * Math.min(1, Math.max(0, od / td));
    }
    return s;
  }, 0);

  const googleTotal = ga.spend + gsp;
  const googleTotalPrev = gap.spend + gspp;
  const totalSpend = fb.spend + googleTotal;
  const totalSpendPrev = fbp.spend + googleTotalPrev;

  const covers = rc.seatedCovers;
  const coversPrev = rcp.seatedCovers;
  const cpc = covers > 0 ? totalSpend / covers : 0;
  const cpcPrev = coversPrev > 0 ? totalSpendPrev / coversPrev : 0;

  const visits = su.sessions > 0 ? su.sessions : Math.round(su.users * 1.29);
  const conv = su.users > 0 ? (covers / su.users * 100) : 0;

  const fbCtr = fb.impressions > 0 ? (fb.clicks / fb.impressions * 100) : 0;
  const fbCpc = fb.clicks > 0 ? fb.spend / fb.clicks : 0;
  const fbFreq = fb.reach > 0 ? fb.impressions / fb.reach : 0;
  const gCostPerRes = ga.reservations > 0 ? googleTotal / ga.reservations : 0;
  const fbLinkClicks = fb.resultsCount || 0;

  const campWindow = (data.googleAds?.campMonthly || []).filter(r => r.month >= cs.slice(0,7) && r.month <= end.slice(0,7));
  const searchRes = campWindow.filter(r => /search/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);
  const pmaxRes   = campWindow.filter(r => /pmax|performance/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);

  const endMonth = end.slice(0, 7);
  const emailMonth = (data.email?.monthly || []).find(m => m.month === endMonth) || (data.email?.monthly || []).at(-1);

  return {
    cs, end,
    covers, coversPrev,
    users: su.users, usersPrev: sup.users,
    visits,
    totalSpend, totalSpendPrev,
    fb, fbp, ga, googleTotal, googleTotalPrev,
    cpc, cpcPrev, conv,
    fbCtr, fbCpc, fbFreq, fbLinkClicks,
    gCostPerRes, searchRes, pmaxRes,
    emailMonth,
    coversChg:    pct(covers, coversPrev),
    usersChg:     pct(su.users, sup.users),
    spendChg:     pct(totalSpend, totalSpendPrev),
    cpcChg:       cpcPrev > 0 ? pct(cpc, cpcPrev) : null,
    fbReachChg:   pct(fb.reach, fbp.reach),
    gaResChg:     pct(ga.reservations, gap.reservations),
  };
}

// ── Design tokens ──────────────────────────────────────────────────────────

const C = {
  bg:         '#000',
  surface:    '#0a0a0a',
  card:       '#0d0d0d',
  cardBorder: '#1a1a1a',
  line:       '#1f1f1f',
  green:      '#22c55e',
  greenDim:   'rgba(34,197,94,0.12)',
  greenBorder:'rgba(34,197,94,0.2)',
  amber:      '#f59e0b',
  amberDim:   'rgba(245,158,11,0.1)',
  red:        '#f07070',
  redDim:     'rgba(240,112,112,0.1)',
  blue:       '#60a5fa',
  blueDim:    'rgba(96,165,250,0.1)',
  text:       '#fff',
  muted:      '#888',
  dim:        '#444',
};

// ── Micro components ───────────────────────────────────────────────────────

function Trend({ value, inverse = false, suffix = '%', decimals = 1 }) {
  if (value == null) return null;
  const v = parseFloat(value);
  const good = inverse ? v <= 0 : v >= 0;
  const color = good ? C.green : C.red;
  const arrow = v >= 0 ? '↑' : '↓';
  return (
    <span style={{ color, fontSize: 12, fontWeight: 600 }}>
      {arrow} {Math.abs(v).toFixed(decimals)}{suffix}
    </span>
  );
}

function Pill({ label, color = C.green, bg }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 4,
      color, background: bg || `${color}20`,
    }}>{label}</span>
  );
}

function SectionTitle({ children, eyebrow }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {eyebrow && <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.green, marginBottom: 6 }}>{eyebrow}</div>}
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{children}</h2>
    </div>
  );
}

// Horizontal progress bar
function Bar({ value, max, color = C.green, height = 6 }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: '#111', borderRadius: 99, height, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
    </div>
  );
}

// Big KPI tile
function KpiTile({ label, value, sub, trend, trendInverse, accent, wide }) {
  return (
    <div style={{
      background: accent ? C.greenDim : C.card,
      border: `1px solid ${accent ? C.greenBorder : C.cardBorder}`,
      borderRadius: 12,
      padding: wide ? '28px 24px' : '20px 18px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: accent ? C.green : C.muted }}>{label}</div>
      <div style={{ fontSize: wide ? 40 : 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: accent ? C.green : C.text }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {trend != null && <Trend value={trend} inverse={trendInverse} />}
        {sub && <span style={{ fontSize: 11, color: C.dim }}>{sub}</span>}
      </div>
    </div>
  );
}

// Channel card (Meta / Google)
function ChannelCard({ title, eyebrow, spend, health, items, note }) {
  const healthColor = health === 'good' ? C.green : health === 'warn' ? C.amber : C.red;
  const healthLabel = health === 'good' ? 'On Track' : health === 'warn' ? 'Watch' : 'Needs Work';
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>{eyebrow}</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 800 }}>{spend}</span>
            <Pill label={healthLabel} color={healthColor} />
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 20px 18px' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < items.length - 1 ? `1px solid ${C.line}` : 'none' }}>
            <span style={{ fontSize: 12, color: C.muted }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{item.value || '—'}</span>
          </div>
        ))}
        {note && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#111', borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

// Funnel row
function FunnelRow({ label, value, max, color, pctLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: C.muted, width: 140, textAlign: 'right', flexShrink: 0 }}>{label}</div>
      <Bar value={value} max={max} color={color} height={8} />
      <div style={{ fontSize: 14, fontWeight: 700, width: 64, textAlign: 'right', flexShrink: 0 }}>{fmt(value)}</div>
      {pctLabel && <div style={{ fontSize: 11, color: C.dim, width: 48, flexShrink: 0 }}>{pctLabel}</div>}
    </div>
  );
}

// Action item
function ActionItem({ status, title, body }) {
  const cfg = {
    'ACTIVE':       { color: C.green,  bg: C.greenDim },
    'PLANNED':      { color: '#818cf8', bg: 'rgba(99,102,241,0.1)' },
    'NEEDS REVIEW': { color: C.amber,  bg: C.amberDim },
  };
  const s = cfg[status] || { color: C.muted, bg: '#111' };
  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: s.color, background: s.bg, padding: '3px 7px', borderRadius: 4, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 2 }}>{status}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  );
}

// ── Narrative bullets (computed from data) ─────────────────────────────────

function buildNarrative(m) {
  if (!m) return [];
  const lines = [];

  if (m.coversChg != null) {
    const v = parseFloat(m.coversChg);
    lines.push(v >= 0
      ? `Covers are up ${v.toFixed(1)}% vs. the prior 4 weeks — the restaurant is busier.`
      : `Covers are down ${Math.abs(v).toFixed(1)}% vs. the prior 4 weeks.`);
  }

  if (m.cpcChg != null) {
    const v = parseFloat(m.cpcChg);
    lines.push(v < 0
      ? `Spend per cover improved ${Math.abs(v).toFixed(1)}% — getting more efficient for every dollar spent.`
      : `Spend per cover is up ${v.toFixed(1)}% vs. prior period — worth monitoring.`);
  }

  if (m.covers > 0 && m.totalSpend > 0) {
    const metaPct = m.totalSpend > 0 ? (m.fb.spend / m.totalSpend * 100).toFixed(0) : 0;
    const googlePct = m.totalSpend > 0 ? (m.googleTotal / m.totalSpend * 100).toFixed(0) : 0;
    lines.push(`Ad budget is ${metaPct}% Meta / ${googlePct}% Google — ${fmtD(m.totalSpend, 2)} total over 4 weeks.`);
  }

  if (m.ga.reservations > 0 && m.gCostPerRes > 0) {
    lines.push(`Google Ads drove ${fmt(m.ga.reservations)} OpenTable reservations at ${fmtD(m.gCostPerRes, 2)} each.`);
  }

  if (m.conv > 0) {
    lines.push(`${m.conv.toFixed(1)}% of web visitors converted to a cover — industry benchmark is ~5–15%.`);
  }

  return lines.slice(0, 4);
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function Scorecard({ restaurant }) {
  const { slug } = useParams();
  const { data, loading, lastUpdated, refresh } = useRestaurantData(slug);

  const latest = useMemo(() => {
    if (!data?.summary?.daily?.length) return new Date().toISOString().slice(0, 10);
    return data.summary.daily[data.summary.daily.length - 1].date;
  }, [data]);

  const [end, setEnd] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const ed = end || latest;
  const m = useMemo(() => compute(data, ed), [data, ed]);

  const narrative = useMemo(() => buildNarrative(m), [m]);

  const periodLabel = m ? `${m.cs} → ${ed}` : '';
  const monthLabel = useMemo(() => {
    const [y, mo] = ed.split('-');
    return new Date(+y, +mo - 1).toLocaleString('en-CA', { month: 'long', year: 'numeric' });
  }, [ed]);

  function fmtTs(ts) {
    try { return new Date(ts).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch { return ts; }
  }
  const updatedLabel = lastUpdated ? fmtTs(lastUpdated) : restaurant.lastUpdated;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'channels', label: 'Channels' },
    { id: 'actions',  label: 'Actions'  },
  ];

  // Google health: good if cost/res exists and reservation count is meaningful
  const googleHealth = m?.ga.reservations > 5 ? 'good' : m?.ga.reservations > 0 ? 'warn' : 'warn';
  // Meta health: good if reach > 0 and CTR > 0.5%
  const metaHealth = m?.fb.reach > 0 && m?.fbCtr > 0.5 ? 'good' : 'warn';

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Nav restaurantName={restaurant.name} />

      {/* ── Header bar ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.line}`, padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.green, marginBottom: 1 }}>Growth Scorecard</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{restaurant.name} · {monthLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: C.dim }}>4W ending</span>
          <input type="date" value={ed} onChange={e => setEnd(e.target.value)}
            style={{ background: C.card, border: `1px solid #222`, color: C.text, padding: '3px 8px', borderRadius: 5, fontSize: 11, colorScheme: 'dark' }} />
          {m && <span style={{ fontSize: 11, color: C.dim }}>{periodLabel}</span>}
          <span style={{ fontSize: 11, color: C.dim }}>{loading ? 'Refreshing...' : `Updated ${updatedLabel}`}</span>
          <button onClick={refresh} disabled={loading}
            style={{ background: 'none', border: `1px solid #333`, borderRadius: 6, color: loading ? C.dim : '#666', cursor: loading ? 'default' : 'pointer', fontSize: 11, padding: '3px 10px' }}>
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '0 32px 64px' }}>

        {/* ── Tab nav ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.line}`, margin: '0 0 32px' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: '16px 20px', background: 'none', border: 'none', borderBottom: activeTab === t.id ? `2px solid ${C.green}` : '2px solid transparent',
                color: activeTab === t.id ? C.text : C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                marginBottom: -1, transition: 'color 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* North Star hero */}
            <div style={{
              background: `linear-gradient(135deg, ${C.greenDim}, ${C.card})`,
              border: `1px solid ${C.greenBorder}`,
              borderRadius: 16, padding: '36px 32px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.green, marginBottom: 12 }}>The North Star</div>
              <div style={{ fontSize: 'clamp(64px, 12vw, 96px)', fontWeight: 900, letterSpacing: '-3px', lineHeight: 1, color: C.green }}>
                {m ? fmtD(m.cpc, 2) : '—'}
              </div>
              <div style={{ fontSize: 16, color: C.muted, margin: '14px 0 8px' }}>
                Spend per Cover
                {m && <span style={{ color: C.dim }}> · {fmtD(m.totalSpend, 2)} ÷ {fmt(m.covers)} covers</span>}
              </div>
              {m?.cpcPrev > 0 && (
                <div style={{ fontSize: 13, color: C.dim }}>
                  prev 4wk: <span style={{ color: '#777' }}>{fmtD(m.cpcPrev, 2)}</span>
                  {m.cpcChg != null && (
                    <span style={{ marginLeft: 10 }}>
                      <Trend value={m.cpcChg} inverse />
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 4 KPI tiles */}
            <div>
              <SectionTitle eyebrow="Performance">The 4 Numbers That Matter</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiTile
                  label="Covers"
                  value={m ? fmt(m.covers) : '—'}
                  trend={m?.coversChg}
                  sub={m?.coversPrev > 0 ? `prev: ${fmt(m.coversPrev)}` : null}
                />
                <KpiTile
                  label="Total Ad Spend"
                  value={m ? fmtD(m.totalSpend, 0) : '—'}
                  trend={m?.spendChg}
                  trendInverse
                  sub={m?.totalSpendPrev > 0 ? `prev: ${fmtD(m.totalSpendPrev, 0)}` : null}
                />
                <KpiTile
                  label="Web Visitors"
                  value={m ? fmtK(m.users) : '—'}
                  trend={m?.usersChg}
                  sub={m?.usersPrev > 0 ? `prev: ${fmtK(m.usersPrev)}` : null}
                />
                <KpiTile
                  label="Web Conversion"
                  value={m ? `${m.conv.toFixed(1)}%` : '—'}
                  sub={m ? `${fmt(m.covers)} covers ÷ ${fmtK(m.users)} visitors` : null}
                />
              </div>
            </div>

            {/* Conversion funnel */}
            {m && m.users > 0 && (
              <div>
                <SectionTitle eyebrow="The Funnel">Discovery → Intent → Cover</SectionTitle>
                <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '24px 24px 20px' }}>
                  <FunnelRow label="Ad Reach (Meta)" value={m.fb.reach} max={m.fb.reach} color="#a78bfa" pctLabel="top of funnel" />
                  <FunnelRow label="Website Visits"  value={m.visits}  max={m.fb.reach || m.visits} color={C.blue} pctLabel={m.fb.reach > 0 ? `${(m.visits / m.fb.reach * 100).toFixed(1)}%` : null} />
                  <FunnelRow label="Unique Visitors" value={m.users}   max={m.fb.reach || m.visits} color="#60a5fa" pctLabel={m.visits > 0 ? `${(m.users / m.visits * 100).toFixed(0)}%` : null} />
                  <FunnelRow label="Covers Booked"   value={m.covers}  max={m.fb.reach || m.visits} color={C.green} pctLabel={m.users > 0 ? `${m.conv.toFixed(1)}%` : null} />
                  <div style={{ display: 'flex', gap: 28, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
                    <div>
                      <span style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{m.conv.toFixed(1)}%</span>
                      <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>visitor → cover</span>
                    </div>
                    {m.gCostPerRes > 0 && (
                      <div>
                        <span style={{ fontSize: 24, fontWeight: 800 }}>{fmtD(m.gCostPerRes, 2)}</span>
                        <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>Google cost / reservation</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Narrative bullets */}
            {narrative.length > 0 && (
              <div>
                <SectionTitle eyebrow="Read">The Story This Period</SectionTitle>
                <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '8px 20px' }}>
                  {narrative.map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: i < narrative.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                      <span style={{ color: C.green, fontSize: 14, flexShrink: 0, marginTop: 1 }}>→</span>
                      <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wins & Watch */}
            {restaurant.nextActions?.length > 0 && (() => {
              const wins  = restaurant.nextActions.filter(a => a.status === 'ACTIVE');
              const watch = restaurant.nextActions.filter(a => a.status === 'NEEDS REVIEW');
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {wins.length > 0 && (
                    <div style={{ background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 12, padding: '18px 20px' }}>
                      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.green, marginBottom: 12, fontWeight: 700 }}>Active · In Motion</div>
                      {wins.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < wins.length - 1 ? 10 : 0 }}>
                          <span style={{ color: C.green, fontSize: 14, marginTop: 1, flexShrink: 0 }}>✓</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{a.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {watch.length > 0 && (
                    <div style={{ background: C.amberDim, border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 12, padding: '18px 20px' }}>
                      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.amber, marginBottom: 12, fontWeight: 700 }}>Needs Review</div>
                      {watch.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < watch.length - 1 ? 10 : 0 }}>
                          <span style={{ color: C.amber, fontSize: 14, marginTop: 1, flexShrink: 0 }}>⚑</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{a.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            CHANNELS TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'channels' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Spend split visual */}
            {m && m.totalSpend > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '24px 24px 20px' }}>
                <SectionTitle eyebrow="Budget">Total Ad Spend · {fmtD(m.totalSpend, 2)}</SectionTitle>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
                    <div style={{ flex: m.fb.spend, background: '#a78bfa' }} />
                    <div style={{ flex: m.googleTotal, background: C.green }} />
                  </div>
                  <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#a78bfa', display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: C.muted }}>Meta {fmtD(m.fb.spend, 2)} ({m.totalSpend > 0 ? (m.fb.spend / m.totalSpend * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: C.green, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: C.muted }}>Google {fmtD(m.googleTotal, 2)} ({m.totalSpend > 0 ? (m.googleTotal / m.totalSpend * 100).toFixed(0) : 0}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Channel cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ChannelCard
                eyebrow="Paid Social"
                title="Meta Ads"
                spend={m ? fmtD(m.fb.spend, 2) : '—'}
                health={metaHealth}
                items={[
                  { label: 'Reach',       value: m ? fmt(m.fb.reach) : null },
                  { label: 'Impressions', value: m ? fmt(m.fb.impressions) : null },
                  { label: 'Frequency',   value: m?.fbFreq > 0 ? m.fbFreq.toFixed(2) : null },
                  { label: 'Link Clicks', value: m ? fmt(m.fbLinkClicks) : null },
                  { label: 'CTR',         value: m?.fbCtr > 0 ? `${m.fbCtr.toFixed(2)}%` : null },
                  { label: 'CPC (Link)',  value: m?.fbCpc > 0 ? fmtD(m.fbCpc, 2) : null },
                  { label: 'Res. Events (Meta)', value: m?.fb.resEvent > 0 ? fmt(m.fb.resEvent) : null },
                ]}
                note={m?.fbReachChg != null ? `Reach ${parseFloat(m.fbReachChg) >= 0 ? '↑' : '↓'} ${Math.abs(parseFloat(m.fbReachChg)).toFixed(1)}% vs prior 4wk` : null}
              />
              <ChannelCard
                eyebrow="Search & Performance Max"
                title="Google Ads"
                spend={m ? fmtD(m.googleTotal, 2) : '—'}
                health={googleHealth}
                items={[
                  { label: 'OpenTable Reservations', value: m ? fmt(m.ga.reservations) : null },
                  { label: 'Phone Calls',            value: m ? fmt(m.ga.calls) : null },
                  { label: 'Store Visits',           value: m ? fmt(m.ga.storeVisits) : null },
                  { label: 'Cost / Reservation',     value: m?.gCostPerRes > 0 ? fmtD(m.gCostPerRes, 2) : null },
                  { label: 'Search Reservations',    value: m?.searchRes > 0 ? fmt(m.searchRes) : null },
                  { label: 'PMax Reservations',      value: m?.pmaxRes > 0 ? fmt(m.pmaxRes) : null },
                ]}
                note={m?.gaResChg != null ? `Reservations ${parseFloat(m.gaResChg) >= 0 ? '↑' : '↓'} ${Math.abs(parseFloat(m.gaResChg)).toFixed(1)}% vs prior 4wk` : null}
              />
            </div>

            {/* Social discovery */}
            <div>
              <SectionTitle eyebrow="Instagram">Social Discovery</SectionTitle>
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '0 20px' }}>
                {[
                  { label: 'IG Profile Visits',  value: m?.fb.profileVisits > 0 ? fmt(m.fb.profileVisits) : null },
                  { label: 'Video Views (ThruPlay)', value: m?.fb.thruPlays > 0 ? fmtK(m.fb.thruPlays) : null },
                  { label: 'Email Opens',        value: m?.emailMonth?.opened > 0 ? `${fmt(m.emailMonth.opened)} (${m.emailMonth.openRate}% rate)` : null },
                  { label: 'Email Clicks',       value: m?.emailMonth?.clicked > 0 ? `${fmt(m.emailMonth.clicked)} (${m.emailMonth.clickRate}% rate)` : null },
                ].filter(r => r.value).map((row, i, arr) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                    <span style={{ fontSize: 13, color: C.muted }}>{row.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{row.value}</span>
                  </div>
                ))}
                {(!m || (m.fb.profileVisits === 0 && m.fb.thruPlays === 0)) && (
                  <div style={{ padding: '20px 0', fontSize: 13, color: C.dim }}>No social data for this period</div>
                )}
              </div>
            </div>

            {/* Traffic sources */}
            {restaurant.trafficSources && (
              <div>
                <SectionTitle eyebrow="Website">Traffic Sources</SectionTitle>
                <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px 24px' }}>
                  {restaurant.trafficSources.map((src, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: i < restaurant.trafficSources.length - 1 ? 12 : 0 }}>
                      <div style={{ fontSize: 12, color: C.muted, width: 80, flexShrink: 0 }}>{src.label}</div>
                      <Bar value={parseFloat(src.pct)} max={100} color={C.green} height={6} />
                      <div style={{ fontSize: 13, fontWeight: 700, width: 50, textAlign: 'right', flexShrink: 0 }}>{src.pct}</div>
                      <div style={{ fontSize: 12, color: C.dim, width: 50, flexShrink: 0 }}>{fmt(src.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ACTIONS TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {restaurant.nextActions?.length > 0 ? (
              <>
                {/* Summary counts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Active', status: 'ACTIVE',       color: C.green, bg: C.greenDim },
                    { label: 'Planned', status: 'PLANNED',     color: '#818cf8', bg: 'rgba(99,102,241,0.1)' },
                    { label: 'Needs Review', status: 'NEEDS REVIEW', color: C.amber, bg: C.amberDim },
                  ].map(({ label, status, color, bg }) => {
                    const count = restaurant.nextActions.filter(a => a.status === status).length;
                    return (
                      <div key={status} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 12, padding: '18px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, fontWeight: 800, color }}>{count}</div>
                        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color, marginTop: 4 }}>{label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* All actions */}
                <div>
                  <SectionTitle eyebrow="Roadmap">All Actions</SectionTitle>
                  <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '4px 20px 8px' }}>
                    {restaurant.nextActions.map((a, i) => (
                      <ActionItem key={i} status={a.status} title={a.title} body={a.body} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: C.dim }}>No actions configured for {restaurant.name} yet.</div>
              </div>
            )}

            {/* The math that matters — only show if we have spend data */}
            {m && m.covers > 0 && m.totalSpend > 0 && (
              <div>
                <SectionTitle eyebrow="Context">The Math That Matters</SectionTitle>
                <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '0 20px' }}>
                  {[
                    { label: 'Total Ad Spend (4wk)',       value: fmtD(m.totalSpend, 2), highlight: false },
                    { label: 'Covers Driven',              value: fmt(m.covers),          highlight: false },
                    { label: 'Spend Per Cover',            value: fmtD(m.cpc, 2),         highlight: true },
                    ...(m.ga.reservations > 0 ? [{ label: 'Google Cost / Reservation', value: fmtD(m.gCostPerRes, 2), highlight: false }] : []),
                    ...(m.conv > 0 ? [{ label: 'Website Conversion Rate', value: `${m.conv.toFixed(1)}%`, highlight: false }] : []),
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                      <span style={{ fontSize: 13, color: C.muted }}>{row.label}</span>
                      <span style={{ fontSize: row.highlight ? 20 : 15, fontWeight: row.highlight ? 800 : 600, color: row.highlight ? C.green : C.text }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}
