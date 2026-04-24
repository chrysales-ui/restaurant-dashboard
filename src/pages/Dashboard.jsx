import { useState, useMemo, useEffect, useRef } from 'react';
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
function fmtD(n) { return '$' + fmt(n); }
function fmtTs(ts) {
  try { return new Date(ts).toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
  catch { return ts; }
}

function compute(data, start, end) {
  if (!data?.summary?.daily?.length) return null;
  const cs = start;
  const duration = Math.round((new Date(end) - new Date(start)) / 86400000);
  const pe = addDays(cs, -1), ps = addDays(pe, -duration);
  const su  = sumW(data.ga?.daily || data.summary.daily, cs, end, ['users', 'sessions']);
  const sup = sumW(data.ga?.daily || data.summary.daily, ps, pe,  ['users', 'sessions']);
  // Covers from Reservations tab (Column I = party size, seatedCovers = Done/Confirmed/Seated)
  const rc  = sumW(data.reservations?.daily, cs, end, ['seatedCovers', 'covers']);
  const rcp = sumW(data.reservations?.daily, ps, pe,  ['seatedCovers', 'covers']);
  const fb = sumW(data.facebook?.daily, cs, end, ['spend', 'profileVisits', 'clicks', 'resEvent', 'reach', 'impressions', 'resultsCount', 'thruPlays', 'otRes']);
  const fbp = sumW(data.facebook?.daily, ps, pe, ['spend', 'profileVisits', 'clicks', 'resEvent', 'resultsCount', 'otRes', 'reach', 'impressions']);
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
  const c  = { ...su,  covers: rc.covers,  seatedCovers: rc.seatedCovers,  spend: fb.spend + googleTotal };
  const p  = { ...sup, covers: rcp.covers, seatedCovers: rcp.seatedCovers, spend: fbp.spend + googleTotalPrev };
  const cpc = c.covers > 0 ? c.spend / c.covers : 0;
  const pcpc = p.covers > 0 ? p.spend / p.covers : 0;

  // Lifetime average spend/cover — from Reservations tab col[15] (avgLifetimeSpend)
  const lifetimeCpc = data.reservations?.summary?.avgLifetimeSpend ?? 0;
  const conv = c.users > 0 ? (c.covers / c.users * 100) : 0;
  const visits = c.sessions > 0 ? c.sessions : Math.round(c.users * 1.29);
  const freq = fb.reach > 0 ? (fb.impressions / fb.reach).toFixed(2) : null;
  const fbLinkClicks = fb.resultsCount || 0;
  const fbCpc = fbLinkClicks > 0 ? (fb.spend / fbLinkClicks).toFixed(2) : null;
  const fbCpm = fb.impressions > 0 ? (fb.spend / fb.impressions * 1000).toFixed(2) : null;
  const fbCtr = fb.impressions > 0 ? (fbLinkClicks / fb.impressions * 100).toFixed(2) : null;
  const gCpc = ga.clicks > 0 ? (ga.spend / ga.clicks).toFixed(2) : null;
  const gCostPerRes     = ga.reservations  > 0 ? (googleTotal     / ga.reservations).toFixed(2)  : null;
  const prevGCostPerRes = gap.reservations > 0 ? (googleTotalPrev / gap.reservations).toFixed(2) : null;
  const igV  = sumW(data.igViewsData,     cs, end, ['views']);
  const igVp = sumW(data.igViewsData,     ps, pe,  ['views']);
  const fbV  = sumW(data.fbViewsData,     cs, end, ['views']);
  const fbVp = sumW(data.fbViewsData,     ps, pe,  ['views']);
  const fbF  = sumW(data.fbFollowersData, cs, end, ['netFollowers']);
  const fbFp = sumW(data.fbFollowersData, ps, pe,  ['netFollowers']);
  const igF  = sumW(data.igFollowersData, cs, end, ['netFollowers']);
  const igFp = sumW(data.igFollowersData, ps, pe,  ['netFollowers']);
  const emailD  = sumW(data.email?.daily, cs, end, ['total','opened','clicked']);
  const emailDp = sumW(data.email?.daily, ps, pe,  ['total','opened','clicked']);
  const emailMonth = { ...emailD, openRate: emailD.total>0 ? +(emailD.opened/emailD.total*100).toFixed(1) : 0, clickRate: emailD.total>0 ? +(emailD.clicked/emailD.total*100).toFixed(1) : 0 };
  const prevEmailMonth = emailDp.total > 0 ? { ...emailDp, openRate: emailDp.total>0 ? +(emailDp.opened/emailDp.total*100).toFixed(1) : 0, clickRate: emailDp.total>0 ? +(emailDp.clicked/emailDp.total*100).toFixed(1) : 0 } : null;
  const campWindow     = (data.googleAds?.campMonthly || []).filter(r => r.month >= cs.slice(0,7) && r.month <= end.slice(0,7));
  const prevCampWindow = (data.googleAds?.campMonthly || []).filter(r => r.month >= ps.slice(0,7) && r.month <= pe.slice(0,7));
  const searchRes     = campWindow.filter(r => /search/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);
  const pmaxRes       = campWindow.filter(r => /pmax|performance/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);
  const prevSearchRes = prevCampWindow.filter(r => /search/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);
  const prevPmaxRes   = prevCampWindow.filter(r => /pmax|performance/i.test(r.name)).reduce((s, r) => s + (r.reservations || 0), 0);
  return {
    cs, end, c, p, fb, fbp, ga, gsp, googleTotal, googleTotalPrev,
    cpc, pcpc, lifetimeCpc, conv, visits, freq, fbCpc, fbCpm, fbCtr, fbLinkClicks, gCpc, gCostPerRes, prevGCostPerRes,
    emailMonth, prevEmailMonth, searchRes, pmaxRes, prevSearchRes, prevPmaxRes, gap,
    igV, igVp, fbV, fbVp, fbF, fbFp, igF, igFp,
    coversChg: pct(c.covers, p.covers),
    usersChg:  pct(c.users,  p.users),
    spendChg:  pct(c.spend,  p.spend),
    cpcChg:    pcpc > 0 ? pct(cpc, pcpc) : null,
    igChg:     pct(fb.profileVisits, fbp.profileVisits),
  };
}

// ── Layout helpers ────────────────────────────────────────────────────────

// Full-width section wrapper — background spans edge to edge, content is max-width
function Section({ bg, borderBottom = true, children }) {
  return (
    <div style={{ background: bg || 'transparent', borderBottom: borderBottom ? '1px solid #1f1f1f' : 'none' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        {children}
      </div>
    </div>
  );
}


function SummaryCard({ label, value, sub }) {
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 8, padding: 20 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: '#666', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#555' }}>{sub}</div>
    </div>
  );
}

// ── Shared sub-components (also used by Ads.jsx) ─────────────────────────

const _card = { background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 8 };
const _eyebrow = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#666', marginBottom: 6 };
const _muted = { fontSize: 12, color: '#666' };

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
    'ACTIVE':       { bg: 'rgba(34,197,94,0.1)',  color: '#22c55e' },
    'PLANNED':      { bg: 'rgba(99,102,241,0.1)', color: '#818cf8' },
    'NEEDS REVIEW': { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
  };
  const s = colors[status] || { bg: '#1a1a1a', color: '#666' };
  return (
    <span style={{ ...s, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4 }}>
      {status}
    </span>
  );
}

function OptAccordion({ m, restaurant, data, nextActions, displayIg, displayIgPrev }) {
  const [open, setOpen] = useState(false);
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
  const totalVisits = m?.visits ?? 0;

  return (
    <div style={{ borderBottom: '1px solid #1f1f1f' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ width: '100%', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          Optimization Data
          <span style={{ fontSize: 16, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        </button>

        {open && (
          <div style={{ paddingBottom: 32, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

            {/* Left: Funnel + Channel Split + Traffic */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Website Funnel */}
              <div style={_card}>
                <div style={{ padding: '20px 20px 0' }}>
                  <div style={_eyebrow}>Website Funnel</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Website visits → unique visitors → covers booked via website</h3>
                </div>
                <div style={{ padding: '0 20px 20px' }}>
                  {m && m.c.users > 0 ? (
                    <>
                      {[
                        { label: 'Website Visits',   val: m.visits,   prev: m.p.sessions || Math.round(m.p.users * 1.29), color: '#4f8ef7' },
                        { label: 'Unique Visitors',  val: m.c.users,  prev: m.p.users,   color: '#4f8ef7bb' },
                        { label: 'Covers (Website)', val: m.c.covers, prev: m.p.covers,  color: '#22c55e' },
                      ].map((row, i) => {
                        const chgN = row.prev > 0 ? parseFloat(pct(row.val, row.prev)) : null;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ fontSize: 12, color: '#666', width: 120, textAlign: 'right', flexShrink: 0 }}>{row.label}</div>
                            <div style={{ flex: 1, background: '#111', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: row.color, width: `${(row.val / m.visits * 100).toFixed(1)}%`, borderRadius: 4 }} />
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, width: 56 }}>{row.val.toLocaleString('en-CA')}</div>
                            {chgN != null && (
                              <div style={{ fontSize: 10, fontWeight: 600, width: 44, color: chgN >= 0 ? '#22c55e' : '#f07070' }}>
                                {chgN >= 0 ? `↑${chgN}%` : `↓${Math.abs(chgN)}%`}
                              </div>
                            )}
                            {row.prev > 0 && <div style={{ fontSize: 10, color: '#444', width: 48 }}>prev: {fmtK(row.prev)}</div>}
                          </div>
                        );
                      })}
                      <div style={{ display: 'flex', gap: 28, marginTop: 14, paddingTop: 14, borderTop: '1px solid #1f1f1f' }}>
                        <div>
                          <span style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{m.conv.toFixed(1)}%</span>
                          <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>website conversion</span>
                          {m.p.users > 0 && <span style={{ fontSize: 10, color: '#444', marginLeft: 6 }}>prev: {(m.p.covers / m.p.users * 100).toFixed(1)}%</span>}
                        </div>
                        <div>
                          <span style={{ fontSize: 20, fontWeight: 700 }}>${m.cpc.toFixed(2)}</span>
                          <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>spend / cover</span>
                          {m.pcpc > 0 && <span style={{ fontSize: 10, color: '#444', marginLeft: 6 }}>prev: ${m.pcpc.toFixed(2)}</span>}
                        </div>
                      </div>
                    </>
                  ) : <div style={{ color: '#444', fontSize: 13 }}>No data for this period</div>}
                </div>
              </div>

              {/* Channel Split */}
              <div style={_card}>
                <div style={{ padding: '20px 20px 0' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Channel Split</h3>
                  <p style={{ ..._muted, marginBottom: 16 }}>Total ad spend: {m ? fmtD(m.c.spend) : '—'}</p>
                </div>
                <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: 16 }}>
                    <div style={_eyebrow}>Meta Ads · Instagram & Facebook</div>
                    <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 2px' }}>{m ? fmtD(m.fb.spend) : '—'}</div>
                    {m && (
                      <div style={{ fontSize: 10, color: '#444', marginBottom: 10 }}>
                        prev: {m.fbp?.spend > 0 ? fmtD(m.fbp.spend) : '—'}
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
                  <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: 16 }}>
                    <div style={_eyebrow}>Google Ads · Search & PMax</div>
                    <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 2px' }}>{m ? fmtD(m.googleTotal) : '—'}</div>
                    {m && (
                      <div style={{ fontSize: 10, color: '#444', marginBottom: 10 }}>
                        prev: {m.googleTotalPrev > 0 ? fmtD(m.googleTotalPrev) : '—'}
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
              {ts && (
                <div style={_card}>
                  <div style={{ padding: '20px 20px 0' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Website Traffic Sources</h3>
                    <p style={{ ..._muted, marginBottom: 16 }}>{totalVisits > 0 ? `${totalVisits.toLocaleString('en-CA')} total website visits` : 'Traffic breakdown'}</p>
                  </div>
                  <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: `repeat(${ts.length}, 1fr)`, gap: 12 }}>
                    {ts.map((src, i) => {
                      const chgNum = src.chg != null ? parseFloat(src.chg) : null;
                      return (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{src.value.toLocaleString('en-CA')}</div>
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
                </div>
              )}
            </div>

            {/* Right: Correlation Grid + Next Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={_card}>
                <div style={{ padding: '20px 20px 0' }}>
                  <div style={_eyebrow}>The Correlation Grid</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                    {['Discovery', '·', 'Intent', '·', 'Action'].map((t, i) => (
                      <span key={i} style={{ fontSize: 13, fontWeight: 600, color: t === '·' ? '#22c55e' : i === 0 ? '#fff' : i === 2 ? '#aaa' : '#666' }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#555', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Meta / Instagram & Facebook</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>Social Discovery</div>
                    <CorrelationItem label="IG Views"           value={m?.igV?.views > 0 ? fmtK(m.igV.views) : '—'}               prev={m?.igVp?.views > 0 ? fmtK(m.igVp.views) : null}           chg={m?.igV?.views > 0 && m?.igVp?.views > 0 ? pct(m.igV.views, m.igVp.views) : null} />
                    <CorrelationItem label="FB Views"           value={m?.fbV?.views > 0 ? fmtK(m.fbV.views) : '—'}               prev={m?.fbVp?.views > 0 ? fmtK(m.fbVp.views) : null}           chg={m?.fbV?.views > 0 && m?.fbVp?.views > 0 ? pct(m.fbV.views, m.fbVp.views) : null} />
                    <CorrelationItem label="FB Followers (Net)" value={m?.fbF?.netFollowers != null ? fmt(m.fbF.netFollowers) : '—'} prev={m?.fbFp?.netFollowers != null ? fmt(m.fbFp.netFollowers) : null} chg={m?.fbFp?.netFollowers > 0 ? pct(m.fbF.netFollowers, m.fbFp.netFollowers) : null} />
                    <CorrelationItem label="IG Followers (Net)" value={m?.igF?.netFollowers != null ? fmt(m.igF.netFollowers) : '—'} prev={m?.igFp?.netFollowers != null ? fmt(m.igFp.netFollowers) : null} chg={m?.igFp?.netFollowers > 0 ? pct(m.igF.netFollowers, m.igFp.netFollowers) : null} />
                    <CorrelationItem label="IG Profile Visits"  value={displayIg > 0 ? fmt(displayIg) : '—'}                       prev={displayIgPrev > 0 ? fmt(displayIgPrev) : null}             chg={displayIg > 0 && displayIgPrev > 0 ? pct(displayIg, displayIgPrev) : null} />
                    <CorrelationItem label="Link Clicks"        value={m ? fmt(m.fbLinkClicks) : '—'}                              prev={m?.fbp?.resultsCount > 0 ? fmt(m.fbp.resultsCount) : null} chg={m?.fbp?.resultsCount > 0 ? pct(m.fbLinkClicks, m.fbp.resultsCount) : null} />
                    <CorrelationItem label="Reservations (Meta)" value={m?.fb.otRes > 0 ? fmt(m.fb.otRes) : '—'}                   prev={m?.fbp?.otRes > 0 ? fmt(m.fbp.otRes) : null}              chg={m?.fbp?.otRes > 0 ? pct(m.fb.otRes, m.fbp.otRes) : null} />
                  </div>
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
                  <div>
                    <div style={{ fontSize: 10, color: '#555', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>Bookings & Visits</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>Conversions</div>
                    <CorrelationItem label="Store Visits"           value={m ? fmt(m.ga.storeVisits) : '—'}              prev={m?.gap?.storeVisits > 0 ? fmt(m.gap.storeVisits) : null}    chg={m?.gap?.storeVisits > 0 ? pct(m.ga.storeVisits, m.gap.storeVisits) : null} />
                    <CorrelationItem label="OpenTable Reservations" value={m ? fmt(m.ga.reservations) : '—'}            prev={m?.gap?.reservations > 0 ? fmt(m.gap.reservations) : null} chg={m?.gap?.reservations > 0 ? pct(m.ga.reservations, m.gap.reservations) : null} />
                    <CorrelationItem label="Cost per Reservation"   value={m?.gCostPerRes ? `$${m.gCostPerRes}` : '—'} prev={m?.prevGCostPerRes ? `$${m.prevGCostPerRes}` : null}        chg={m?.prevGCostPerRes ? pct(parseFloat(m.gCostPerRes), parseFloat(m.prevGCostPerRes)) : null} invertChg />
                  </div>
                </div>
              </div>

              {nextActions.length > 0 && (
                <div style={_card}>
                  <div style={{ padding: '16px 16px 0', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Next Actions</div>
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {nextActions.map((action, i) => (
                      <div key={i} style={{ background: '#111', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ marginBottom: 5 }}><Badge status={action.status} /></div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{action.title}</div>
                        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>{action.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manual override inline editor ─────────────────────────────────────────

function ManualEdit({ label, value, onSave, onClear }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  function open() { setDraft(value != null ? String(value) : ''); setEditing(true); }
  function save() { const n = parseInt(draft.replace(/,/g, ''), 10); if (!isNaN(n)) onSave(n); setEditing(false); }

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (editing) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ width: 90, background: '#111', border: '1px solid #444', color: '#fff', borderRadius: 4, padding: '2px 6px', fontSize: 12 }} />
      <button onClick={save} style={{ background: '#22c55e', border: 'none', color: '#000', borderRadius: 4, padding: '2px 7px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✓</button>
      <button onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid #333', color: '#666', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer' }}>✕</button>
    </span>
  );

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {label && <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}:</span>}
      <button onClick={open} title="Manually override" style={{ background: 'none', border: 'none', color: value != null ? '#22c55e' : '#444', cursor: 'pointer', fontSize: 11, padding: 0 }}>
        {value != null ? `${fmtK(value)} ✎` : '✎ edit'}
      </button>
      {value != null && <button onClick={onClear} title="Clear override" style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>}
    </span>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard({ restaurant }) {
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
    const [y, m] = ym.split('-').map(Number);
    const s = `${y}-${String(m).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const eRaw = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    const e = eRaw > yesterday ? yesterday : eRaw;
    setStart(s); setEnd(e); setPreset('');
  }

  const monthOptions = useMemo(() => {
    const opts = [];
    const [ty, tm] = today.split('-').map(Number);
    for (let i = 0; i < 12; i++) {
      let m = tm - i; let y = ty;
      if (m <= 0) { m += 12; y -= 1; }
      opts.push(`${y}-${String(m).padStart(2,'0')}`);
    }
    return opts;
  }, [today]);

  // Manual override for web visitors — persisted per slug+endDate
  const overrideKey = `visitors_override_${slug}_${ed}`;
  const [visitorsOverride, setVisitorsOverride] = useState(() => {
    const v = localStorage.getItem(`visitors_override_${slug}_${ed}`);
    return v != null ? parseInt(v, 10) : null;
  });
  useEffect(() => {
    const v = localStorage.getItem(overrideKey);
    setVisitorsOverride(v != null ? parseInt(v, 10) : null);
  }, [overrideKey]);
  function saveVisitors(n) { localStorage.setItem(overrideKey, n); setVisitorsOverride(n); }
  function clearVisitors() { localStorage.removeItem(overrideKey); setVisitorsOverride(null); }

  // Previous period visitors override
  const prevOverrideKey = `visitors_override_${slug}_prev_${ed}`;
  const [prevVisitorsOverride, setPrevVisitorsOverride] = useState(() => {
    const v = localStorage.getItem(`visitors_override_${slug}_prev_${ed}`);
    return v != null ? parseInt(v, 10) : null;
  });
  useEffect(() => {
    const v = localStorage.getItem(prevOverrideKey);
    setPrevVisitorsOverride(v != null ? parseInt(v, 10) : null);
  }, [prevOverrideKey]);
  function savePrevVisitors(n) { localStorage.setItem(prevOverrideKey, n); setPrevVisitorsOverride(n); }
  function clearPrevVisitors() { localStorage.removeItem(prevOverrideKey); setPrevVisitorsOverride(null); }

  // IG Profile Visits overrides
  const igKey     = `ig_override_${slug}_${ed}`;
  const igPrevKey = `ig_override_${slug}_prev_${ed}`;
  const [igOverride,     setIgOverride]     = useState(() => { const v = localStorage.getItem(`ig_override_${slug}_${ed}`);      return v != null ? parseInt(v, 10) : null; });
  const [igPrevOverride, setIgPrevOverride] = useState(() => { const v = localStorage.getItem(`ig_override_${slug}_prev_${ed}`); return v != null ? parseInt(v, 10) : null; });
  useEffect(() => { const v = localStorage.getItem(igKey);     setIgOverride(v     != null ? parseInt(v, 10) : null); }, [igKey]);
  useEffect(() => { const v = localStorage.getItem(igPrevKey); setIgPrevOverride(v != null ? parseInt(v, 10) : null); }, [igPrevKey]);
  function saveIg(n)     { localStorage.setItem(igKey,     n); setIgOverride(n); }
  function clearIg()     { localStorage.removeItem(igKey);     setIgOverride(null); }
  function saveIgPrev(n) { localStorage.setItem(igPrevKey, n); setIgPrevOverride(n); }
  function clearIgPrev() { localStorage.removeItem(igPrevKey); setIgPrevOverride(null); }

  const igFromTab     = m ? sumW(data.igVisits, m.cs, m.end, ['profileVisits']).profileVisits : 0;
  const igPrevFromTab = m ? sumW(data.igVisits, addDays(m.cs, -28), addDays(m.cs, -1), ['profileVisits']).profileVisits : 0;
  const displayIg     = igOverride     != null ? igOverride     : (igFromTab > 0 ? igFromTab : m?.fb.profileVisits  ?? 0);
  const displayIgPrev = igPrevOverride != null ? igPrevOverride : (igPrevFromTab > 0 ? igPrevFromTab : m?.fbp.profileVisits ?? 0);
  const displayIgChg  = displayIg > 0 && displayIgPrev > 0 ? pct(displayIg, displayIgPrev) : m?.igChg;

  const displayUsers     = visitorsOverride     != null ? visitorsOverride     : m?.c.users ?? 0;
  const displayPrevUsers = prevVisitorsOverride != null ? prevVisitorsOverride : m?.p.users ?? 0;
  const displayUsersChg  = displayUsers > 0 && displayPrevUsers > 0 ? pct(displayUsers, displayPrevUsers) : m?.usersChg;
  const nextActions = useMemo(() => generateNextActions(m, data, igFromTab), [m, data, igFromTab]);

  // Derived conv rates using displayUsers / displayPrevUsers
  const convRate     = m && displayUsers     > 0 ? (m.c.covers / displayUsers     * 100) : null;
  const convRatePrev = m && displayPrevUsers > 0 ? (m.p.covers / displayPrevUsers * 100) : null;
  const convRateChg  = convRate != null && convRatePrev != null ? pct(convRate, convRatePrev) : null;

  const monthLabel = useMemo(() => {
    const [y, mo] = ed.split('-');
    return new Date(+y, +mo - 1).toLocaleString('en-CA', { month: 'short', year: 'numeric' });
  }, [ed]);

  const trendText = m?.cpcChg != null
    ? parseFloat(m.cpcChg) < 0
      ? `↓ Trending more efficient (${Math.abs(m.cpcChg)}% vs prev period)`
      : `↑ Less efficient (${Math.abs(m.cpcChg)}% vs prev period)`
    : '';
  const trendGood = m?.cpcChg != null && parseFloat(m.cpcChg) < 0;
  const updatedLabel = lastUpdated ? fmtTs(lastUpdated) : restaurant.lastUpdated;


  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Nav restaurantName={restaurant.name} />

      {/* ── Hero ── */}
      <Section borderBottom>
        <div style={{ padding: '48px 0 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#22c55e', marginBottom: 16 }}>
            Performance Dashboard
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, margin: '0 0 12px' }}>
            {restaurant.name}
          </h1>
          <p style={{ fontSize: '1rem', color: '#666', margin: '0 0 16px' }}>
            North Star Metrics · {monthLabel}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#444' }}>
              {loading ? 'Refreshing...' : `Last updated ${updatedLabel}`}
            </span>
            <button onClick={refresh} disabled={loading}
              style={{ background: 'none', border: '1px solid #333', borderRadius: 6, color: loading ? '#444' : '#666', cursor: loading ? 'default' : 'pointer', fontSize: 12, padding: '3px 10px' }}>
              {loading ? '...' : '↻ Refresh'}
            </button>
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
          </div>
        </div>
      </Section>

      {/* ── North Star ── */}
      <div style={{ background: '#040404', borderBottom: '1px solid #1f1f1f' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 32px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#22c55e', marginBottom: 16 }}>The North Star</div>
          <div style={{ fontSize: 'clamp(72px, 12vw, 120px)', fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginBottom: 16 }}>
            {m ? `$${m.cpc.toFixed(2)}` : '—'}
          </div>
          <div style={{ fontSize: 15, color: '#666', marginBottom: 8 }}>
            Spend Per Cover
          </div>
          {m?.cpc > 0 && (
            <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
              <span style={{ marginLeft: 8, color: '#444' }}>({fmtD(m.c.spend)} ÷ {fmt(m.c.covers)} covers)</span>
            </div>
          )}
          {trendText && (
            <div style={{ fontSize: 13, color: trendGood ? '#22c55e' : '#f07070' }}>{trendText}</div>
          )}
        </div>
      </div>

      {/* ── 3-col KPI ── */}
      <Section borderBottom>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {[
            { label: 'Covers',              val: m ? fmt(m.c.covers) : '—',                        prev: m ? `prev period: ${fmt(m.p.covers)}` : null,          chg: m?.coversChg, pos: parseFloat(m?.coversChg) >= 0, note: m?.c.covers > 0 ? `${fmt(m.c.seatedCovers)} confirmed · ${(m.c.seatedCovers / m.c.covers * 100).toFixed(1)}% of total` : null },
            { label: 'Unique Web Visitors', val: m ? fmtK(displayUsers) : '—', prev: m ? `prev period: ${fmtK(displayPrevUsers)}` : null, chg: displayUsersChg, pos: parseFloat(displayUsersChg) >= 0,
              extra: m ? (
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ManualEdit label="current" value={visitorsOverride} onSave={saveVisitors} onClear={clearVisitors} />
                  <ManualEdit label="prev period" value={prevVisitorsOverride} onSave={savePrevVisitors} onClear={clearPrevVisitors} />
                </span>
              ) : null },
            { label: 'IG Profile Visits', val: displayIg > 0 ? fmt(displayIg) : '—', prev: displayIgPrev > 0 ? `prev period: ${fmt(displayIgPrev)}` : null, chg: displayIgChg, pos: parseFloat(displayIgChg) >= 0,
              extra: m ? (
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ManualEdit label="current"  value={igOverride}     onSave={saveIg}     onClear={clearIg} />
                  <ManualEdit label="prev period" value={igPrevOverride} onSave={saveIgPrev} onClear={clearIgPrev} />
                </span>
              ) : null },
          ].map((k, i) => (
            <div key={i} style={{ padding: '32px 24px', borderRight: i < 2 ? '1px solid #1f1f1f' : 'none' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#666', marginBottom: 12 }}>{k.label}</div>
              <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, marginBottom: 8 }}>{k.val}</div>
              {k.prev && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{k.prev}</div>}
              {k.chg != null && k.chg !== '—' && (
                <div style={{ fontSize: 12, fontWeight: 600, color: k.pos ? '#22c55e' : '#f07070' }}>
                  {parseFloat(k.chg) >= 0 ? `↑ ${k.chg}%` : `↓ ${Math.abs(k.chg)}%`}
                </div>
              )}
              {k.note && <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{k.note}</div>}
              {k.extra && <div style={{ marginTop: 6 }}>{k.extra}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2-col spend row ── */}
      <Section borderBottom>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ padding: '28px 0', paddingRight: 32, borderRight: '1px solid #1f1f1f' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#666', marginBottom: 8 }}>Total Mktg Spend</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{m ? fmtD(m.c.spend) : '—'}</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{m ? `${fmtD(m.fb.spend)} Meta · ${fmtD(m.googleTotal)} Google` : ''}</div>
            {m && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>prev period: {fmtD(m.p.spend)}</div>}
            {m?.spendChg != null && (
              <div style={{ fontSize: 12, fontWeight: 600, color: parseFloat(m.spendChg) <= 0 ? '#22c55e' : '#f07070' }}>
                {parseFloat(m.spendChg) >= 0 ? `↑ ${m.spendChg}%` : `↓ ${Math.abs(m.spendChg)}%`}
              </div>
            )}
          </div>
          <div style={{ padding: '28px 0', paddingLeft: 32 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#666', marginBottom: 8 }}>Covers Per Web Visitor</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{convRate != null ? `${convRate.toFixed(1)}%` : '—'}</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{m ? `${fmt(m.c.covers)} covers ÷ ${fmt(displayUsers)} visitors` : ''}</div>
            {convRatePrev != null && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>prev period: {convRatePrev.toFixed(1)}%</div>}
            {convRateChg != null && (
              <div style={{ fontSize: 12, fontWeight: 600, color: parseFloat(convRateChg) >= 0 ? '#22c55e' : '#f07070' }}>
                {parseFloat(convRateChg) >= 0 ? `↑ ${convRateChg}%` : `↓ ${Math.abs(convRateChg)}%`}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── 4-Week Summary ── */}
      <Section borderBottom>
        <div style={{ padding: '40px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>4-Week Period Summary</h2>
            <span style={{ fontSize: 12, color: '#666' }}>{monthLabel}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <SummaryCard label="Spend Per Cover" value={m ? `$${m.cpc.toFixed(2)}` : '—'} sub={m ? `${fmtD(m.c.spend)} ÷ ${fmt(m.c.covers)} covers${m.pcpc > 0 ? ` · prev: $${m.pcpc.toFixed(2)}` : ''}` : ''} />
            <SummaryCard label="Covers"           value={m ? fmt(m.c.covers) : '—'}          sub={m ? `prev period: ${fmt(m.p.covers)}${m.c.covers > 0 ? ` · ${(m.c.seatedCovers / m.c.covers * 100).toFixed(1)}% confirmed` : ''}` : ''} />
            <SummaryCard label="Covers Per Web Visitor" value={m && displayUsers > 0 ? `${(m.c.covers / displayUsers * 100).toFixed(1)}%` : '—'} sub={m ? `${fmt(m.c.covers)} ÷ ${fmtK(displayUsers)} visitors` : ''} />
            <SummaryCard label="IG Profile Visits" value={displayIg > 0 ? fmt(displayIg) : '—'} sub={displayIgPrev > 0 ? `prev period: ${fmt(displayIgPrev)}` : ''} />
          </div>
        </div>
      </Section>

      {/* ── Optimization Data ── */}
      <OptAccordion m={m} restaurant={restaurant} data={data} nextActions={nextActions} displayIg={displayIg} displayIgPrev={displayIgPrev} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px', textAlign: 'center' }}>
        <p style={{ fontStyle: 'italic', color: '#444', fontSize: '0.85rem' }}>
          "Less is more. Nail the basics, then layer complexity."
        </p>
      </div>
    </div>
  );
}
