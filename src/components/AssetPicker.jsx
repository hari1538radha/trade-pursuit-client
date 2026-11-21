import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, PenLine, Search, Check, List } from 'lucide-react';
import { Field } from './ui.jsx';
import { ASSET_CATEGORIES, ALL_SYMBOLS } from '../lib/assets.js';
import { cls } from '../lib/format.js';

/**
 * Asset class dropdown + instrument dropdown, with a manual-entry fallback.
 * value = { assetClass, symbol }
 */
export default function AssetPicker({ assetClass, symbol, onChange }) {
  const cat = ASSET_CATEGORIES.find((c) => c.key === assetClass);
  const listed = !symbol || (cat ? cat.items.some(([s]) => s === symbol.toUpperCase()) : ALL_SYMBOLS.some((x) => x.symbol === symbol.toUpperCase()));
  const [manual, setManual] = useState(!listed);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (symbol && !listed) setManual(true); }, [symbol]); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    const off = (e) => !box.current?.contains(e.target) && setOpen(false);
    window.addEventListener('mousedown', off);
    return () => window.removeEventListener('mousedown', off);
  }, [open]);

  const options = useMemo(() => {
    const needle = q.trim().toUpperCase();
    const base = cat ? cat.items.map(([s, n]) => ({ symbol: s, name: n, category: cat.key })) : ALL_SYMBOLS;
    if (!needle) return base;
    // Searching also looks in other categories so "XAU" finds gold wherever it lives.
    const pool = [...base, ...ALL_SYMBOLS.filter((x) => !base.some((b) => b.symbol === x.symbol))];
    return pool.filter((x) => x.symbol.includes(needle) || x.name.toUpperCase().includes(needle));
  }, [cat, q]);

  const pick = (o) => { onChange({ symbol: o.symbol, assetClass: o.category }); setOpen(false); setQ(''); };
  const classes = [...ASSET_CATEGORIES.map((c) => c.key), ...(assetClass && !cat ? [assetClass] : [])];
  const selected = ALL_SYMBOLS.find((x) => x.symbol === (symbol || '').toUpperCase());

  return (
    <>
      <Field label="Asset class">
        <select className="select" value={assetClass} onChange={(e) => { const next = e.target.value; const keep = ASSET_CATEGORIES.find((c) => c.key === next)?.items.some(([s]) => s === symbol.toUpperCase()); onChange({ assetClass: next, symbol: keep || manual ? symbol : '' }); }}>
          {classes.map((c) => <option key={c} value={c}>{ASSET_CATEGORIES.find((x) => x.key === c)?.icon || '•'} {c}</option>)}
        </select>
      </Field>
      <Field label="Symbol" right={
        <button type="button" className="row blue" style={{ textTransform: 'none', letterSpacing: 0, gap: 4 }} onClick={() => { setManual((m) => !m); setOpen(false); setTimeout(() => inputRef.current?.focus(), 30); }}>
          {manual ? <><List size={12} /> Pick from list</> : <><PenLine size={12} /> Manual entry</>}
        </button>
      }>
        {manual ? (
          <input ref={inputRef} className="input" value={symbol} onChange={(e) => onChange({ symbol: e.target.value.toUpperCase().slice(0, 20) })} placeholder="Type any symbol, e.g. MNQZ6" style={{ textTransform: 'uppercase' }} />
        ) : (
          <div ref={box} style={{ position: 'relative' }}>
            <button type="button" className="input row between" style={{ textAlign: 'left' }} onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 30); }}>
              <span className="row" style={{ gap: 8, minWidth: 0 }}>
                {symbol ? <><b>{symbol}</b>{selected && <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.name}</span>}</> : <span className="dim">Select {assetClass ? assetClass.toLowerCase() : 'an'} instrument…</span>}
              </span>
              <ChevronDown size={15} className="muted" />
            </button>
            <AnimatePresence>
              {open && (
                <motion.div className="asset-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                  <div className="search" style={{ marginBottom: 6 }}>
                    <Search size={14} className="muted" />
                    <input ref={inputRef} className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search instruments…" onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); if (options[0]) pick(options[0]); else if (q.trim()) { onChange({ symbol: q.trim().toUpperCase().slice(0, 20) }); setManual(true); setOpen(false); } }
                      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
                    }} />
                  </div>
                  {options.map((o) => (
                    <button type="button" key={o.category + o.symbol} className={cls('asset-opt', o.symbol === symbol && 'on')} onClick={() => pick(o)}>
                      <span><b>{o.symbol}</b> <small>{o.name}</small></span>
                      {o.symbol === symbol ? <Check size={14} className="blue" /> : o.category !== assetClass && <small>{o.category}</small>}
                    </button>
                  ))}
                  <button type="button" className="asset-opt" style={{ borderTop: '1px solid var(--line)', marginTop: 4, borderRadius: 0 }} onClick={() => { if (q.trim()) onChange({ symbol: q.trim().toUpperCase().slice(0, 20) }); setManual(true); setOpen(false); }}>
                    <span className="row blue" style={{ gap: 6 }}><PenLine size={14} /> {q.trim() ? `Use “${q.trim().toUpperCase()}” as a manual entry` : 'Enter a symbol manually'}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </Field>
    </>
  );
}
