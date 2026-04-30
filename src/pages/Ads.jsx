import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Nav from '../components/Nav';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { generateNextActions } from '../utils/generateNextActions';

// ── Helpers ───────────────────────────────────────────────────────────────

function addDays(d, n) {
  const [y, mo, day] = d.split('-').map(Number);
  const x = new Date(y, mo - 1, day + n);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
}
function sumW(arr, s, e, keys) {
  const a = Object.fromEntries(keys.map(k => [k, 0]));
  (arr || []).forEach(r => { if (r.date >= s && r.date <= e) keys.forEach(k => { a[k] += (r[k] || 0); }); });
  return a;
}
function pct(a, b) { return b ? ((a - b) / b * 100).toFixed(1) : null; }
function fmt(n) { return (n ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 }); }
function fmtK(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n); }
function fmtD(n, dec = 0) { return '$' + (n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }

function compute(data, start, end) {
  if (!data?.summary?.daily?.length) return null;
  const daily = data.summary.daily;
  const cs = start;
  const duration = Math.round((new Date(end) - new Date(start)) / 86400000);
  const pe = addDays(cs, -1), ps = addDays(pe, -duration);
  const su  = sumW(data.ga?.daily || daily, cs, end, ['users', 'sessions']);
  const sup = sumW(data.ga?.daily || daily, ps, pe,  ['users', 'sessions']);
  const rc  = sumW(data.reservations?.daily, cs, end, ['seatedCovers', 'covers']);
  const rcp = sumW(data.reservations?.daily, ps, pe,  ['seatedCovers', 'covers']);
  const fb  = sumW(data.facebook?.daily, cs, end, ['spend', 'reach', 'impressions', 'clicks', 'resEvent', 'resResults', 'profileVisits', 'thruPlays', 'resultsCount', 'otRes']);
  const fbp = sumW(data.facebook?.daily, ps, pe,  ['spend', 'clicks', 'resultsCount', 'profileVisits', 'otRes', 'reach', 'impressions', 'thruPlays']);
  const ga  = sumW(data.googleAds?.daily, cs, end, ['spend', 'reservations', 'calls', 'storeVisits', 'clicks', 'impressions']);
  const gap = sumW(data.googleAds?.daily, ps, pe,  ['spend', 'reservations', 'calls', 'storeVisits', 'clicks', 'impressions']);

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

  const googleTotal = ga.spend + gsp;
  const c  = { ...su,  covers: rc.covers,  seatedCovers: rc.seatedCovers,  spend: fb.spend + googleTotal };
  const p  = { ...sup, covers: rcp.covers, seatedCovers: rcp.seatedCovers };

  // Frequency = impressions / reach
  const freq = fb.reach > 0 ? (fb.impressions / fb.reach).toFixed(2) : null;
  const fbLinkClicks = fb.resultsCount || 0;
  const fbCpc = fbLinkClicks > 0 ? (fb.spend / fbLinkClicks).toFixed(2) : null;
  const fbCtr = fb.impressions > 0 ? (fbLinkClicks / fb.impressions * 100).toFixed(2) : null;
  const gCostPerRes     = ga.reservations  > 0 ? (googleTotal / ga.reservations).toFixed(2) : null;
  const gspp = (data.googlePrivate || []).reduce((s, r) => {
    const ms = r.month + '-01', d2 = new Date(r.month + '-01'); d2.setMonth(d2.getMonth() + 1);
    const me = addDays(d2.toISOString().slice(0, 10), -1);
    if (ms <= pe && me >= ps) { const td = (new Date(me)-new Date(ms))/86400000+1; const od = (Math.min(new Date(pe),new Date(me))-Math.max(new Date(ps),new Date(ms)))/86400000+1; s += (r.spend||0)*Math.min(1,Math.max(0,od/td)); }
    return s;
  }, 0);
  const googleTotalPrev = gap.spend + gspp;
  const prevGCostPerRes = gap.reservations > 0 ? (googleTotalPrev / gap.reservations).toFixed(2) : null;
  const cpc = c.covers > 0 ? c.spend / c.covers : 0;
  const conv = c.users > 0 ? (c.covers / c.users * 100) : 0;
  const visits = c.sessions > 0 ? c.sessions : Math.round(c.users * 1.29);

  const igV  = sumW(data.igViewsData,     cs, end, ['views']);
  const igVp = sumW(data.igViewsData,     ps, pe,  ['views']);
  const fbV  = sumW(data.fbViewsData,     cs, end, ['views']);
  const fbVp = sumW(data.fbViewsData,     ps, pe,  ['views']);
  const fbF  = sumW(data.fbFollowersData, cs, end, ['netFollowers']);
  const fbFp = sumW(data.fbFollowersData, ps, pe,  ['netFollowers']);
  const igF  = sumW(data.igFollowersData, cs, end, ['netFollowers']);
  const igFp = sumW(data.igFollowersData, ps, pe,  ['netFollowers']);

  // Email for latest month in window
  const emailD  = sumW(data.email?.daily, cs, end, ['total','opened','clicked']);
  const emailDp = sumW(data.email?.daily, ps, pe,  ['total','opened','clicked']);
  const emailMonth = { ...emailD, openRate: emailD.total>0 ? +(emailD.opened/emailD.total*100).toFixed(1) : 0, clickRate: emailD.total>0 ? +(emailD.clicked/emailD.total*100).toFixed(1) : 0 };
  const prevEmailMonth = emailDp.total > 0 ? { ...emailDp, openRate: emailDp.total>0 ? +(emailDp.opened/emailDp.total*100).toFixed(1) : 0, clickRate: emailDp.total>0 ? +(emailDp.clicked/emailDp.total*100).toFixed(1) : 0 } : null;

  // Google campaign breakdown: Search vs PMax
  const campWindow     = (data.googleAds?.campDaily || []).filter(r => r.date >= cs && r.date <= end);
  const prevCampWindow = (data.googleAds?.campDaily || []).filter(r => r.date >= ps && r.date <= pe);
  const searchRes     = campWindow.filter(r => /search/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);
  const pmaxRes       = campWindow.filter(r => /pmax/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);
  const prevSearchRes = prevCampWindow.filter(r => /search/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);
  const prevPmaxRes   = prevCampWindow.filter(r => /pmax/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);

  return {
    cs, end, c, p, fb, fbp, ga, gap, gsp, googleTotal, googleTotalPrev,
    cpc, conv, visits, freq, fbCpc, fbCtr, fbLinkClicks,
    gCostPerRes, prevGCostPerRes, emailMonth, prevEmailMonth, searchRes, pmaxRes, prevSearchRes, prevPmaxRes,
    igV, igVp, fbV, fbVp, fbF, fbFp, igF, igFp,
    totalCostPerRes: (ga.reservations + (pmaxRes > 0 ? 0 : 0)) > 0
      ? (googleTotal / ga.reservations).toFixed(2) : null,
  };
}

// ── Mini components ──────────────────────────────────────────────────────

const card = { background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 8 };
const eyebrow = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#666', marginBottom: 6 };
const muted = { fontSize: 12, color: '#666' };

function Stat({ label, value, prev, chg, invertChg }) {
  const chgNum = chg != null ? parseFloat(chg) : null;
  const chgGood = chgNum != null ? (invertChg ? chgNum <= 0 : chgNum >= 0) : null;
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#666', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
        {value || '—'}
        {chgNum != null && (
          <span style={{ fontSize: 10, fontWeight: 600, color: chgGood ? '#22c55e' : '#f07070' }}>
            {chgNum >= 0 ? `↑${chg}%` : `↓${Math.abs(chgNum)}%`}
          </span>
        )}
        {prev && <span style={{ fontSize: 10, color: '#444', fontWeight: 400 }}>prev: {prev}</span>}
      </div>
    </div>
  );
}

function CorrelationItem({ label, value, sub, prev, chg, invertChg }) {
  const chgNum = chg != null ? parseFloat(chg) : null;
  const chgGood = chgNum != null ? (invertChg ? chgNum <= 0 : chgNum >= 0) : null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #1a1a1a' }}>
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
        {value}
        {sub && <span style={{ fontSize: 10, color: '#555', marginLeft: 4 }}>{sub}</span>}
        {chgNum != null && (
          <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 5, color: chgGood ? '#22c55e' : '#f07070' }}>
            {chgNum >= 0 ? `↑${chg}%` : `↓${Math.abs(chgNum)}%`}
          </span>
        )}
        {prev && <span style={{ display: 'block', fontSize: 10, color: '#444', fontWeight: 400 }}>prev: {prev}</span>}
      </span>
    </div>
  );
}

function Badge({ status }) {
  const colors = {
    'ACTIVE': { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
    'PLANNED': { bg: 'rgba(99,102,241,0.1)', color: '#818cf8' },
    'NEEDS REVIEW': { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
  };
  const s = colors[status] || { bg: '#1a1a1a', color: '#666' };
  return (
    <span style={{ ...s, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4 }}>
      {status}
    </span>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────

export default function Ads({ restaurant }) {
  const { slug } = useParams();
  const { data, loading, lastUpdated, refresh } = useRestaurantData(slug);

  const today     = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }, []);
  const yesterday = useMemo(() => addDays(today, -1), [today]);

  const [end, setEnd] = useState('');
  const [start, setStart] = useState('');
  const [preset, setPreset] = useState('28d');
  const ed = end || yesterday;
  const presetDays = { '7d': 6, '14d': 13, '28d': 27, '30d': 29, '90d': 89 };
  const sd = start || (preset === 'MTD' ? `${ed.slice(0,7)}-01` : addDays(ed, -(presetDays[preset] ?? 27)));
  const m = useMemo(() => compute(data, sd, ed), [data, sd, ed]);

  function applyPreset(p) {
    setStart(''); setEnd(''); setPreset(p);
  }

  function applyMonth(ym) {
    if (!ym) return;
    const [y, mo] = ym.split('-').map(Number);
    const s = `${y}-${String(mo).padStart(2,'0')}-01`;
    const lastDay = new Date(y, mo, 0).getDate();
    const eRaw = `${y}-${String(mo).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    const e = eRaw > yesterday ? yesterday : eRaw;
    setStart(s); setEnd(e); setPreset('');
  }

  const monthOptions = useMemo(() => {
    const opts = [];
    const [ty, tm] = today.split('-').map(Number);
    for (let i = 0; i < 12; i++) {
      let mo = tm - i; let y = ty;
      if (mo <= 0) { mo += 12; y -= 1; }
      opts.push(`${y}-${String(mo).padStart(2,'0')}`);
    }
    return opts;
  }, [today]);

  // Traffic sources — live from webSources tab, fallback to static
  const liveTs = (() => {
    if (!data?.webSources || !m) return null;
    const duration = Math.round((new Date(m.end) - new Date(m.cs)) / 86400000);
    const pe = addDays(m.cs, -1), ps = addDays(pe, -duration);
    const totals = {}, prevTotals = {};
    (data.webSources || []).forEach(r => {
      if (r.date >= m.cs && r.date <= m.end) totals[r.channel] = (totals[r.channel] || 0) + r.sessions;
      if (r.date >= ps && r.date <= pe) prevTotals[r.channel] = (prevTotals[r.channel] || 0) + r.sessions;
    });
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return entries.map(([label, value]) => ({
      label, value,
      pct: `${(value / total * 100).toFixed(1)}%`,
      prev: prevTotals[label] || 0,
      chg: prevTotals[label] > 0 ? pct(value, prevTotals[label]) : null,
    }));
  })();
  const ts = liveTs || restaurant.trafficSources;
  const totalVisits = liveTs ? liveTs.reduce((s, r) => s + r.value, 0) : (m?.visits ?? 0);

  // IG profile visits from dedicated tab
  const igVisits = m ? sumW(data.igVisits, m.cs, m.end, ['profileVisits']).profileVisits : 0;
  const nextActions = useMemo(() => generateNextActions(m, data, igVisits), [m, data, igVisits]);


  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <Nav restaurantName={restaurant.name} />

      {/* ── Date bar ── */}
      <div style={{ background: '#000', borderBottom: '1px solid #1f1f1f', padding: '8px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input type="date" value={sd} onChange={e => { setStart(e.target.value); setPreset(''); }}
            style={{ background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '2px 8px', borderRadius: 5, fontSize: 11, colorScheme: 'dark' }} />
          <span style={{ fontSize: 11, color: '#444' }}>—</span>
          <input type="date" value={ed} onChange={e => { setEnd(e.target.value); setPreset(''); }}
            style={{ background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '2px 8px', borderRadius: 5, fontSize: 11, colorScheme: 'dark' }} />
          {['7d','14d','28d','30d','90d','MTD'].map(p => (
            <button key={p} onClick={() => applyPreset(p)} style={{
              background: preset === p ? '#22c55e' : '#111', border: '1px solid #222',
              color: preset === p ? '#000' : '#666', borderRadius: 5, padding: '2px 8px',
              fontSize: 11, cursor: 'pointer', fontWeight: preset === p ? 700 : 400,
            }}>{p}</button>
          ))}
          <select onChange={e => applyMonth(e.target.value)} value={monthOptions.find(mo => sd === `${mo}-01` && !preset) || ''}
            style={{ background: '#111', border: '1px solid #222', color: '#666', borderRadius: 5, padding: '2px 6px', fontSize: 11, cursor: 'pointer' }}>
            <option value=''>Month</option>
            {monthOptions.map(mo => (
              <option key={mo} value={mo}>{new Date(mo + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</option>
            ))}
          </select>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#555' }}>{loading ? 'Refreshing...' : ''}</span>
          <button onClick={refresh} disabled={loading}
            style={{ background: 'none', border: '1px solid #333', borderRadius: 6, color: loading ? '#444' : '#666', cursor: loading ? 'default' : 'pointer', fontSize: 12, padding: '4px 10px' }}>
            {loading ? '...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <main style={{ maxWidth: 1440, margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid #1f1f1f' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>Ad Performance</h1>
          <p style={muted}>Paid social & search campaign breakdown</p>
        </div>

        {/* ── 2-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, padding: '24px 32px', alignItems: 'start' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Website Funnel */}
            <div style={card}>
              <div style={{ padding: '24px 24px 0' }}>
                <div style={eyebrow}>Website Funnel</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>Website visits → unique visitors → covers booked via website</h2>
              </div>
              <div style={{ padding: '0 24px 24px' }}>
                {m && m.c.users > 0 ? (
                  <>
                    {[
                      { label: 'Website Visits',   val: m.visits,   prev: m.p.sessions || Math.round(m.p.users * 1.29), color: '#4f8ef7' },
                      { label: 'Unique Visitors',  val: m.c.users,  prev: m.p.users,   color: '#4f8ef7bb' },
                      { label: 'Covers (Website)', val: m.c.covers, prev: m.p.covers,  color: '#22c55e' },
                    ].map((row, i) => {
                      const chgN = row.prev > 0 ? parseFloat(pct(row.val, row.prev)) : null;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                          <div style={{ fontSize: 12, color: '#666', width: 130, textAlign: 'right', flexShrink: 0 }}>{row.label}</div>
                          <div style={{ flex: 1, background: '#111', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: row.color, width: `${(row.val / m.visits * 100).toFixed(1)}%`, borderRadius: 4 }} />
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, width: 60 }}>{row.val.toLocaleString('en-CA')}</div>
                          {chgN != null && (
                            <div style={{ fontSize: 10, fontWeight: 600, width: 44, color: chgN >= 0 ? '#22c55e' : '#f07070' }}>
                              {chgN >= 0 ? `↑${chgN}%` : `↓${Math.abs(chgN)}%`}
                            </div>
                          )}
                          {row.prev > 0 && <div style={{ fontSize: 10, color: '#444', width: 52 }}>prev: {fmtK(row.prev)}</div>}
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', gap: 32, marginTop: 16, paddingTop: 16, borderTop: '1px solid #1f1f1f' }}>
                      <div>
                        <span style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{m.conv.toFixed(1)}%</span>
                        <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>website conversion</span>
                        {m.p.users > 0 && <span style={{ fontSize: 10, color: '#444', marginLeft: 6 }}>prev: {(m.p.covers / m.p.users * 100).toFixed(1)}%</span>}
                      </div>
                      <div>
                        <span style={{ fontSize: 22, fontWeight: 700 }}>${m.cpc.toFixed(2)}</span>
                        <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>spend / cover</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#444', fontSize: 13 }}>No data for this period</div>
                )}
              </div>
            </div>

            {/* Channel Split */}
            <div style={card}>
              <div style={{ padding: '24px 24px 0' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Channel Split</h2>
                <p style={{ ...muted, marginBottom: 20 }}>
                  Total ad spend: {m ? fmtD(m.c.spend, 2) : '—'}
                </p>
              </div>
              <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Meta */}
                <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: 20 }}>
                  <div style={eyebrow}>Meta Ads · Instagram & Facebook</div>
                  <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 2px' }}>{m ? fmtD(m.fb.spend, 2) : '—'}</div>
                  {m && (
                    <div style={{ fontSize: 10, color: '#444', marginBottom: 12 }}>
                      prev: {m.fbp?.spend > 0 ? fmtD(m.fbp.spend, 2) : '—'}
                      {m.fbp?.spend > 0 && <span style={{ color: parseFloat(pct(m.fb.spend, m.fbp.spend)) <= 0 ? '#22c55e' : '#f07070', fontWeight: 600, marginLeft: 4 }}>
                        {parseFloat(pct(m.fb.spend, m.fbp.spend)) >= 0 ? `↑${pct(m.fb.spend, m.fbp.spend)}%` : `↓${Math.abs(parseFloat(pct(m.fb.spend, m.fbp.spend)))}%`}
                      </span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Stat label="Reach"        value={m ? fmt(m.fb.reach) : null}        prev={m?.fbp?.reach > 0 ? fmt(m.fbp.reach) : null}               chg={m?.fbp?.reach > 0 ? pct(m.fb.reach, m.fbp.reach) : null} />
                    <Stat label="Impressions"  value={m ? fmt(m.fb.impressions) : null}  prev={m?.fbp?.impressions > 0 ? fmt(m.fbp.impressions) : null}   chg={m?.fbp?.impressions > 0 ? pct(m.fb.impressions, m.fbp.impressions) : null} />
                    <Stat label="Frequency"    value={m?.freq} />
                    <Stat label="Clicks (All)" value={m ? fmt(m.fb.clicks) : null}       prev={m?.fbp?.clicks > 0 ? fmt(m.fbp.clicks) : null}             chg={m?.fbp?.clicks > 0 ? pct(m.fb.clicks, m.fbp.clicks) : null} />
                    <Stat label="Link Clicks"  value={m ? fmt(m.fbLinkClicks) : null}    prev={m?.fbp?.resultsCount > 0 ? fmt(m.fbp.resultsCount) : null} chg={m?.fbp?.resultsCount > 0 ? pct(m.fbLinkClicks, m.fbp.resultsCount) : null} />
                    <Stat label="CTR"          value={m?.fbCtr ? `${m.fbCtr}%` : null} />
                    <Stat label="CPC (Link)"   value={m?.fbCpc ? `$${m.fbCpc}` : null}  invertChg />
                  </div>
                </div>
                {/* Google */}
                <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: 20 }}>
                  <div style={eyebrow}>Google Ads · Search & PMax</div>
                  <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 2px' }}>{m ? fmtD(m.googleTotal, 2) : '—'}</div>
                  {m && (
                    <div style={{ fontSize: 10, color: '#444', marginBottom: 12 }}>
                      prev: {m.googleTotalPrev > 0 ? fmtD(m.googleTotalPrev, 2) : '—'}
                      {m.googleTotalPrev > 0 && <span style={{ color: parseFloat(pct(m.googleTotal, m.googleTotalPrev)) <= 0 ? '#22c55e' : '#f07070', fontWeight: 600, marginLeft: 4 }}>
                        {parseFloat(pct(m.googleTotal, m.googleTotalPrev)) >= 0 ? `↑${pct(m.googleTotal, m.googleTotalPrev)}%` : `↓${Math.abs(parseFloat(pct(m.googleTotal, m.googleTotalPrev)))}%`}
                      </span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Stat label="OpenTable Reservations" value={m ? fmt(m.ga.reservations) : null} prev={m?.gap?.reservations > 0 ? fmt(m.gap.reservations) : null} chg={m?.gap?.reservations > 0 ? pct(m.ga.reservations, m.gap.reservations) : null} />
                    <Stat label="Phone Calls"            value={m ? fmt(m.ga.calls) : null}        prev={m?.gap?.calls > 0 ? fmt(m.gap.calls) : null}               chg={m?.gap?.calls > 0 ? pct(m.ga.calls, m.gap.calls) : null} />
                    <Stat label="Store Visits"           value={m ? fmt(m.ga.storeVisits) : null}  prev={m?.gap?.storeVisits > 0 ? fmt(m.gap.storeVisits) : null}   chg={m?.gap?.storeVisits > 0 ? pct(m.ga.storeVisits, m.gap.storeVisits) : null} />
                    <Stat label="Cost / Reservation"     value={m?.gCostPerRes ? `$${m.gCostPerRes}` : null} prev={m?.prevGCostPerRes ? `$${m.prevGCostPerRes}` : null} chg={m?.prevGCostPerRes ? pct(parseFloat(m.gCostPerRes), parseFloat(m.prevGCostPerRes)) : null} invertChg />
                  </div>
                </div>
              </div>
            </div>

            {/* Traffic Sources */}
            <div style={card}>
              <div style={{ padding: '24px 24px 0' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Website Traffic Sources</h2>
                <p style={{ ...muted, marginBottom: 20 }}>{totalVisits > 0 ? `${totalVisits.toLocaleString('en-CA')} total website visits` : 'Traffic breakdown'}</p>
              </div>
              <div style={{ padding: '0 24px 24px' }}>
                {ts ? (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ts.length}, 1fr)`, gap: 16 }}>
                    {ts.map((src, i) => {
                      const chgNum = src.chg != null ? parseFloat(src.chg) : null;
                      return (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{src.value.toLocaleString('en-CA')}</div>
                          {chgNum != null && (
                            <div style={{ fontSize: 10, fontWeight: 600, color: chgNum >= 0 ? '#22c55e' : '#f07070', marginBottom: 1 }}>
                              {chgNum >= 0 ? `↑${src.chg}%` : `↓${Math.abs(chgNum)}%`}
                            </div>
                          )}
                          {src.prev > 0 && <div style={{ fontSize: 10, color: '#444', marginBottom: 2 }}>prev: {src.prev.toLocaleString('en-CA')}</div>}
                          <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{src.label}</div>
                          <div style={{ fontSize: 12, color: '#555' }}>{src.pct}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: '#444', fontSize: 13 }}>Traffic source data requires a GA sheet tab</div>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Correlation Grid */}
            <div style={card}>
              <div style={{ padding: '24px 24px 0' }}>
                <div style={eyebrow}>The Correlation Grid</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                  {['Discovery', 'Intent', 'Action'].map((t, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {i > 0 && <span style={{ color: '#22c55e', fontSize: 14 }}>·</span>}
                      <span style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? '#fff' : i === 1 ? '#aaa' : '#666' }}>{t}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Social Discovery */}
                <div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Meta / Instagram & Facebook</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>Social Discovery</div>
                  <CorrelationItem label="IG Views"           value={m?.igV?.views > 0 ? fmtK(m.igV.views) : '—'}               prev={m?.igVp?.views > 0 ? fmtK(m.igVp.views) : null}           chg={m?.igV?.views > 0 && m?.igVp?.views > 0 ? pct(m.igV.views, m.igVp.views) : null} />
                  <CorrelationItem label="FB Views"           value={m?.fbV?.views > 0 ? fmtK(m.fbV.views) : '—'}               prev={m?.fbVp?.views > 0 ? fmtK(m.fbVp.views) : null}           chg={m?.fbV?.views > 0 && m?.fbVp?.views > 0 ? pct(m.fbV.views, m.fbVp.views) : null} />
                  <CorrelationItem label="FB Followers (Net)" value={m?.fbF?.netFollowers != null ? fmt(m.fbF.netFollowers) : '—'} prev={m?.fbFp?.netFollowers != null ? fmt(m.fbFp.netFollowers) : null} chg={m?.fbFp?.netFollowers > 0 ? pct(m.fbF.netFollowers, m.fbFp.netFollowers) : null} />
                  <CorrelationItem label="IG Followers (Net)" value={m?.igF?.netFollowers != null ? fmt(m.igF.netFollowers) : '—'} prev={m?.igFp?.netFollowers != null ? fmt(m.igFp.netFollowers) : null} chg={m?.igFp?.netFollowers > 0 ? pct(m.igF.netFollowers, m.igFp.netFollowers) : null} />
                  <CorrelationItem label="IG Profile Visits"  value={igVisits > 0 ? fmt(igVisits) : '—'} />
                  <CorrelationItem label="Link Clicks"        value={m ? fmt(m.fbLinkClicks) : '—'}                              prev={m?.fbp?.resultsCount > 0 ? fmt(m.fbp.resultsCount) : null} chg={m?.fbp?.resultsCount > 0 ? pct(m.fbLinkClicks, m.fbp.resultsCount) : null} />
                  <CorrelationItem label="Reservations (Meta)" value={m?.fb.otRes > 0 ? fmt(m.fb.otRes) : '—'}                   prev={m?.fbp?.otRes > 0 ? fmt(m.fbp.otRes) : null}              chg={m?.fbp?.otRes > 0 ? pct(m.fb.otRes, m.fbp.otRes) : null} />
                </div>

                {/* Search & Email Intent */}
                <div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Google Ads & Email</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>Search & Email Intent</div>
                  <CorrelationItem label="Search Reservations" value={m?.searchRes > 0 ? fmt(m.searchRes) : '—'}   prev={m?.prevSearchRes > 0 ? fmt(m.prevSearchRes) : null} chg={m?.prevSearchRes > 0 ? pct(m.searchRes, m.prevSearchRes) : null} />
                  <CorrelationItem label="PMax Reservations"   value={m?.pmaxRes > 0 ? fmt(m.pmaxRes) : '—'}     prev={m?.prevPmaxRes > 0 ? fmt(m.prevPmaxRes) : null}   chg={m?.prevPmaxRes > 0 ? pct(m.pmaxRes, m.prevPmaxRes) : null} />
                  <CorrelationItem label="Phone Calls"         value={m ? fmt(m.ga.calls) : '—'}                 prev={m?.gap?.calls > 0 ? fmt(m.gap.calls) : null}      chg={m?.gap?.calls > 0 ? pct(m.ga.calls, m.gap.calls) : null} />
                  <CorrelationItem
                    label="Email Opens"
                    value={m?.emailMonth ? fmt(m.emailMonth.opened) : '—'}
                    sub={m?.emailMonth?.total > 0 ? `${m.emailMonth.openRate}% of ${fmt(m.emailMonth.total)} sent` : null}
                    prev={m?.prevEmailMonth ? `${fmt(m.prevEmailMonth.opened)} (${m.prevEmailMonth.openRate}%)` : null}
                    chg={m?.prevEmailMonth?.opened > 0 ? pct(m.emailMonth?.opened, m.prevEmailMonth.opened) : null}
                  />
                  <CorrelationItem
                    label="Email Clicks"
                    value={m?.emailMonth ? fmt(m.emailMonth.clicked) : '—'}
                    sub={m?.emailMonth?.total > 0 ? `${m.emailMonth.clickRate}% of ${fmt(m.emailMonth.total)} sent` : null}
                    prev={m?.prevEmailMonth ? `${fmt(m.prevEmailMonth.clicked)} (${m.prevEmailMonth.clickRate}%)` : null}
                    chg={m?.prevEmailMonth?.clicked > 0 ? pct(m.emailMonth?.clicked, m.prevEmailMonth.clicked) : null}
                  />
                </div>

                {/* Conversions */}
                <div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Bookings & Visits</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>Conversions</div>
                  <CorrelationItem label="Store Visits"           value={m ? fmt(m.ga.storeVisits) : '—'}              prev={m?.gap?.storeVisits > 0 ? fmt(m.gap.storeVisits) : null}    chg={m?.gap?.storeVisits > 0 ? pct(m.ga.storeVisits, m.gap.storeVisits) : null} />
                  <CorrelationItem label="OpenTable Reservations" value={m ? fmt(m.ga.reservations) : '—'}            prev={m?.gap?.reservations > 0 ? fmt(m.gap.reservations) : null} chg={m?.gap?.reservations > 0 ? pct(m.ga.reservations, m.gap.reservations) : null} />
                  <CorrelationItem label="Cost per Reservation"   value={m?.gCostPerRes ? `$${m.gCostPerRes}` : '—'} prev={m?.prevGCostPerRes ? `$${m.prevGCostPerRes}` : null}        chg={m?.prevGCostPerRes ? pct(parseFloat(m.gCostPerRes), parseFloat(m.prevGCostPerRes)) : null} invertChg />
                </div>
              </div>
            </div>

            {/* Next Actions */}
            {nextActions.length > 0 && (
              <div style={card}>
                <div style={{ padding: '20px 20px 0', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Next Actions</div>
                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {nextActions.map((action, i) => (
                    <div key={i} style={{ background: '#111', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ marginBottom: 6 }}><Badge status={action.status} /></div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{action.title}</div>
                      <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>{action.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
