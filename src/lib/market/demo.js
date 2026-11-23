// Sample market data for the hosted preview only (never used against the real API).
import { analyze } from './scanner.js';
import { normalizeChain, chainStats } from './options.js';

const SPEC = {
  'NSE_INDEX|Nifty 50': { spot: 26050, step: 50, lot: 75 },
  'NSE_INDEX|Nifty Bank': { spot: 59200, step: 100, lot: 35 },
  'NSE_INDEX|Nifty Fin Service': { spot: 27600, step: 50, lot: 65 },
  'NSE_INDEX|NIFTY MID SELECT': { spot: 13520, step: 25, lot: 140 },
  'BSE_INDEX|SENSEX': { spot: 85300, step: 100, lot: 20 },
};
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 7;
const ncdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
const npdf = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);

function bs(S, K, T, iv, call) {
  const s = iv / 100, sq = Math.sqrt(T), d1 = (Math.log(S / K) + 0.5 * s * s * T) / (s * sq), d2 = d1 - s * sq;
  const price = call ? S * ncdf(d1) - K * ncdf(d2) : K * ncdf(-d2) - S * ncdf(-d1);
  return { price: Math.max(price, 0.05), delta: call ? ncdf(d1) : ncdf(d1) - 1, gamma: npdf(d1) / (S * s * sq), theta: (-S * npdf(d1) * s / (2 * sq)) / 365, vega: S * npdf(d1) * sq / 100 };
}

export function expiriesFor(key) {
  const out = [], d = new Date();
  const weekly = key === 'NSE_INDEX|Nifty 50' || key === 'BSE_INDEX|SENSEX';
  for (let i = 1; out.length < (weekly ? 5 : 3) && i < 120; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    const lastTue = x.getDay() === 2 && new Date(x.getFullYear(), x.getMonth(), x.getDate() + 7).getMonth() !== x.getMonth();
    if (weekly ? x.getDay() === 2 : lastTue) out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
  }
  return out;
}

/** Raw rows in a put/call chain format; `drift` 0..1 moves the market through the day */
export function rawChain(key, expiry, drift = 1, stockSpot) {
  const spec = SPEC[key] || { spot: stockSpot || 1500, step: (stockSpot || 1500) > 2000 ? 20 : 10, lot: 500 };
  const r = rng(hash(key + expiry));
  const spot = spec.spot * (1 + (drift - 0.5) * 0.006);
  const atm = Math.round(spot / spec.step) * spec.step;
  const T = Math.max((new Date(expiry) - Date.now()) / (365 * 86400000), 1 / 365);
  const rows = [];
  for (let i = -20; i <= 20; i++) {
    const K = atm + i * spec.step;
    const dist = i * spec.step / spec.step;
    const ceBase = (4e6 + 9e6 * Math.exp(-((dist - 4) ** 2) / 18)) * (0.7 + r() * 0.6) * (key.startsWith('NSE_EQ') ? 0.02 : 1);
    const peBase = (4e6 + 8e6 * Math.exp(-((dist + 4) ** 2) / 18)) * (0.7 + r() * 0.6) * (key.startsWith('NSE_EQ') ? 0.02 : 1);
    const ceChg = ceBase * (0.05 + r() * 0.35) * (dist > 0 ? 1 : -0.4) * drift;
    const peChg = peBase * (0.05 + r() * 0.35) * (dist < 0 ? 1 : -0.4) * drift;
    const iv = 11 + Math.abs(dist) * 0.25 + r() * 1.5;
    const side = (call, oi, chg) => {
      const g = bs(spot, K, T, iv, call), close = g.price * (1 + (r() - 0.5) * 0.3);
      return { instrument_key: `NSE_FO|${hash(K + expiry + call)}`, market_data: { ltp: +g.price.toFixed(2), close_price: +close.toFixed(2), volume: Math.round(oi * (0.5 + r() * 3)), oi: Math.round(oi + chg), prev_oi: Math.round(oi), bid_price: +(g.price - 0.1).toFixed(2), ask_price: +(g.price + 0.1).toFixed(2) }, option_greeks: { iv: +iv.toFixed(2), delta: +g.delta.toFixed(3), gamma: +g.gamma.toFixed(5), theta: +g.theta.toFixed(2), vega: +g.vega.toFixed(2), pop: Math.round((call ? 1 - g.delta : 1 + g.delta) * 100) } };
    };
    rows.push({ expiry, strike_price: K, underlying_key: key, underlying_spot_price: +spot.toFixed(2), pcr: 0, call_options: side(true, ceBase, ceChg), put_options: side(false, peBase, peChg) });
  }
  return { rows, lot: spec.lot };
}

export function demoHistory(key, expiry, stockSpot) {
  const snaps = [];
  const now = new Date(), start = new Date(now); start.setHours(9, 15, 0, 0);
  const end = now.getHours() * 60 + now.getMinutes() < 9 * 60 + 30 ? new Date(now.getTime() + 6.25 * 3600000) : now;
  const steps = Math.max(8, Math.min(25, Math.round((end - start) / (15 * 60000))));
  for (let i = 0; i <= steps; i++) {
    const drift = i / steps;
    const ch = normalizeChain(rawChain(key, expiry, drift + Math.sin(i / 2) * 0.05, stockSpot).rows);
    const st = chainStats(ch);
    const k = ch.findIndex((x) => x.strike === st.atm);
    snaps.push({ at: new Date(start.getTime() + (i * (end - start)) / steps).toISOString(), spot: st.spot, pcr: st.pcr, ceOI: st.ceOI, peOI: st.peOI, ceChg: st.ceChg, peChg: st.peChg, maxPain: st.maxPain, atmIv: st.atmIv, strikes: ch.slice(Math.max(0, k - 12), k + 13).map((x) => [x.strike, x.ce.oi, x.pe.oi, x.ce.chgOi, x.pe.chgOi]) });
  }
  return snaps;
}

// ---------- stocks ----------
const NAMES = 'RELIANCE,TCS,HDFCBANK,ICICIBANK,INFY,BHARTIARTL,ITC,SBIN,LT,HINDUNILVR,KOTAKBANK,AXISBANK,BAJFINANCE,MARUTI,SUNPHARMA,TITAN,ASIANPAINT,ULTRACEMCO,NTPC,POWERGRID,TATAMOTORS,TATASTEEL,M&M,HCLTECH,WIPRO,ONGC,COALINDIA,ADANIENT,ADANIPORTS,JSWSTEEL,GRASIM,NESTLEIND,TECHM,BAJAJFINSV,HINDALCO,DIVISLAB,DRREDDY,CIPLA,EICHERMOT,HEROMOTOCO,BPCL,BRITANNIA,APOLLOHOSP,TATACONSUM,SBILIFE,HDFCLIFE,INDUSINDBK,DLF,PIDILITIND,SIEMENS,HAL,BEL,TRENT,ZOMATO,IRCTC,VEDL,TVSMOTOR,GODREJCP,DABUR,BANKBARODA,PNB,CANBK,IOC,GAIL,AMBUJACEM,SHREECEM,LUPIN,AUROPHARMA,BIOCON,MPHASIS,PERSISTENT,COFORGE,LTIM,NAUKRI,POLYCAB,HAVELLS,VOLTAS,ABB,CUMMINSIND,BHEL,SAIL,NMDC,RECLTD,PFC,IRFC,IDFCFIRSTB,FEDERALBNK,AUBANK,BANDHANBNK,CHOLAFIN,MUTHOOTFIN,SRF,PIIND,UPL,TATAPOWER,ADANIGREEN,JINDALSTEL,MOTHERSON,BOSCHLTD,MRF,BALKRISIND,ESCORTS,ASHOKLEY,INDIGO,PAGEIND,COLPAL,MARICO,BERGEPAINT,JUBLFOOD,DMART'.split(',');

let stockCache = null;
export function demoStocks() {
  if (stockCache) return stockCache;
  const series = [], results = [];
  const days = [];
  for (let d = new Date(), k = 0; days.length < 300; k++) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1 - k); if (x.getDay() && x.getDay() !== 6) days.unshift(x.toISOString().slice(0, 10)); }
  NAMES.forEach((sym, idx) => {
    const r = rng(hash(sym));
    let p = 80 + r() * 3000;
    const s = { symbol: sym, name: `${sym} LTD`, isin: `INE${String(100000 + idx).slice(1)}A01011`, series: 'EQ', d: days.slice(), o: [], h: [], l: [], c: [], v: [], val: [] };
    const mode = idx % 7; // plant a variety of setups
    const vol0 = 2e5 + r() * 4e6;
    for (let i = 0; i < 300; i++) {
      const trend = mode === 0 ? 0.0018 : mode === 1 ? -0.0016 : mode === 2 ? Math.sin(i / 25) * 0.004 : 0.0003;
      const o = p * (1 + (r() - 0.5) * 0.01);
      p = Math.max(5, p * (1 + trend + (r() - 0.5) * 0.028));
      if (i === 299 && mode === 3) p *= 1.06; // breakout day
      if (i === 299 && mode === 4) p *= 0.94;
      const hi = Math.max(o, p) * (1 + r() * 0.012), lo = Math.min(o, p) * (1 - r() * 0.012);
      const v = vol0 * (0.5 + r()) * (i === 299 && (mode === 3 || mode === 4) ? 3.4 : 1);
      s.o.push(+o.toFixed(2)); s.h.push(+hi.toFixed(2)); s.l.push(+lo.toFixed(2)); s.c.push(+p.toFixed(2)); s.v.push(Math.round(v)); s.val.push(Math.round(v * p));
    }
    series.push(s);
    const a = analyze(s);
    if (a) results.push({ symbol: sym, name: s.name, isin: s.isin, series: 'EQ', ...a });
  });
  results.sort((a, b) => b.turnoverCr - a.turnoverCr);
  stockCache = { series: new Map(series.map((s) => [s.symbol, s])), results, lastDate: days.at(-1) };
  return stockCache;
}
