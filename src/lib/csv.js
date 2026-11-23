const COLS = ['date', 'symbol', 'direction', 'pnl', 'size', 'entry', 'exit', 'entryTime', 'exitTime', 'session', 'assetClass', 'tradeType', 'playbook', 'grade', 'realizedRR', 'plannedRR', 'notes'];

export function toCSV(trades) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [COLS.join(','), ...trades.filter((t) => !t.noTrade).map((t) => COLS.map((c) => esc(t[c])).join(','))].join('\n');
}

function splitLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Accepts our own export plus common broker headers (Symbol, Side, P&L, Profit, Date...) */
export function fromCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = splitLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
  const idx = (...names) => head.findIndex((h) => names.includes(h));
  const I = {
    date: idx('date', 'closedate', 'exittime', 'closetime', 'tradedate', 'boughttimestamp'), symbol: idx('symbol', 'instrument', 'contract', 'ticker'),
    dir: idx('direction', 'side', 'type'), pnl: idx('pnl', 'profit', 'netpnl', 'pl', 'realizedpnl', 'netprofit'),
    size: idx('size', 'qty', 'quantity', 'volume', 'lots'), entry: idx('entry', 'entryprice', 'openprice', 'buyprice'), exit: idx('exit', 'exitprice', 'closeprice', 'sellprice'),
    notes: idx('notes', 'comment'), session: idx('session'), grade: idx('grade'), playbook: idx('playbook', 'setup', 'strategy'), rr: idx('realizedrr', 'rr'),
  };
  if (I.date < 0 || I.pnl < 0) throw new Error('CSV needs at least a Date and a P&L/Profit column');
  const num = (s) => { const n = parseFloat(String(s ?? '').replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1')); return Number.isFinite(n) ? n : undefined; };
  const normDate = (s) => {
    const d = new Date(s); if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null;
  };
  return lines.slice(1).map((l) => {
    const c = splitLine(l);
    const dir = I.dir >= 0 ? c[I.dir].toLowerCase() : 'long';
    const t = {
      date: normDate(c[I.date]), symbol: I.symbol >= 0 ? c[I.symbol].toUpperCase().slice(0, 20) : '',
      direction: /sell|short/.test(dir) ? 'short' : 'long', pnl: num(c[I.pnl]) ?? 0,
      size: I.size >= 0 ? num(c[I.size]) : undefined, entry: I.entry >= 0 ? num(c[I.entry]) : undefined, exit: I.exit >= 0 ? num(c[I.exit]) : undefined,
      notes: I.notes >= 0 ? c[I.notes] : undefined, session: I.session >= 0 ? c[I.session] : undefined,
      grade: I.grade >= 0 && ['A+', 'A', 'B', 'C', 'F'].includes(c[I.grade]) ? c[I.grade] : undefined,
      playbook: I.playbook >= 0 ? c[I.playbook] : undefined, realizedRR: I.rr >= 0 ? num(c[I.rr]) : undefined,
    };
    return t;
  }).filter((t) => t.date);
}

export function download(name, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
