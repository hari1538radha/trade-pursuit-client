// Weekly / monthly performance report as a PDF (drawn with jsPDF, no screenshots).
import { jsPDF } from 'jspdf';
import { real, summary, groupBy, cumulative, byWeekday, tradeScore } from './stats.js';
import { improvementPlan, avoidList } from './coach.js';
import { parseYmd, ymd, addDays, weekStart, WEEKDAYS } from './dates.js';

// ---------- periods ----------
export function periodsFor(kind, count = 8) {
  const out = [];
  if (kind === 'week') {
    let s = weekStart();
    for (let i = 0; i < count; i++) { out.push({ kind, from: s, to: addDays(s, 6), label: `Week of ${fmtD(s)}` }); s = addDays(s, -7); }
  } else {
    const d = new Date(); d.setDate(1);
    for (let i = 0; i < count; i++) {
      const from = ymd(d); const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      out.push({ kind, from, to: ymd(end), label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
      d.setMonth(d.getMonth() - 1);
    }
  }
  return out;
}
const fmtD = (s) => parseYmd(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const inRange = (t, p) => t.date >= p.from && t.date <= p.to;
const prevPeriod = (p) => {
  if (p.kind === 'week') return { ...p, from: addDays(p.from, -7), to: addDays(p.to, -7) };
  const d = parseYmd(p.from); d.setMonth(d.getMonth() - 1);
  return { ...p, from: ymd(d), to: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
};

// ---------- text helpers (built-in PDF fonts are Latin-1 only) ----------
const clean = (s) => String(s ?? '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[−–—]/g, '-').replace(/…/g, '...').replace(/×/g, 'x').replace(/•/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
const money = (n, cents = false) => `${n < 0 ? '-' : n > 0 ? '+' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;

const C = { ink: [20, 20, 24], muted: [110, 110, 120], line: [225, 225, 232], green: [22, 163, 74], red: [220, 38, 38], accent: [91, 63, 214], soft: [246, 246, 249], gold: [202, 138, 4] };

export function buildReport({ trades, period, user, be = 0, mode = 'live' }) {
  const all = real(trades);
  const ts = all.filter((t) => inRange(t, period)).sort((a, b) => (a.date + (a.entryTime || '')).localeCompare(b.date + (b.entryTime || '')));
  const prev = all.filter((t) => inRange(t, prevPeriod(period)));
  const s = summary(ts, be), ps = summary(prev, be);
  const plan = improvementPlan(ts, { be });
  const prevPlan = improvementPlan(prev, { be });
  const avoid = avoidList(all.filter((t) => t.date <= period.to), { be }).filter((x) => x.source === 'data');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
  let y = 0;
  const color = (c) => doc.setTextColor(...c);
  const font = (size, style = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size); };
  const text = (str, x, yy, opts) => doc.text(clean(str), x, yy, opts);
  const footer = () => {
    font(8); color(C.muted);
    text(`Trade Pursuit  |  ${period.kind === 'week' ? 'Weekly' : 'Monthly'} report  |  ${period.label}`, M, H - 20);
    text(`Page ${doc.getNumberOfPages()}`, W - M, H - 20, { align: 'right' });
  };
  const newPage = () => { footer(); doc.addPage(); y = M; };
  const need = (h) => { if (y + h > H - 50) newPage(); };
  const h2 = (t) => { need(40); font(14, 'bold'); color(C.ink); text(t, M, y + 14); y += 26; };
  const para = (t, size = 10, c = C.muted) => {
    font(size); color(c);
    const lines = doc.splitTextToSize(clean(t), W - 2 * M);
    need(lines.length * (size + 3)); doc.text(lines, M, y + size); y += lines.length * (size + 3) + 4;
  };

  // ---------- header ----------
  doc.setFillColor(12, 12, 14); doc.rect(0, 0, W, 96, 'F');
  doc.setFillColor(244, 244, 245); doc.roundedRect(M, 30, 30, 30, 8, 8, 'F');
  doc.setDrawColor(12, 12, 14); doc.setLineWidth(2.6); doc.lines([[6, -7], [5, 4], [8, -10]], M + 7, 52);
  font(18, 'bold'); doc.setTextColor(255, 255, 255); text('Trade Pursuit', M + 42, 51);
  font(10); doc.setTextColor(170, 170, 180);
  text(`${period.kind === 'week' ? 'Weekly' : 'Monthly'} performance report  -  ${period.label} (${fmtD(period.from)} to ${fmtD(period.to)})`, M, 80);
  text(`${user?.displayName || ''}${mode === 'paper' ? '  -  Paper money' : ''}`, W - M, 51, { align: 'right' });
  y = 120;

  if (!ts.length) {
    font(16, 'bold'); color(C.ink); text('No trades in this period.', M, y + 10); y += 30;
    para('Pick another week or month, or log trades for this one.');
    footer();
    return doc;
  }

  // ---------- KPI tiles ----------
  const tiles = [
    ['Net P&L', money(s.total, true), s.total >= 0 ? C.green : C.red, delta(s.total - ps.total, ps.count, (v) => money(v))],
    ['Trades', String(s.count), C.ink, delta(s.count - ps.count, ps.count, (v) => `${v > 0 ? '+' : ''}${v}`)],
    ['Win rate', `${s.winRate.toFixed(1)}%`, C.ink, delta(s.winRate - ps.winRate, ps.count, (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} pts`)],
    ['Profit factor', Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : 'n/a', C.ink, ''],
    ['Avg win / loss', `${money(s.avgWin)} / ${money(-s.avgLoss)}`, C.ink, ''],
    ['Expectancy', `${money(s.expectancy)} / trade`, s.expectancy >= 0 ? C.green : C.red, ''],
    ['Discipline score', `${plan.discipline}/100`, plan.discipline >= 70 ? C.green : plan.discipline >= 50 ? C.gold : C.red, delta(plan.discipline - prevPlan.discipline, ps.count, (v) => `${v > 0 ? '+' : ''}${v}`)],
    ['On-plan trades', `${plan.planRate.toFixed(0)}%`, plan.planRate >= 90 ? C.green : C.gold, ''],
  ];
  const tw = (W - 2 * M - 3 * 10) / 4, th = 58;
  tiles.forEach(([label, val, c, d], i) => {
    const x = M + (i % 4) * (tw + 10), yy = y + Math.floor(i / 4) * (th + 10);
    doc.setFillColor(...C.soft); doc.roundedRect(x, yy, tw, th, 8, 8, 'F');
    font(8); color(C.muted); text(label.toUpperCase(), x + 10, yy + 16);
    font(label === 'Avg win / loss' ? 11 : 15, 'bold'); color(c); text(val, x + 10, yy + 37);
    if (d) { font(7.5); color(C.muted); text(d, x + 10, yy + 50); }
  });
  y += 2 * (th + 10) + 10;

  // ---------- equity curve + daily bars ----------
  h2('Equity curve and daily P&L');
  const cum = cumulative(ts);
  lineChart(doc, M, y, W - 2 * M, 150, cum.map((d) => ({ label: d.date.slice(5), v: d.cum })));
  y += 186;
  font(10, 'bold'); color(C.ink); text('Daily P&L', M, y - 6); y += 8;
  const days = cum.map((d) => ({ label: d.date.slice(5), v: d.pnl }));
  barChart(doc, M, y, W - 2 * M, 120, days);
  y += 138;

  // ---------- what to improve ----------
  newPage();
  h2('What needs to improve');
  plan.focus.forEach((f, i) => {
    need(46);
    doc.setFillColor(254, 242, 242); doc.roundedRect(M, y, W - 2 * M, 40, 6, 6, 'F');
    font(11, 'bold'); color(C.red); text(`${i + 1}.  ${f.title}`, M + 10, y + 16);
    font(9); color(C.muted); text(doc.splitTextToSize(clean(f.detail), W - 2 * M - 30)[0], M + 24, y + 31);
    y += 48;
  });
  if (avoid.length) {
    y += 4; font(10, 'bold'); color(C.ink); text("Don't do this next period (from your whole journal)", M, y + 10); y += 18;
    avoid.slice(0, 5).forEach((a) => para(`-  ${a.text}: ${a.why}`, 9.5, C.ink));
  }
  if (plan.strengths.length) {
    y += 6; h2('What is working (keep doing it)');
    plan.strengths.forEach((st) => {
      need(30); font(10.5, 'bold'); color(C.green); text(`+  ${st.text}`, M, y + 10);
      font(9); color(C.muted); text(st.why, M + 14, y + 23); y += 32;
    });
  }

  // ---------- breakdowns ----------
  h2('Where the money came from');
  const half = (W - 2 * M - 16) / 2;
  const setups = groupBy(ts, (t) => t.playbook, be).sort((a, b) => b.pnl - a.pnl).slice(0, 7);
  const sessions = groupBy(ts, (t) => (t.session && t.session !== 'No session' ? t.session : null), be).sort((a, b) => b.pnl - a.pnl);
  need(30 + Math.max(setups.length, sessions.length, 1) * 20);
  const y0 = y;
  const h1 = table(doc, M, y0, half, 'By setup', setups);
  const h2b = table(doc, M + half + 16, y0, half, 'By session', sessions);
  y = y0 + Math.max(h1, h2b) + 16;

  need(40 + 5 * 22);
  h2('By weekday');
  hbarChart(doc, M, y, W - 2 * M, byWeekday(ts, be).map((d) => ({ label: d.key, v: d.pnl, sub: `${d.count} trades` })));
  y += 5 * 22 + 12;

  const emos = groupBy(ts, (t) => [...(t.emotionsNeg || []).map((e) => `- ${e}`), ...(t.emotionsPos || []).map((e) => `+ ${e}`)], be).sort((a, b) => a.pnl - b.pnl);
  if (emos.length) {
    need(40 + Math.min(emos.length, 10) * 22);
    h2('Emotions and their cost');
    hbarChart(doc, M, y, W - 2 * M, emos.slice(0, 10).map((d) => ({ label: d.key, v: d.pnl, sub: `${d.count} trades` })));
    y += Math.min(emos.length, 10) * 22 + 12;
  }

  // ---------- trade list ----------
  newPage();
  h2(`All trades (${ts.length})`);
  const cols = [['Date', 62], ['Symbol', 62], ['Side', 40], ['Session', 56], ['Setup', 92], ['Grade', 38], ['Plan', 34], ['R', 36], ['Score', 38], ['P&L', 57]];
  const head = () => {
    doc.setFillColor(...C.soft); doc.rect(M, y, W - 2 * M, 18, 'F');
    font(8, 'bold'); color(C.muted); let x = M + 6;
    cols.forEach(([c, w], i) => { text(c, i === cols.length - 1 ? x + w - 8 : x, y + 12, i === cols.length - 1 ? { align: 'right' } : undefined); x += w; });
    y += 32;
  };
  head();
  ts.forEach((t) => {
    if (y > H - 60) { newPage(); head(); }
    const row = [fmtD(t.date).replace(/, \d{4}/, ''), t.symbol || '-', t.direction === 'short' ? 'Short' : 'Long', t.session || '', t.playbook || '', t.grade || '', t.followedPlan === false ? 'No' : 'Yes', Number.isFinite(t.realizedRR) ? `${t.realizedRR}R` : '', String(tradeScore(t).score), money(t.pnl || 0, true)];
    font(8.5); let x = M + 6;
    row.forEach((v, i) => {
      if (i === cols.length - 1) { color((t.pnl || 0) >= 0 ? C.green : C.red); text(v, x + cols[i][1] - 8, y, { align: 'right' }); }
      else { color(i === 6 && v === 'No' ? C.red : C.ink); text(doc.splitTextToSize(clean(v), cols[i][1] - 4)[0] || '', x, y); }
      x += cols[i][1];
    });
    doc.setDrawColor(...C.line); doc.setLineWidth(0.4); doc.line(M, y + 5, W - M, y + 5);
    y += 16;
  });
  footer();
  return doc;
}

function delta(v, prevCount, f) {
  if (!prevCount || !Number.isFinite(v) || v === 0) return prevCount ? 'same as last period' : '';
  return `${f(v)} vs last period`;
}

// ---------- charts ----------
function axes(doc, x, y, w, h, min, max) {
  doc.setDrawColor(...C.line); doc.setLineWidth(0.5);
  const ticks = 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.muted);
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) * i) / ticks, yy = y + h - (h * i) / ticks;
    doc.line(x + 44, yy, x + w, yy);
    doc.text(clean(money(Math.round(v))), x + 40, yy + 2.5, { align: 'right' });
  }
  return { x0: x + 50, w0: w - 56 };
}
function range(vals) {
  let min = Math.min(0, ...vals), max = Math.max(0, ...vals);
  if (min === max) { max += 1; min -= 1; }
  const pad = (max - min) * 0.08; return [min - (min < 0 ? pad : 0), max + pad];
}
function lineChart(doc, x, y, w, h, pts) {
  const [min, max] = range(pts.map((p) => p.v));
  const { x0, w0 } = axes(doc, x, y, w, h, min, max);
  const px = (i) => x0 + (pts.length === 1 ? w0 / 2 : (w0 * i) / (pts.length - 1));
  const py = (v) => y + h - ((v - min) / (max - min)) * h;
  const zero = py(0);
  doc.setDrawColor(160, 160, 170); doc.setLineWidth(0.6); doc.line(x0, zero, x0 + w0, zero);
  const last = pts.at(-1)?.v || 0;
  doc.setDrawColor(...(last >= 0 ? C.green : C.red)); doc.setLineWidth(1.8);
  for (let i = 1; i < pts.length; i++) doc.line(px(i - 1), py(pts[i - 1].v), px(i), py(pts[i].v));
  doc.setFillColor(...(last >= 0 ? C.green : C.red));
  pts.forEach((p, i) => doc.circle(px(i), py(p.v), pts.length > 25 ? 1 : 2, 'F'));
  labelsX(doc, pts, px, y + h + 10);
}
function barChart(doc, x, y, w, h, pts) {
  const [min, max] = range(pts.map((p) => p.v));
  const { x0, w0 } = axes(doc, x, y, w, h, min, max);
  const py = (v) => y + h - ((v - min) / (max - min)) * h;
  const slot = w0 / Math.max(pts.length, 1), bw = Math.min(26, slot * 0.7);
  pts.forEach((p, i) => {
    const cx = x0 + slot * i + slot / 2, top = py(Math.max(p.v, 0)), bot = py(Math.min(p.v, 0));
    doc.setFillColor(...(p.v >= 0 ? C.green : C.red)); doc.rect(cx - bw / 2, top, bw, Math.max(bot - top, 0.8), 'F');
  });
  labelsX(doc, pts, (i) => x0 + slot * i + slot / 2, y + h + 10);
}
function labelsX(doc, pts, px, yy) {
  doc.setFontSize(6.5); doc.setTextColor(...C.muted);
  const every = Math.ceil(pts.length / 12);
  pts.forEach((p, i) => { if (i % every === 0) doc.text(clean(p.label), px(i), yy, { align: 'center' }); });
}
function hbarChart(doc, x, y, w, rows) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
  const lw = 110, mid = x + lw + (w - lw - 70) / 2, half = (w - lw - 70) / 2;
  rows.forEach((r, i) => {
    const yy = y + i * 22;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C.ink); doc.text(clean(r.label), x, yy + 11);
    doc.setFontSize(7); doc.setTextColor(...C.muted); if (r.sub) doc.text(clean(r.sub), x, yy + 19);
    const len = (Math.abs(r.v) / max) * half;
    doc.setFillColor(...(r.v >= 0 ? C.green : C.red));
    if (r.v >= 0) doc.rect(mid, yy + 4, Math.max(len, 0.8), 10, 'F'); else doc.rect(mid - len, yy + 4, len, 10, 'F');
    doc.setDrawColor(...C.line); doc.line(mid, yy, mid, yy + 18);
    doc.setFontSize(9); doc.setTextColor(...(r.v >= 0 ? C.green : C.red)); doc.text(clean(money(r.v)), x + w, yy + 12, { align: 'right' });
  });
}
function table(doc, x, y, w, title, rows) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink); doc.text(clean(title), x, y + 10);
  let yy = y + 26;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.muted);
  doc.text('Name', x, yy); doc.text('Trades', x + w * 0.5, yy, { align: 'right' }); doc.text('Win %', x + w * 0.7, yy, { align: 'right' }); doc.text('P&L', x + w, yy, { align: 'right' });
  yy += 6;
  if (!rows.length) { doc.setTextColor(...C.muted); doc.text('Not tagged on these trades', x, yy + 12); return 50; }
  rows.forEach((r) => {
    yy += 16; doc.setFontSize(9); doc.setTextColor(...C.ink);
    doc.text(doc.splitTextToSize(clean(r.key), w * 0.42)[0], x, yy);
    doc.text(String(r.count), x + w * 0.5, yy, { align: 'right' });
    doc.text(`${r.winRate.toFixed(0)}%`, x + w * 0.7, yy, { align: 'right' });
    doc.setTextColor(...(r.pnl >= 0 ? C.green : C.red)); doc.text(clean(money(r.pnl)), x + w, yy, { align: 'right' });
    doc.setDrawColor(...C.line); doc.setLineWidth(0.4); doc.line(x, yy + 5, x + w, yy + 5);
  });
  return yy - y + 6;
}

export { WEEKDAYS };
