// Download expenses and income as CSV (opens in Excel / Google Sheets) or a PDF statement.
import { jsPDF } from 'jspdf';
import { monthKey, monthLabel } from './personal.js';

const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
// Built-in PDF fonts have no ₹ sign or Unicode dashes
const pdfText = (s) => String(s ?? '').replace(/[–—−]/g, '-').replace(/₹/g, 'Rs ').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
const rs = (n) => `Rs ${Math.round(n).toLocaleString('en-IN')}`;

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @param entries all money entries
 * @param ym      'YYYY-MM' for one month, or null for everything
 * @param kind    'all' | 'expense' | 'income'
 * @param fmt     'csv' | 'pdf'
 */
export function downloadEntries({ entries, ym, kind = 'all', fmt = 'csv' }) {
  const rows = entries
    .filter((e) => (!ym || monthKey(e.date) === ym) && (kind === 'all' || e.kind === kind))
    .sort((a, b) => a.date.localeCompare(b.date));
  const what = kind === 'all' ? 'income-and-expenses' : kind === 'expense' ? 'expenses' : 'income';
  const name = `${what}-${ym || 'all'}`;
  const inc = rows.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0);
  const exp = rows.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);

  if (fmt === 'csv') {
    const lines = [['Date', 'Type', 'Category', 'Paid by / into', 'Note', 'Amount (INR)'].join(',')];
    for (const e of rows) lines.push([e.date, e.kind === 'income' ? 'Income' : 'Expense', e.category, e.method, e.note, e.kind === 'income' ? e.amount : -e.amount].map(esc).join(','));
    lines.push('');
    if (kind !== 'expense') lines.push(['', '', '', '', 'Total income', inc].map(esc).join(','));
    if (kind !== 'income') lines.push(['', '', '', '', 'Total expenses', -exp].map(esc).join(','));
    if (kind === 'all') lines.push(['', '', '', '', 'Net', inc - exp].map(esc).join(','));
    // BOM so Excel reads ₹ and other characters correctly
    save(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
    return rows.length;
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 44;
  let y = M;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(pdfText(`${kind === 'all' ? 'Income and expenses' : kind === 'expense' ? 'Expenses' : 'Income'} - ${ym ? monthLabel(ym) : 'all months'}`), M, y);
  y += 18; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
  doc.text(`${rows.length} entries · downloaded ${new Date().toLocaleDateString('en-GB')}`, M, y);
  y += 22; doc.setTextColor(20); doc.setFontSize(11);
  const tot = [kind !== 'expense' && `Income ${rs(inc)}`, kind !== 'income' && `Expenses ${rs(exp)}`, kind === 'all' && `Net ${inc - exp < 0 ? '-' : ''}${rs(Math.abs(inc - exp))}`].filter(Boolean).join('     ');
  doc.setFont('helvetica', 'bold'); doc.text(tot, M, y); doc.setFont('helvetica', 'normal');
  y += 22;
  const cols = [[M, 'Date'], [M + 72, 'Type'], [M + 128, 'Category'], [M + 236, 'Paid by'], [M + 336, 'Note'], [W - M, 'Amount']];
  const header = () => {
    doc.setFillColor(244, 245, 250); doc.rect(M - 6, y - 12, W - 2 * M + 12, 18, 'F');
    doc.setFontSize(9); doc.setTextColor(90); doc.setFont('helvetica', 'bold');
    cols.forEach(([x, t], i) => doc.text(t, x, y, i === cols.length - 1 ? { align: 'right' } : undefined));
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20); y += 18;
  };
  header();
  doc.setFontSize(9.5);
  for (const e of rows) {
    if (y > H - M) { doc.addPage(); y = M; header(); doc.setFontSize(9.5); }
    const cells = [e.date, e.kind === 'income' ? 'Income' : 'Expense', e.category, e.method || '-', e.note || ''];
    cells.forEach((t, i) => doc.text(doc.splitTextToSize(pdfText(t), (cols[i + 1][0] - cols[i][0]) - 8)[0] || '', cols[i][0], y));
    doc.setTextColor(...(e.kind === 'income' ? [22, 140, 80] : [20, 20, 24]));
    doc.text(`${e.kind === 'income' ? '+' : '-'}${rs(e.amount)}`, W - M, y, { align: 'right' });
    doc.setTextColor(20);
    doc.setDrawColor(235); doc.line(M - 6, y + 6, W - M + 6, y + 6);
    y += 17;
  }
  doc.save(`${name}.pdf`);
  return rows.length;
}
