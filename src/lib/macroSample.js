// Preview-only sample data for the Macro page, shaped exactly like /api/markets/macro.
// Made-up but realistic: gold falls when real yields and the dollar rise, the Nasdaq likes
// falling real yields and rising liquidity, and both move more on CPI, jobs and Fed days.
const DAY = 864e5, H = 36e5;
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const T = (d) => Date.parse(d + 'T00:00:00Z');

function rng(seed) {
  let s = seed;
  const u = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return { u, n: () => Math.sqrt(-2 * Math.log(u() || 1e-9)) * Math.cos(2 * Math.PI * u()) };
}
/** piecewise-linear path through [year fraction, value] anchors */
const path = (anchors) => (t) => {
  const y = 1970 + t / (365.25 * DAY);
  if (y <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) if (y <= anchors[i][0]) { const [a, va] = anchors[i - 1], [b, vb] = anchors[i]; return va + ((vb - va) * (y - a)) / (b - a); }
  return anchors.at(-1)[1];
};

// rough schedule for the sample: jobs = first Friday, CPI ≈ 12th, FOMC 8 Wednesdays a year
function sampleEvents(fromY, toY) {
  const out = [], et = (d, h, m) => T(d) + ((h + 5) * 60 + m) * 60e3 - (isDst(d) ? H : 0);
  const isDst = (d) => { const m = +d.slice(5, 7); return m > 3 && m < 11; };
  for (let y = fromY; y <= toY; y++) {
    for (let m = 0; m < 12; m++) {
      let t = Date.UTC(y, m, 1); while (new Date(t).getUTCDay() !== 5) t += DAY;
      out.push({ type: 'NFP', date: ymd(t), at: et(ymd(t), 8, 30), label: 'US jobs report (NFP)' });
      let c = Date.UTC(y, m, 12); while ([0, 6].includes(new Date(c).getUTCDay())) c += DAY;
      out.push({ type: 'CPI', date: ymd(c), at: et(ymd(c), 8, 30), label: 'US CPI (inflation)' });
    }
    for (const [m, d] of [[0, 29], [2, 19], [3, 30], [5, 17], [6, 29], [8, 17], [9, 29], [11, 10]]) {
      let t = Date.UTC(y, m, d); while (new Date(t).getUTCDay() !== 3) t += DAY;
      out.push({ type: 'FOMC', date: ymd(t), at: et(ymd(t), 14, 0), label: 'Fed rate decision (FOMC)' });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function sampleMacro(now = Date.now()) {
  const R = rng(20261128);
  let end = Math.floor(now / DAY) * DAY; while ([0, 6].includes(new Date(end).getUTCDay())) end -= DAY;
  if (now - end < 22 * H && end === Math.floor(now / DAY) * DAY) end -= DAY; // today's close isn't in yet
  while ([0, 6].includes(new Date(end).getUTCDay())) end -= DAY;
  const days = []; for (let t = T('2005-01-03'); t <= end; t += DAY) if (![0, 6].includes(new Date(t).getUTCDay())) days.push(t);
  const events = sampleEvents(2005, new Date(now).getUTCFullYear() + 1);
  const evDays = new Set(events.map((e) => (e.type === 'FOMC' ? ymd(T(e.date) + DAY) : e.date)));

  const realA = path([[2005, 1.8], [2008.5, 2.3], [2009, 1.3], [2012.6, -0.8], [2013.6, 0.6], [2016.5, 0.0], [2018.8, 1.1], [2020.6, -1.0], [2021.9, -1.0], [2022.8, 1.6], [2023.8, 2.4], [2024.7, 1.6], [2025.5, 2.0], [2026.9, 1.8]]);
  const beA = path([[2005, 2.4], [2008.7, 1.2], [2009.6, 2.2], [2015.9, 1.5], [2018.5, 2.1], [2020.2, 1.0], [2022.3, 3.0], [2023.5, 2.3], [2026.9, 2.3]]);
  const fedA = path([[2005, 2.25], [2006.5, 5.25], [2007.7, 5.25], [2008.96, 0.25], [2015.95, 0.25], [2018.96, 2.5], [2019.55, 2.5], [2019.83, 1.75], [2020.15, 1.75], [2020.21, 0.25], [2022.2, 0.25], [2023.6, 5.5], [2024.7, 5.5], [2024.96, 4.5], [2025.7, 4.5], [2025.96, 3.75], [2026.5, 3.5], [2026.95, 3.5]]);
  const usdA = path([[2005, 105], [2008.3, 88], [2009.2, 103], [2011.5, 94], [2015.2, 115], [2018.1, 110], [2020.3, 126], [2021.1, 112], [2022.8, 128], [2023.5, 118], [2025.0, 129], [2025.6, 120], [2026.9, 121]]);
  const vixA = path([[2005, 13], [2008.8, 55], [2009.5, 25], [2011.6, 35], [2012.5, 16], [2017.5, 10], [2018.1, 22], [2018.9, 25], [2019.5, 14], [2020.2, 60], [2020.8, 28], [2021.8, 18], [2022.5, 30], [2023.5, 14], [2024.6, 22], [2025.3, 35], [2025.8, 16], [2026.9, 17]]);
  const walA = path([[2005, 0.83e6], [2008.7, 0.9e6], [2008.95, 2.2e6], [2014.8, 4.5e6], [2017.8, 4.45e6], [2019.6, 3.8e6], [2020.2, 4.2e6], [2020.45, 7.0e6], [2022.3, 8.95e6], [2025.4, 6.7e6], [2026.9, 6.6e6]]);
  const tgaA = path([[2005, 5], [2008.8, 300], [2010, 100], [2016, 350], [2020.5, 1700], [2021.6, 200], [2022.5, 750], [2023.4, 50], [2023.9, 750], [2026.9, 850]]);
  const rrpA = path([[2005, 0], [2021.2, 0], [2022.9, 2300], [2023.5, 2000], [2024.9, 150], [2025.6, 20], [2026.9, 5]]);
  const coreA = path([[2005, 2.2], [2008, 2.5], [2010.3, 0.8], [2012, 2.3], [2015, 1.8], [2019.5, 2.2], [2020.4, 1.0], [2021.6, 5.0], [2022.7, 6.6], [2023.7, 4.0], [2024.7, 3.2], [2025.6, 3.0], [2026.9, 2.7]]);
  const unA = path([[2005, 5.3], [2007.2, 4.4], [2009.8, 10], [2015, 5.5], [2019.9, 3.5], [2020.2, 3.6], [2020.3, 14.7], [2021, 6.4], [2022.5, 3.6], [2023.3, 3.4], [2024.6, 4.2], [2025.9, 4.4], [2026.9, 4.5]]);

  // daily macro
  const D = { real: [], be: [], fed: [], usd: [], vix: [], oil: [], hy: [], y2: [] };
  let real = realA(days[0]), be = beA(days[0]), usd = usdA(days[0]), lvix = Math.log(vixA(days[0])), oil = 45;
  for (const t of days) {
    real += 0.15 * (realA(t) - real) / 20 + 0.045 * R.n();
    be += 0.15 * (beA(t) - be) / 20 + 0.025 * R.n();
    usd *= 1 + 0.0045 * R.n() + 0.02 * (usdA(t) - usd) / usd / 5;
    lvix += 0.08 * (Math.log(vixA(t)) - lvix) + 0.06 * R.n();
    oil = Math.max(18, oil * Math.exp(0.021 * R.n() + 0.004 * Math.log(72 / oil)));
    const vix = Math.exp(lvix), fed = Math.round(fedA(t) * 4) / 4;
    D.real.push(real); D.be.push(be); D.fed.push(fed); D.usd.push(usd); D.vix.push(vix); D.oil.push(oil); D.hy.push(2.6 + vix * 0.17 + 0.1 * R.n()); D.y2.push(fed + 0.2 * R.n() - 0.1);
  }
  // prices
  const mk = (p0, p1, f) => {
    const lr = days.map((t, i) => f(i, t));
    const cum = []; let s = 0; for (const x of lr) { s += x; cum.push(s); }
    const adj = Math.log(p1 / p0) - cum.at(-1);
    let prev = p0;
    return days.map((t, i) => {
      const c = p0 * Math.exp(cum[i] + (adj * i) / (days.length - 1));
      const o = prev * (1 + 0.0015 * R.n()), sw = Math.abs(c - o) + c * 0.004 * Math.abs(R.n());
      prev = c;
      return [ymd(t), +o.toFixed(2), +(Math.max(o, c) + sw * 0.5).toFixed(2), +(Math.min(o, c) - sw * 0.5).toFixed(2), +c.toFixed(2)];
    });
  };
  const ev = (t) => (evDays.has(ymd(t)) ? 1.9 : 1);
  const gold = mk(430, 4396, (i, t) => (i ? -0.16 * (D.real[i] - D.real[i - 1]) - 0.45 * Math.log(D.usd[i] / D.usd[i - 1]) + 0.05 * (D.be[i] - D.be[i - 1]) + 0.0085 * R.n() * ev(t) : 0));
  const nq = mk(1520, 21480, (i, t) => (i ? -0.12 * (D.real[i] - D.real[i - 1]) - 0.35 * Math.log(D.vix[i] / D.vix[i - 1]) * 0.2 + 0.0115 * R.n() * ev(t) : 0));

  // FRED-shaped output (daily series sampled weekly like the server does)
  const wk = (vals) => { const out = []; days.forEach((t, i) => { const d = ymd(t), w = Math.floor((t / DAY + 3) / 7); if (out.length && out.at(-1)[2] === w) out[out.length - 1] = [d, vals[i], w]; else out.push([d, vals[i], w]); }); return out.map(([d, v]) => [d, +v.toFixed(3)]); };
  const weekly = (f, dow = 3) => { const out = []; for (let t = T('2005-01-05'); t <= end; t += 7 * DAY) out.push([ymd(t + (dow - 3) * DAY), +f(t).toFixed(3)]); return out; };
  const months = []; for (let y = 2004; ; y++) { let stop = false; for (let m = 0; m < 12; m++) { const t = Date.UTC(y, m, 1); if (t > end - 30 * DAY) { stop = true; break; } months.push(t); } if (stop) break; }
  let core = 200, cpi = 190, pce = 90, pay = 133000; const coreS = [], cpiS = [], pceS = [], unS = [], payS = [], ffS = [], sahmS = [];
  months.forEach((t) => {
    const r = coreA(t) / 1200 + 0.0007 * R.n(); core *= 1 + r; cpi *= 1 + r + 0.0015 * R.n(); pce *= 1 + r * 0.85 + 0.0004 * R.n();
    const un = Math.max(3.3, unA(t) + 0.08 * R.n());
    pay += (5.2 - un) * 60 + 40 + 60 * R.n();
    coreS.push([ymd(t), +core.toFixed(3)]); cpiS.push([ymd(t), +cpi.toFixed(3)]); pceS.push([ymd(t), +pce.toFixed(3)]); unS.push([ymd(t), +un.toFixed(1)]); payS.push([ymd(t), Math.round(pay)]);
    ffS.push([ymd(t), +Math.max(0.05, fedA(t + 15 * DAY) - 0.12).toFixed(2)]);
    const u3 = unS.slice(-3).reduce((s, x) => s + x[1], 0) / Math.min(3, unS.length);
    const lows = []; for (let k = Math.max(0, unS.length - 15); k < unS.length - 3; k++) lows.push(unS.slice(Math.max(0, k - 2), k + 1).reduce((s, x) => s + x[1], 0) / Math.min(3, k + 1));
    sahmS.push([ymd(t), +Math.max(0, u3 - (lows.length ? Math.min(...lows) : u3)).toFixed(2)]);
  });
  const vixAt = (t) => D.vix[Math.max(0, Math.min(days.length - 1, Math.round((t - days[0]) / DAY * 5 / 7)))];
  const F = (name, unit, freq, lag, points) => ({ name, unit, freq, lag, points });
  const fred = {
    DFII10: F('10-year real yield (TIPS)', '%', 'd', 0, wk(D.real)),
    DGS10: F('10-year Treasury yield', '%', 'd', 0, wk(D.real.map((r, i) => r + D.be[i]))),
    DGS2: F('2-year Treasury yield', '%', 'd', 0, wk(D.y2)),
    T10YIE: F('10-year breakeven inflation', '%', 'd', 0, wk(D.be)),
    DTWEXBGS: F('US dollar index (broad)', 'index', 'd', 0, wk(D.usd)),
    VIXCLS: F('VIX', 'index', 'd', 0, wk(D.vix)),
    BAMLH0A0HYM2: F('High-yield credit spread', '%', 'd', 0, wk(D.hy)),
    DFEDTARU: F('Fed funds rate (upper target)', '%', 'd', 0, wk(D.fed)),
    DCOILWTICO: F('WTI crude oil', '$', 'd', 0, wk(D.oil)),
    RRPONTSYD: F('Fed reverse repo', '$bn', 'd', 0, wk(days.map((t) => rrpA(t)))),
    WALCL: F('Fed balance sheet', '$m', 'w', 1, weekly((t) => walA(t) * (1 + 0.002 * R.n()))),
    WTREGEN: F('Treasury cash account (TGA)', '$bn', 'w', 1, weekly((t) => Math.max(5, tgaA(t) * (1 + 0.1 * R.n())))),
    NFCI: F('Financial conditions (Chicago Fed)', 'index', 'w', 5, weekly((t) => (vixAt(t) - 19) / 22 - 0.35, 5)),
    ICSA: F('Initial jobless claims', 'people', 'w', 5, weekly((t) => Math.round(230000 + (unA(t) - 4) * 30000 + 12000 * R.n()), 6)),
    CPIAUCSL: F('CPI', 'index', 'm', 45, cpiS), CPILFESL: F('Core CPI', 'index', 'm', 45, coreS), PCEPILFE: F('Core PCE prices', 'index', 'm', 60, pceS),
    UNRATE: F('Unemployment rate', '%', 'm', 38, unS), PAYEMS: F('Non-farm payrolls', 'thousands', 'm', 38, payS),
    SAHMREALTIME: F('Sahm recession indicator', 'pts', 'm', 38, sahmS), FEDFUNDS: F('Fed funds rate (monthly average)', '%', 'm', 31, ffS),
  };

  // hourly bars around events in the last 2 years
  const intraday = { XAUUSD: {}, NAS100: {} };
  const dayIdx = new Map(gold.map((r, i) => [r[0], i]));
  for (const e of events.filter((x) => x.at < now && x.at > now - 728 * DAY)) {
    for (const [k, series, vol] of [['XAUUSD', gold, 0.0022], ['NAS100', nq, 0.003]]) {
      const i = dayIdx.get(e.date) ?? dayIdx.get(ymd(T(e.date) - DAY)); if (i == null) continue;
      let p = series[i][1]; const bars = [];
      const spike = (R.u() < 0.5 ? -1 : 1) * vol * (1.5 + 2 * R.u());
      const keep = R.u() < 0.55; // ~45% of first moves reverse
      for (let t = Math.floor((e.at - 6 * H) / H) * H; t < e.at + 10 * H; t += H) {
        const isRel = t <= e.at && e.at < t + H;
        const after = t >= e.at + H && t < e.at + 4 * H;
        const drift = isRel ? spike : after ? (keep ? spike * 0.25 : -spike * 0.55) : 0;
        const o = p, c = o * (1 + drift + vol * 0.35 * R.n());
        bars.push([t, +o.toFixed(2), +(Math.max(o, c) * (1 + vol * 0.3 * R.u())).toFixed(2), +(Math.min(o, c) * (1 - vol * 0.3 * R.u())).toFixed(2), +c.toFixed(2)]);
        p = c;
      }
      intraday[k][`${e.type}:${e.date}`] = bars;
    }
  }

  // positioning (weekly, Tuesdays)
  const goldRet13 = (t) => { const i = Math.min(gold.length - 1, Math.max(65, Math.round((t - days[0]) / DAY * 5 / 7))); return gold[i][4] / gold[i - 65][4] - 1; };
  const nqRet13 = (t) => { const i = Math.min(nq.length - 1, Math.max(65, Math.round((t - days[0]) / DAY * 5 / 7))); return nq[i][4] / nq[i - 65][4] - 1; };
  const cotG = [], cotN = [];
  for (let t = T('2010-01-05'); t <= end; t += 7 * DAY) {
    const oi = 420000 + 60000 * R.n() * 0.3, net = (0.12 + goldRet13(t) * 1.6 + 0.03 * R.n()) * oi;
    cotG.push([ymd(t), Math.round(Math.max(20000, net + 40000)), Math.round(40000), Math.round(oi)]);
    const oiN = 260000 + 20000 * R.n() * 0.3, lev = (-0.05 - nqRet13(t) * 0.6 + 0.03 * R.n()) * oiN, am = (0.1 + nqRet13(t) * 0.5 + 0.02 * R.n()) * oiN;
    cotN.push([ymd(t), Math.round(Math.max(5000, lev + 40000)), 40000, Math.round(Math.max(5000, am + 60000)), 60000, Math.round(oiN)]);
  }

  // calendar: this week and next, built around the sample schedule
  const cal = [];
  const add = (t, title, impact, forecast = '', previous = '') => cal.push({ id: `${t}-${title}`, title, currency: 'USD', date: new Date(t).toISOString(), impact, forecast, previous, actual: '' });
  const wkStart = (() => { let t = Math.floor(now / DAY) * DAY; while (new Date(t).getUTCDay() !== 0) t -= DAY; return t; })();
  for (const e of events.filter((x) => x.at >= wkStart && x.at < wkStart + 14 * DAY)) {
    if (e.type === 'CPI') { add(e.at, 'CPI m/m', 'high', '0.3%', '0.2%'); add(e.at, 'Core CPI m/m', 'high', '0.3%', '0.3%'); }
    if (e.type === 'NFP') { add(e.at, 'Non-Farm Employment Change', 'high', '55K', '64K'); add(e.at, 'Unemployment Rate', 'high', '4.5%', '4.5%'); }
    if (e.type === 'FOMC') { add(e.at, 'Federal Funds Rate', 'high', '3.50%', '3.75%'); add(e.at + 30 * 60e3, 'FOMC Press Conference', 'high'); }
  }
  for (let w = 0; w < 2; w++) {
    const b = wkStart + w * 7 * DAY;
    add(b + DAY + 15 * H, 'ISM Manufacturing PMI', 'high', '48.6', '48.3');
    add(b + 3 * DAY + 15 * H, 'ISM Services PMI', 'high', '52.1', '52.4');
    add(b + 4 * DAY + 13.5 * H, 'Unemployment Claims', 'medium', '221K', '216K');
    add(b + 2 * DAY + 13.25 * H, 'ADP Non-Farm Employment Change', 'medium', '40K', '42K');
    add(b + 5 * DAY + 15 * H, 'Prelim UoM Consumer Sentiment', 'medium', '51.0', '50.3');
  }

  const heads = [
    [2, 'Federal Reserve', 'Minutes of the Federal Open Market Committee'],
    [3, 'Sample', 'Gold rises as Treasury yields slip ahead of inflation data'],
    [5, 'Sample', 'Dollar firms after strong jobless claims; yields rise'],
    [7, 'Sample', 'Nasdaq hits record high as chip stocks rally on AI demand'],
    [9, 'Sample', 'Oil jumps after drone attack near Strait of Hormuz'],
    [12, 'Sample', 'Fed officials signal more rate cuts if inflation cools'],
    [15, 'Sample', 'Central banks bought gold for a 9th straight month'],
    [20, 'Sample', 'Tech stocks slide as Treasury yields surge on hot PPI'],
    [26, 'Sample', 'Ceasefire talks ease tensions, gold slips from highs'],
    [30, 'Sample', 'US retail sales beat expectations; consumer spending holds up'],
    [38, 'Sample', 'New tariff threats rattle markets; gold climbs'],
    [44, 'Sample', 'Jobless claims rise to highest since August'],
  ];
  const headlines = heads.map(([h, source, title]) => ({ title, link: source === 'Federal Reserve' ? 'https://www.federalreserve.gov/newsevents.htm' : null, source, at: now - h * H }));

  const ok = { ok: true, at: now };
  return {
    updatedAt: new Date(now).toISOString(), demo: true, fred, fredMissing: [],
    prices: { XAUUSD: { name: 'Gold futures', source: 'Sample data', daily: gold }, NAS100: { name: 'Nasdaq 100 futures', source: 'Sample data', daily: nq } },
    intraday, events,
    cot: {
      XAUUSD: { group: 'Managed money (hedge funds)', fields: ['m_money_positions_long_all', 'm_money_positions_short_all', 'open_interest_all'], rows: cotG },
      NAS100: { group: 'Leveraged funds and asset managers', fields: ['lev_money_positions_long', 'lev_money_positions_short', 'asset_mgr_positions_long', 'asset_mgr_positions_short', 'open_interest_all'], rows: cotN },
    },
    calendar: cal.sort((a, b) => a.date.localeCompare(b.date)), headlines,
    status: { fred: ok, prices: ok, intraday: ok, cot: ok, calendar: ok, headlines: ok },
  };
}
