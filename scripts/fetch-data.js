// Usage: node scripts/fetch-data.js berczy|notte
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIGS = {
  berczy: {
    sheetId: process.env.BERCZY_SHEET_ID || '1kH0yrnjAyBW3cEvosnAqfXEYL5u_oXdeT3dMCmcSNzU',
    tabs: {
      summary:       139701347,
      facebook:      1594038272,
      googleAds:     255260152,
      googlePrivate: 714889717,
      reservations:  1822235296,
      perfectVenue:  1125904723,
      emailSent:     1698240072,
      emails:        150809214,
      igVisits:      2042986998,
      webSources:    339143722,
    },
  },
  notte: {
    sheetId: process.env.NOTTE_SHEET_ID || '19bp0Gxn2v8yYGjAoFYYGgE6XIr3CVZVynY73eSghue0',
    tabs: {
      summary:       1628935455,
      facebook:      1312145769,
      igVisits:      267788399,
      webSources:    1263159711,
      googleAds:     2012387732,
      googlePrivate: 573671451,
      reservations:  1549980173,
      perfectVenue:  1615420596,
      emailSent:     731081373,
      emails:        1631206564,
    },
  },
};

const slug = process.argv[2];
if (!CONFIGS[slug]) {
  console.error(`Usage: node scripts/fetch-data.js berczy|notte`);
  process.exit(1);
}

const { sheetId, tabs } = CONFIGS[slug];

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function cleanNum(val) {
  if (!val) return 0;
  return parseFloat(val.replace(/[A-Z]{1,3}\$|[$%,₱\s]/g, '')) || 0;
}

async function fetchCSV(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed gid=${gid}: ${res.status}`);
  return (await res.text()).split('\n').filter(l => l.trim());
}

function fbCalc(obj) {
  obj.ctr = obj.impressions > 0 ? +(obj.clicks/obj.impressions*100).toFixed(2) : 0;
  obj.cpc = obj.clicks > 0 ? +(obj.spend/obj.clicks).toFixed(2) : 0;
  obj.cpm = obj.impressions > 0 ? +(obj.spend/obj.impressions*1000).toFixed(2) : 0;
  obj.reservations = obj.resEvent;
  obj.costPerResEvent   = obj.resEvent   > 0 ? +(obj.spend/obj.resEvent).toFixed(2)   : 0;
  obj.costPerResResults = obj.resResults > 0 ? +(obj.spend/obj.resResults).toFixed(2) : 0;
  obj.costPerReservation = obj.costPerResEvent;
  obj.profileToReservation = obj.profileVisits > 0 ? +(obj.resEvent/obj.profileVisits*100).toFixed(2) : 0;
}

async function processSummary() {
  const lines = await fetchCSV(tabs.summary);
  const daily = []; const monthly = {};
  for (let i = 1; i < lines.length; i++) {
    const col = parseCSVLine(lines[i]);
    if (!col[0] || !col[0].match(/\d+\/\d+\/\d+/)) continue;
    const [m, d, y] = col[0].split('/');
    if (!y) continue;
    const spend = cleanNum(col[1]), covers = cleanNum(col[2]), users = cleanNum(col[3]);
    const date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const mk = `${y}-${m.padStart(2,'0')}`;
    daily.push({ date, spend, covers, users });
    if (!monthly[mk]) monthly[mk] = { month: mk, spend: 0, covers: 0, users: 0, days: 0 };
    monthly[mk].spend += spend; monthly[mk].covers += covers;
    monthly[mk].users += users; monthly[mk].days++;
  }
  const arr = Object.values(monthly).sort((a,b) => a.month.localeCompare(b.month));
  arr.forEach(m => {
    m.costPerCover = m.covers > 0 ? +(m.spend/m.covers).toFixed(2) : 0;
    m.avgDailyCovers = m.days > 0 ? +(m.covers/m.days).toFixed(1) : 0;
  });
  return { daily, monthly: arr };
}

async function processFacebook() {
  const lines = await fetchCSV(tabs.facebook);
  const monthly = {}, daily = {}, campaigns = {}, campMonthly = {};
  for (let i = 1; i < lines.length; i++) {
    const col = parseCSVLine(lines[i]);
    if (!col[0] || !col[0].match(/^\d{4}-\d{2}-\d{2}/)) continue;
    const date = col[0].trim();
    const [y, m] = date.split('-');
    const key = `${y}-${m}`;
    const spend = cleanNum(col[12]), reach = cleanNum(col[7]);
    const impr = cleanNum(col[14]), clicks = cleanNum(col[20]);
    const linkClicks = cleanNum(col[16]);
    const resultIndicator = (col[6] || '').trim();
    const resultVal = cleanNum(col[5]);
    const otRes = resultIndicator === 'conversions:offsite_conversion.fb_pixel_custom.opentable_reservation' ? resultVal : 0;
    const resEvent = 0, resResults = 0, profileVisits = 0, resultsCount = linkClicks, thruPlays = 0;
    const campaign = (col[2] || 'Unknown').trim();
    const empty = () => ({ spend:0, reach:0, impressions:0, clicks:0, resEvent:0, resResults:0, profileVisits:0, resultsCount:0, thruPlays:0, otRes:0 });
    const add = (obj) => { obj.spend+=spend; obj.reach+=reach; obj.impressions+=impr; obj.clicks+=clicks; obj.resEvent+=resEvent; obj.resResults+=resResults; obj.profileVisits+=profileVisits; obj.resultsCount+=resultsCount; obj.thruPlays+=thruPlays; obj.otRes+=otRes; };
    if (!monthly[key]) monthly[key] = { month: key, ...empty() };
    add(monthly[key]);
    if (!daily[date]) daily[date] = { date, ...empty() };
    add(daily[date]);
    if (!campaigns[campaign]) campaigns[campaign] = { campaign, firstDate: date, lastDate: date, ...empty() };
    add(campaigns[campaign]);
    if (date > campaigns[campaign].lastDate) campaigns[campaign].lastDate = date;
    const campMonKey = `${campaign}||${key}`;
    if (!campMonthly[campMonKey]) campMonthly[campMonKey] = { month: key, campaign, ...empty() };
    add(campMonthly[campMonKey]);
  }
  const arr = Object.values(monthly).sort((a,b) => a.month.localeCompare(b.month));
  arr.forEach(fbCalc);
  const dailyArr = Object.values(daily).sort((a,b) => a.date.localeCompare(b.date));
  dailyArr.forEach(d => { d.ctr = d.impressions > 0 ? +(d.clicks/d.impressions*100).toFixed(2) : 0; d.cpc = d.clicks > 0 ? +(d.spend/d.clicks).toFixed(2) : 0; });
  const campArr = Object.values(campaigns).sort((a,b) => b.spend - a.spend);
  campArr.forEach(fbCalc);
  const campMonthlyArr = Object.values(campMonthly).sort((a,b) => a.month.localeCompare(b.month) || a.campaign.localeCompare(b.campaign));
  campMonthlyArr.forEach(fbCalc);
  return { monthly: arr, daily: dailyArr, campaigns: campArr, campMonthly: campMonthlyArr };
}

async function processGoogleAds() {
  const lines = await fetchCSV(tabs.googleAds);
  const monthly = {}, daily = {}, campaigns = {}, campMonthly = {};
  for (let i = 3; i < lines.length; i++) {
    const col = parseCSVLine(lines[i]);
    if (!col[0] || !col[0].match(/^\d{4}/)) continue;
    const date = col[0].trim();
    const [y, m] = date.split('-');
    const key = `${y}-${m}`;
    const spend = cleanNum(col[1]), impr = cleanNum(col[2]), clicks = cleanNum(col[3]);
    const res = cleanNum(col[10]), storeVisits = cleanNum(col[12]), calls = cleanNum(col[14]);
    const campaign = (col[7] || '').trim();
    if (!monthly[key]) monthly[key] = { month: key, spend:0, impressions:0, clicks:0, reservations:0, storeVisits:0, calls:0 };
    monthly[key].spend+=spend; monthly[key].impressions+=impr; monthly[key].clicks+=clicks; monthly[key].reservations+=res; monthly[key].storeVisits+=storeVisits; monthly[key].calls+=calls;
    if (!daily[date]) daily[date] = { date, spend:0, impressions:0, clicks:0, reservations:0, storeVisits:0, calls:0 };
    daily[date].spend+=spend; daily[date].impressions+=impr; daily[date].clicks+=clicks; daily[date].reservations+=res; daily[date].storeVisits+=storeVisits; daily[date].calls+=calls;
    if (campaign) {
      if (!campaigns[campaign]) campaigns[campaign] = { name: campaign, spend:0, clicks:0, impressions:0, reservations:0, storeVisits:0, calls:0 };
      campaigns[campaign].spend+=spend; campaigns[campaign].clicks+=clicks; campaigns[campaign].impressions+=impr; campaigns[campaign].reservations+=res; campaigns[campaign].storeVisits+=storeVisits; campaigns[campaign].calls+=calls;
      const ck = `${campaign}||${key}`;
      if (!campMonthly[ck]) campMonthly[ck] = { month:key, name:campaign, spend:0, clicks:0, impressions:0, reservations:0, storeVisits:0, calls:0 };
      campMonthly[ck].spend+=spend; campMonthly[ck].clicks+=clicks; campMonthly[ck].impressions+=impr; campMonthly[ck].reservations+=res; campMonthly[ck].storeVisits+=storeVisits; campMonthly[ck].calls+=calls;
    }
  }
  const arr = Object.values(monthly).sort((a,b) => a.month.localeCompare(b.month));
  arr.forEach(m => { m.ctr = m.impressions>0?+(m.clicks/m.impressions*100).toFixed(2):0; m.cpc = m.clicks>0?+(m.spend/m.clicks).toFixed(2):0; m.costPerRes = m.reservations>0?+(m.spend/m.reservations).toFixed(2):0; });
  const campArr = Object.values(campaigns).map(c => ({ ...c, cpc:c.clicks>0?+(c.spend/c.clicks).toFixed(2):0, costPerRes:c.reservations>0?+(c.spend/c.reservations).toFixed(2):0 }));
  const campMonthlyArr = Object.values(campMonthly).sort((a,b) => a.month.localeCompare(b.month)).map(c => ({ ...c, cpc:c.clicks>0?+(c.spend/c.clicks).toFixed(2):0, costPerRes:c.reservations>0?+(c.spend/c.reservations).toFixed(2):0 }));
  const dailyArr = Object.values(daily).sort((a,b) => a.date.localeCompare(b.date));
  dailyArr.forEach(d => { d.ctr = d.impressions>0?+(d.clicks/d.impressions*100).toFixed(2):0; d.cpc = d.clicks>0?+(d.spend/d.clicks).toFixed(2):0; d.costPerRes = d.reservations>0?+(d.spend/d.reservations).toFixed(2):0; });
  return { monthly: arr, daily: dailyArr, campaigns: campArr, campMonthly: campMonthlyArr };
}

async function processGooglePrivate() {
  const lines = await fetchCSV(tabs.googlePrivate);
  const monthly = {};
  for (let i = 3; i < lines.length; i++) {
    const col = parseCSVLine(lines[i]);
    if (!col[0] || !col[0].match(/^\d{4}/)) continue;
    const [y, m] = col[0].split('-');
    const key = `${y}-${m}`;
    const spend = cleanNum(col[1]), impr = cleanNum(col[2]), clicks = cleanNum(col[3]), leads = cleanNum(col[11]);
    if (!monthly[key]) monthly[key] = { month: key, spend:0, impressions:0, clicks:0, leads:0 };
    monthly[key].spend+=spend; monthly[key].impressions+=impr; monthly[key].clicks+=clicks; monthly[key].leads+=leads;
  }
  const arr = Object.values(monthly).sort((a,b) => a.month.localeCompare(b.month));
  arr.forEach(m => { m.ctr = m.impressions>0?+(m.clicks/m.impressions*100).toFixed(2):0; m.costPerLead = m.leads>0?+(m.spend/m.leads).toFixed(2):0; });
  return arr;
}

async function processReservations() {
  const lines = await fetchCSV(tabs.reservations);
  const emailFirstDate = {};
  const validStatuses = ['Done','Assumed Finished','Confirmed','Paid','Seated'];
  for (let i = 1; i < lines.length; i++) {
    const col = parseCSVLine(lines[i]);
    if (!col[2] || !col[2].match(/\d+\/\d+\/\d+/)) continue;
    const [m, d, y] = col[2].split('/');
    if (!y || parseInt(y) < 2020) continue;
    const email = (col[14]||'').trim().toLowerCase();
    const phone = (col[13]||'').trim().replace(/\D/g,'');
    const name  = (col[11]||'').trim().toLowerCase();
    const guestId = email || phone || name || null;
    const status = (col[20]||'').trim();
    if (!guestId || !validStatuses.includes(status)) continue;
    const dk = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    if (!emailFirstDate[guestId] || dk < emailFirstDate[guestId]) emailFirstDate[guestId] = dk;
  }
  let total = 0, totalCovers = 0, firstVisit = 0, optIn = 0, done = 0, cancelled = 0, noShow = 0;
  const days = { Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0 };
  const times = {}, sizes = {}, monthly = {}, daily = {}, firstVisitByVisitDate = {}, repeatByVisitDate = {}, ltSpends = [];
  for (let i = 1; i < lines.length; i++) {
    const col = parseCSVLine(lines[i]);
    if (!col[2] || !col[2].match(/\d+\/\d+\/\d+/)) continue;
    const [m, d, y] = col[2].split('/');
    if (!y || parseInt(y) < 2020) continue;
    const dt = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
    days[dow] = (days[dow]||0) + 1;
    const tm = (col[1]||'').trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (tm) {
      let h = parseInt(tm[1]);
      if (tm[3].toUpperCase()==='PM' && h!==12) h+=12;
      if (tm[3].toUpperCase()==='AM' && h===12) h=0;
      const label = h===0?'12AM':h<12?`${h}AM`:h===12?'12PM':`${h-12}PM`;
      times[label] = (times[label]||0)+1;
    }
    const size = parseInt(col[19])||0, status = (col[20]||'').trim();
    const seated = ['Done','Assumed Finished','Confirmed','Paid','Seated'].includes(status);
    const dateKey = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const visitRaw = (col[0]||'').trim();
    let visitKey = '';
    if (visitRaw.match(/\d+\/\d+\/\d+/)) {
      const [vm,vd,vy] = visitRaw.split('/');
      visitKey = `${vy.length===2?'20'+vy:vy}-${vm.padStart(2,'0')}-${vd.padStart(2,'0')}`;
    }
    const email = (col[14]||'').trim().toLowerCase();
    const phone = (col[13]||'').trim().replace(/\D/g,'');
    const name  = (col[11]||'').trim().toLowerCase();
    const guestId = email || phone || name || null;
    const isFirst = seated && guestId && emailFirstDate[guestId] === dateKey;
    const key = `${y}-${m.padStart(2,'0')}`;
    if (!monthly[key]) monthly[key] = { month:key, reservations:0, covers:0, firstVisit:0, repeat:0, cancelled:0, noShow:0 };
    if (!daily[dateKey]) daily[dateKey] = { date:dateKey, reservations:0, covers:0, firstVisit:0, cancelled:0, noShow:0 };
    monthly[key].reservations++; monthly[key].covers+=size;
    daily[dateKey].reservations++; daily[dateKey].covers+=size;
    if (visitKey) {
      const vMonth = visitKey.slice(0,7);
      if (!monthly[vMonth]) monthly[vMonth] = { month:vMonth, reservations:0, covers:0, firstVisit:0, repeat:0, cancelled:0, noShow:0 };
      if (isFirst && ['Done','Assumed Finished'].includes(status)) {
        if (!firstVisitByVisitDate[visitKey]) firstVisitByVisitDate[visitKey] = { date:visitKey, firstVisit:0 };
        firstVisitByVisitDate[visitKey].firstVisit++;
        monthly[vMonth].firstVisit++;
      } else if (seated&&guestId&&emailFirstDate[guestId]&&visitKey!==emailFirstDate[guestId]) {
        if (!repeatByVisitDate[visitKey]) repeatByVisitDate[visitKey] = { date:visitKey, repeat:0 };
        repeatByVisitDate[visitKey].repeat++;
        monthly[vMonth].repeat++;
      }
    }
    if (['Canceled','No Show','Not Confirmed'].includes(status)) { monthly[key].cancelled++; daily[dateKey].cancelled++; cancelled++; }
    if (status==='No Show') { monthly[key].noShow++; daily[dateKey].noShow++; noShow++; }
    if (status==='Not Confirmed') { monthly[key].notConfirmed=(monthly[key].notConfirmed||0)+1; daily[dateKey].notConfirmed=(daily[dateKey].notConfirmed||0)+1; }
    if (seated) { monthly[key].seatedRes=(monthly[key].seatedRes||0)+1; monthly[key].seatedCovers=(monthly[key].seatedCovers||0)+size; daily[dateKey].seatedRes=(daily[dateKey].seatedRes||0)+1; daily[dateKey].seatedCovers=(daily[dateKey].seatedCovers||0)+size; }
    if (status==='Done'||status==='Assumed Finished') done++;
    if (isFirst) firstVisit++;
    if ((col[15]||'').trim()==='TRUE') { optIn++; monthly[key].optIn=(monthly[key].optIn||0)+1; daily[dateKey].optIn=(daily[dateKey].optIn||0)+1; }
    if (size) sizes[size]=(sizes[size]||0)+1;
    total++; totalCovers+=size;
  }
  const timeArr = Object.entries(times).map(([label,count]) => {
    const h = label.endsWith('AM')?(label==='12AM'?0:parseInt(label)):(label==='12PM'?12:parseInt(label)+12);
    return { label, count, hour:h };
  }).sort((a,b) => a.hour-b.hour);
  return {
    summary: { total, totalCovers, avgPartySize:+(totalCovers/total).toFixed(2),
      completionRate:+(done/total*100).toFixed(1), cancellationRate:+(cancelled/total*100).toFixed(1),
      noShowRate:+(noShow/total*100).toFixed(1), firstVisitRate:+(firstVisit/total*100).toFixed(1),
      returnRate:+((total-firstVisit)/total*100).toFixed(1), optInRate:+(optIn/total*100).toFixed(1),
      avgLifetimeSpend:ltSpends.length?+(ltSpends.reduce((a,b)=>a+b,0)/ltSpends.length).toFixed(2):0 },
    days, times: timeArr,
    sizes: Object.entries(sizes).map(([s,c])=>({size:parseInt(s),count:c})).sort((a,b)=>a.size-b.size),
    monthly: Object.values(monthly).sort((a,b)=>a.month.localeCompare(b.month)),
    daily: Object.values(daily).sort((a,b)=>a.date.localeCompare(b.date)),
    firstVisitDaily: Object.values(firstVisitByVisitDate).sort((a,b)=>a.date.localeCompare(b.date)),
    repeatDaily: Object.values(repeatByVisitDate).sort((a,b)=>a.date.localeCompare(b.date)),
  };
}

async function processPerfectVenue() {
  const lines = await fetchCSV(tabs.perfectVenue);
  const statuses = {}, lostReasons = {}, monthly = {}, pvDaily = {};
  let completedRev = 0, completedCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const col = parseCSVLine(lines[i]);
    if (!col[1]) continue;
    const status = (col[3]||'').trim();
    const lostReason = (col[28]||'').trim().replace(/['"]/g,'');
    const proposalTotal = cleanNum(col[42]);
    const createdOn = (col[22]||'').trim();
    statuses[status] = (statuses[status]||0)+1;
    if (lostReason && status==='Lost') lostReasons[lostReason] = (lostReasons[lostReason]||0)+1;
    if (createdOn && createdOn.match(/\d+\/\d+\/\d+/)) {
      const [m, d, y] = createdOn.split('/');
      if (y) {
        const key = `${y}-${m.padStart(2,'0')}`;
        const dateKey = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        if (!monthly[key]) monthly[key] = { month:key, leads:0, completed:0, lost:0 };
        if (!pvDaily[dateKey]) pvDaily[dateKey] = { date:dateKey, leads:0, completed:0, lost:0 };
        monthly[key].leads++; pvDaily[dateKey].leads++;
        if (status==='Completed') { monthly[key].completed++; pvDaily[dateKey].completed++; }
        if (status==='Lost') { monthly[key].lost++; pvDaily[dateKey].lost++; }
      }
    }
    if (status==='Completed' && proposalTotal>0) { completedRev+=proposalTotal; completedCount++; }
  }
  return {
    statuses: Object.entries(statuses).map(([s,c])=>({status:s,count:c})).sort((a,b)=>b.count-a.count),
    lostReasons: Object.entries(lostReasons).filter(([r])=>r.length>1).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([reason,count])=>({reason,count})),
    monthly: Object.values(monthly).sort((a,b)=>a.month.localeCompare(b.month)),
    daily: Object.values(pvDaily).sort((a,b)=>a.date.localeCompare(b.date)),
    totalCompletedRevenue: +completedRev.toFixed(0),
    avgRevenuePerEvent: completedCount>0?+(completedRev/completedCount).toFixed(0):0,
    closeRate: statuses.Completed&&statuses.Lost?+((statuses.Completed/(statuses.Completed+statuses.Lost))*100).toFixed(1):0,
  };
}

async function processEmail() {
  const [sentLines, subLines] = await Promise.all([fetchCSV(tabs.emailSent), fetchCSV(tabs.emails)]);
  const monthly = {};
  for (let i = 1; i < sentLines.length; i++) {
    const col = parseCSVLine(sentLines[i]);
    const mo = (col[0]||'').trim().match(/(\d+)\/(\d+)\/(\d+)/);
    if (!mo) continue;
    const key = `${mo[3]}-${mo[1].padStart(2,'0')}`;
    const status = (col[3]||'').trim();
    if (!monthly[key]) monthly[key] = { month:key, total:0, delivered:0, opened:0, clicked:0, unsubscribed:0, replied:0 };
    monthly[key].total++;
    if (status==='Delivered') monthly[key].delivered++;
    if (status==='Opened') monthly[key].opened++;
    if (status==='Clicked') monthly[key].clicked++;
    if (status==='Unsubscribed') monthly[key].unsubscribed++;
    if (status==='Replied') monthly[key].replied++;
  }
  const arr = Object.values(monthly).sort((a,b)=>a.month.localeCompare(b.month));
  arr.forEach(m => { m.openRate=m.total>0?+(m.opened/m.total*100).toFixed(1):0; m.clickRate=m.total>0?+(m.clicked/m.total*100).toFixed(1):0; m.unsubRate=m.total>0?+(m.unsubscribed/m.total*100).toFixed(1):0; });
  const subMonths = {};
  for (let i = 1; i < subLines.length; i++) {
    const col = parseCSVLine(subLines[i]);
    const mo = (col[0]||'').trim().match(/(\w+)\s+(\d+)\s+(\d+)/);
    if (mo) {
      const mm = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
      const key = `${mo[3]}-${mm[mo[1]]||'00'}`;
      subMonths[key] = (subMonths[key]||0)+1;
    }
  }
  return {
    monthly: arr,
    subscribersByMonth: Object.entries(subMonths).sort((a,b)=>a[0].localeCompare(b[0])).map(([month,count])=>({month,count})),
    totalSubscribers: subLines.length-1,
  };
}

async function processWebSources() {
  if (!tabs.webSources) return [];
  const lines = await fetchCSV(tabs.webSources);
  const daily = [];
  for (let i = 1; i < lines.length; i++) {
    const col = parseCSVLine(lines[i]);
    if (!col[0] || !col[1]) continue;
    const raw = col[1].trim();
    if (!raw.match(/^\d{8}$/)) continue;
    const date = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
    daily.push({ date, channel: col[0].trim(), sessions: cleanNum(col[2]) });
  }
  return daily.sort((a, b) => a.date.localeCompare(b.date));
}

async function processIgVisits() {
  if (!tabs.igVisits) return [];
  const lines = await fetchCSV(tabs.igVisits);
  const daily = [];
  for (let i = 1; i < lines.length; i++) {
    const col = parseCSVLine(lines[i]);
    if (!col[0]) continue;
    let date;
    if (col[0].match(/^\d{4}-\d{2}-\d{2}/)) {
      date = col[0].trim().slice(0, 10);
    } else if (col[0].match(/\d+\/\d+\/\d+/)) {
      const [m, d, y] = col[0].trim().split('/');
      date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    } else continue;
    daily.push({ date, profileVisits: cleanNum(col[1]) });
  }
  return daily.sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  console.log(`Fetching data for ${slug}...`);
  const outDir = path.join(__dirname, '..', 'public', 'data', slug);
  fs.mkdirSync(outDir, { recursive: true });

  const [summary, facebook, googleAds, googlePrivate, reservations, perfectVenue, email, igVisits, webSources] = await Promise.all([
    processSummary(), processFacebook(), processGoogleAds(), processGooglePrivate(),
    processReservations(), processPerfectVenue(), processEmail(), processIgVisits(), processWebSources(),
  ]);

  const write = (name, data) => {
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(data, null, 2));
    console.log(`  wrote ${name}.json`);
  };

  write('summary', summary);
  write('facebook', facebook);
  write('google-ads', googleAds);
  write('google-private', googlePrivate);
  write('reservations', reservations);
  write('perfect-venue', perfectVenue);
  write('email', email);
  write('ig-visits', igVisits);
  write('web-sources', webSources);

  console.log(`Done. Last updated: ${new Date().toISOString()}`);
}

main().catch(err => { console.error(err); process.exit(1); });
