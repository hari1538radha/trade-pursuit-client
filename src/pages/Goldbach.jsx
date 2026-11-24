import { useEffect, useMemo, useRef, useState } from 'react';
import { Gem, RefreshCw, Info } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Seg, Reveal } from '../components/ui.jsx';
import { PO3, INSTRUMENTS, autoPo3, goldbach } from '../lib/goldbach.js';
import { cls } from '../lib/format.js';
import Board from '../components/Board.jsx';

const ZONE_COLOR = { premium: '#f0616d', discount: '#2fbf8f', eq: '#a78bfa', edge: 'var(--text)' };
const KEY_COLOR = { rb: '#f59e0b', ob: '#3b82f6', fvg: '#a78bfa', lv: '#94a3b8', br: '#ec4899', mb: '#14b8a6', eq: '#a78bfa', high: 'var(--text)', low: 'var(--text)' };

/** Candles + labelled Goldbach lines, drawn as SVG so every label stays readable */
function LevelChart({ candles, gb, outer, price, digits, height: hProp = 560 }) {
  const wrap = useRef(null);
  const [w, setW] = useState(900);
  const height = w < 640 ? 420 : hProp;
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const small = w < 640;
  const padR = small ? 132 : 220, padL = small ? 4 : 12, padT = 14, padB = 30;
  const shown = candles.slice(-Math.max(small ? 30 : 40, Math.floor((w - padR) / (small ? 5 : 7))));
  // Keep the dealing range filling the chart so every level is readable; price far outside is clipped
  const span = gb.high - gb.low;
  const y0 = Math.max(gb.low - span * 0.35, Math.min(...shown.map((c) => c.l)) - span * 0.03);
  const y1 = Math.min(gb.high + span * 0.35, Math.max(...shown.map((c) => c.h)) + span * 0.03);
  const Y = (v) => padT + (1 - (v - y0) / (y1 - y0)) * (height - padT - padB);
  const cw = (w - padR - padL) / Math.max(1, shown.length);
  const X = (i) => padL + i * cw + cw / 2;
  // Stagger labels that would overlap
  let lastY = padT - 10;
  const labels = gb.levels.filter((l) => l.price >= y0 && l.price <= y1).sort((a, b) => b.price - a.price).map((l) => { let y = Y(l.price); if (y - lastY < 15) y = lastY + 15; lastY = y; return { ...l, ly: y }; });
  const fmt = (v) => v.toFixed(digits);
  const t0 = shown[0]?.t, t1 = shown.at(-1)?.t;
  const day = (t) => new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div ref={wrap} style={{ width: '100%' }}>
      <svg width={w} height={height} role="img" aria-label="Price with Goldbach levels">
        {/* premium / discount shading */}
        <rect x={padL} width={w - padR - padL} y={Y(gb.high)} height={Math.max(0, Y(gb.low + gb.sizePrice / 2) - Y(gb.high))} fill="#f0616d" opacity={0.05} />
        <rect x={padL} width={w - padR - padL} y={Y(gb.low + gb.sizePrice / 2)} height={Math.max(0, Y(gb.low) - Y(gb.low + gb.sizePrice / 2))} fill="#2fbf8f" opacity={0.05} />
        {outer && [outer.low, outer.high].map((v, i) => v >= y0 && v <= y1 && (
          <g key={'o' + i}><line x1={padL} x2={w - padR} y1={Y(v)} y2={Y(v)} stroke="var(--text2)" strokeDasharray="2 6" /><text x={padL + 4} y={Y(v) - 4} fontSize="11" fill="var(--text2)">Higher range {i ? 'high' : 'low'} {fmt(v)}</text></g>
        ))}
        {gb.levels.map((l) => (
          <line key={l.p} x1={padL} x2={w - padR} y1={Y(l.price)} y2={Y(l.price)} stroke={KEY_COLOR[l.key]} strokeWidth={l.key === 'high' || l.key === 'low' ? 2 : l.key === 'eq' ? 1.6 : 1.1} strokeDasharray={l.key === 'lv' || l.key === 'mb' ? '5 5' : l.key === 'eq' ? '8 4' : undefined} opacity={0.9} />
        ))}
        <clipPath id="gbclip"><rect x={padL} y={padT} width={w - padR - padL} height={height - padT - padB} /></clipPath>
        <g clipPath="url(#gbclip)">
        {shown.map((c, i) => {
          const up = c.c >= c.o;
          const col = up ? '#2fbf8f' : '#f0616d';
          return (
            <g key={c.t}>
              <line x1={X(i)} x2={X(i)} y1={Y(c.h)} y2={Y(c.l)} stroke={col} strokeWidth={1} />
              <rect x={X(i) - Math.max(1, cw * 0.32)} width={Math.max(2, cw * 0.64)} y={Y(Math.max(c.o, c.c))} height={Math.max(1, Math.abs(Y(c.o) - Y(c.c)))} fill={col} />
            </g>
          );
        })}
        </g>
        {price != null && (
          <g>
            <line x1={padL} x2={w - padR} y1={Y(price)} y2={Y(price)} stroke="var(--text)" strokeWidth={1} strokeDasharray="2 3" />
            <rect x={small ? w - padR - 72 : w - padR + 4} y={Y(price) - 10} width={small ? 70 : 88} height={20} rx={5} fill="var(--text)" />
            <text x={small ? w - padR - 37 : w - padR + 48} y={Y(price) + 4} textAnchor="middle" fontSize={small ? 11 : 12} fontWeight="700" fill="var(--bg)">{fmt(price)}</text>
          </g>
        )}
        {labels.map((l) => (
          <g key={'l' + l.p}>
            <line x1={w - padR} x2={w - padR + (small ? 16 : 96)} y1={Y(l.price)} y2={l.ly} stroke={KEY_COLOR[l.key]} opacity={0.4} />
            <text x={w - padR + (small ? 18 : 98)} y={l.ly + 4} fontSize={small ? 11 : 12.5} fill={KEY_COLOR[l.key]} fontWeight={l.key === 'ob' || l.key === 'rb' || l.key === 'eq' ? 700 : 500}>{l.short} · {fmt(l.price)}</text>
          </g>
        ))}
        {t0 && <text x={padL} y={height - 8} fontSize="11.5" fill="var(--text2)">{day(t0)}</text>}
        {t1 && <text x={w - padR} y={height - 8} fontSize="11.5" fill="var(--text2)" textAnchor="end">{day(t1)}</text>}
      </svg>
    </div>
  );
}

export default function Goldbach() {
  const { api } = useApp();
  const [symbol, setSymbol] = useState(() => localStorage.getItem('tp.gb.sym') || 'XAUUSD');
  const [interval, setInterval_] = useState(() => localStorage.getItem('tp.gb.int') || '1h');
  const [size, setSize] = useState('auto');
  const [override, setOverride] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const inst = INSTRUMENTS[symbol];

  const load = () => {
    setLoading(true); setErr('');
    api.markets.goldbach(symbol, interval).then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { localStorage.setItem('tp.gb.sym', symbol); localStorage.setItem('tp.gb.int', interval); setData(null); load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [symbol, interval]); // eslint-disable-line

  // Your broker's price can differ a little from ours: type it to shift everything to match
  const shift = override && data?.price ? +override - data.price : 0;
  const price = data?.price != null ? data.price + shift : null;
  const candles = useMemo(() => (data?.candles || []).map((c) => ({ ...c, o: c.o + shift, h: c.h + shift, l: c.l + shift, c: c.c + shift })), [data, shift]);
  const auto = autoPo3(data?.adr ? data.adr * inst.unit : null);
  const po3 = size === 'auto' ? auto : +size;
  const gb = price != null ? goldbach(price, po3, inst.unit) : null;
  const higher = price != null && po3 * 3 <= PO3.at(-1) ? goldbach(price, po3 * 3, inst.unit) : null;
  const lower = price != null && po3 / 3 >= 3 ? goldbach(price, po3 / 3, inst.unit) : null;
  const fmt = (v) => (v == null ? '—' : v.toFixed(inst.digits));

  return (
    <Board id="goldbach" className="page wide-page">
      <div data-fixed className="page-head row between wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }} className="row"><Gem size={22} /> Goldbach levels</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Power-of-3 dealing ranges and Goldbach levels for gold and silver. {data && <span className="tag">{data.source}</span>}</div>
        </div>
        <button className="btn sm" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh</button>
      </div>

      <div className="card row wrap" style={{ marginTop: 16, padding: 10, gap: 12 }}>
        <Seg options={[{ value: 'XAUUSD', label: 'Gold · XAUUSD' }, { value: 'XAGUSD', label: 'Silver · XAGUSD' }]} value={symbol} onChange={(v) => { setSymbol(v); setOverride(''); setSize('auto'); }} />
        <Seg options={['15m', '1h', '4h', '1d']} value={interval} onChange={setInterval_} />
        <span className="grow" />
        <label className="row muted" style={{ gap: 6, fontSize: 13 }}>PO3 range
          <select className="select" style={{ width: 150, padding: '8px 12px' }} value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="auto">Auto ({auto})</option>
            {PO3.map((s) => <option key={s} value={s}>{s} ({(s / inst.unit).toLocaleString('en-US')} {inst.unit === 1 ? '$' : '$ of silver'})</option>)}
          </select>
        </label>
        <label className="row muted" style={{ gap: 6, fontSize: 13 }} title="Your broker's current price. Levels follow your price.">Your price
          <input className="input mono" style={{ width: 120, padding: '8px 10px' }} placeholder={fmt(data?.price)} value={override} onChange={(e) => setOverride(e.target.value.replace(/[^0-9.]/g, ''))} />
        </label>
      </div>
      {err && <p className="neg" style={{ marginTop: 12 }}>{err}</p>}

      {gb && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginTop: 16 }}>
            {[
              [`${inst.name} price`, fmt(price), data.basis ? `futures ${fmt(data.futures)} · basis ${data.basis > 0 ? '+' : ''}${data.basis}` : ''],
              ['Dealing range', `${fmt(gb.low)} → ${fmt(gb.high)}`, `PO3 ${po3} = ${(gb.sizePrice).toLocaleString('en-US')} ${inst.unit === 1 ? 'dollars' : 'dollars'} · ${size === 'auto' ? 'auto from avg daily range' : 'manual'}`],
              ['Where price is', `${gb.pct.toFixed(1)}% of range`, gb.zone === 'premium' ? 'Premium: sellers\' side' : gb.zone === 'discount' ? 'Discount: buyers\' side' : 'At equilibrium', ZONE_COLOR[gb.zone]],
              ['Next level up', gb.above ? `${gb.above.short} · ${fmt(gb.above.price)}` : 'Range high broken', gb.above ? `${fmt(gb.above.price - price)} away` : ''],
              ['Next level down', gb.below ? `${gb.below.short} · ${fmt(gb.below.price)}` : '—', gb.below ? `${fmt(price - gb.below.price)} away` : ''],
              ['Avg daily range', data.adr ? fmt(data.adr) : '—', data.adr ? `= ${Math.round(data.adr * inst.unit)} units · picks PO3 ${auto}` : ''],
            ].map(([l, v, sub, color]) => (
              <Reveal key={l} className="card stat" style={{ padding: 16 }}>
                <div className="label">{l}</div>
                <div className="val" style={{ fontSize: 21, marginTop: 10, color }}>{v}</div>
                {sub && <div className="foot" style={{ fontSize: 12.5 }}>{sub}</div>}
              </Reveal>
            ))}
          </div>

          <Reveal className="card" style={{ marginTop: 16 }}>
            <div className="row between wrap" style={{ gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17 }}>{inst.name} {interval} with Goldbach levels</h3>
                <div className="sub" style={{ marginTop: 4, fontSize: 13 }}>Red tint = premium (above 50%), green tint = discount (below 50%). Dotted grey = edges of the next range up (PO3 {po3 * 3}). Candles far outside the range are cut off so the levels stay readable.</div>
              </div>
              <div className="row wrap" style={{ gap: 10, fontSize: 12.5 }}>
                {[['rb', 'Rejection 3/97'], ['ob', 'Order block 11/89'], ['fvg', 'FVG 17/83'], ['lv', 'Liq. void 29/71'], ['br', 'Breaker 41/59'], ['mb', 'Mitigation 47/53'], ['eq', 'Equilibrium 50']].map(([k, l]) => (
                  <span key={k} className="row" style={{ gap: 5 }}><span style={{ width: 14, height: 3, background: KEY_COLOR[k], borderRadius: 2 }} />{l}</span>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <LevelChart candles={candles} gb={gb} outer={higher} price={price} digits={inst.digits} />
            </div>
          </Reveal>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,560px),1fr))' }}>
            <Reveal className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px 6px' }}><h3 style={{ margin: 0, fontSize: 17 }}>Levels in the {po3} range</h3><div className="sub" style={{ fontSize: 13, marginTop: 4 }}>What each level tends to do, and how far price is from it.</div></div>
              <table className="tbl gb-tbl">
                <thead><tr><th>%</th><th>Level</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Distance</th><th>What it means</th></tr></thead>
                <tbody>
                  {gb.levels.map((l) => {
                    const d = l.price - price;
                    const isNext = l === gb.above || l === gb.below;
                    return (
                      <tr key={l.p} className={cls(isNext && 'gb-next')}>
                        <td className="mono">{l.p}</td>
                        <td><span style={{ color: KEY_COLOR[l.key], fontWeight: 700 }}>{l.name}</span> <span className="dim" style={{ fontSize: 12 }}>{l.zone !== 'edge' && l.zone !== 'eq' ? l.zone : ''}</span></td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(l.price)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: d > 0 ? 'var(--green)' : 'var(--red)' }}>{d > 0 ? '+' : ''}{fmt(d)}</td>
                        <td className="muted" style={{ fontSize: 13 }}>{l.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Reveal>
            <div className="col" style={{ gap: 0 }}>
              {[[`Higher range (PO3 ${po3 * 3})`, higher, 'Use for bias: are we in its premium or discount?'], [`Lower range (PO3 ${po3 / 3})`, lower, 'Use for entries inside the main range.']].map(([title, r, hint]) => r && (
                <Reveal key={title} className="card" style={{ marginTop: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
                  <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>{hint}</div>
                  <div className="row wrap" style={{ gap: 14, marginTop: 10, fontSize: 14 }}>
                    <span>Range <b className="mono">{fmt(r.low)} → {fmt(r.high)}</b></span>
                    <span>Price at <b style={{ color: ZONE_COLOR[r.zone] }}>{r.pct.toFixed(1)}% ({r.zone})</b></span>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                    {r.levels.filter((l) => ['rb', 'ob', 'eq', 'fvg'].includes(l.key)).map((l) => <span key={l.p} className="tag mono" style={{ fontSize: 12.5, color: KEY_COLOR[l.key] }}>{l.short} {fmt(l.price)}</span>)}
                  </div>
                </Reveal>
              ))}
              <Reveal className="card" style={{ marginTop: 16 }}>
                <h3 className="row" style={{ margin: 0, fontSize: 16 }}><Info size={16} /> How to read it</h3>
                <ul className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: '8px 0 0', paddingLeft: 18 }}>
                  <li>Price trades inside a power-of-3 dealing range (3, 9, 27, 81, 243, 729…), moving from the low to the high and back.</li>
                  <li>The range low is the price rounded down to a multiple of the range size. Gold is counted in dollars, silver in cents.</li>
                  <li>Below 50% is discount (look for buys at OB 11 / RB 3); above 50% is premium (look for sells at OB 89 / RB 97).</li>
                  <li>Liquidity voids (17→29, 71→83) are where price runs: trade with the move there, not against it.</li>
                  <li>When price leaves the range, the next range of the same size takes over.</li>
                </ul>
                <p className="dim" style={{ fontSize: 12, marginBottom: 0 }}>Based on Hopiplaka's Goldbach / PO3 framework. Levels are a map, not signals: confirm with your own setup and risk rules.</p>
              </Reveal>
            </div>
          </div>
        </>
      )}
    </Board>
  );
}
