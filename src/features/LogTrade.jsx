import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, ArrowDown, FileText, SlidersHorizontal, ImagePlus, Clipboard, Plus, X, Trash2, Check } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { Sheet, Seg, ChipGroup, Field } from '../components/ui.jsx';
import { cls } from '../lib/format.js';
import { today, longDate, nowTime } from '../lib/dates.js';
import { compressImage } from '../lib/image.js';
import { fromCSV } from '../lib/csv.js';
import AssetPicker from '../components/AssetPicker.jsx';

const SESSIONS = ['Asia', 'London', 'NY AM', 'NY PM', 'No session'];
const POS = ['Patient', 'Disciplined', 'Focused', 'Calm', 'Confident', 'Rule-Following', 'Selective', 'Prepared'];
const NEG = ['Fomo', 'Revenge', 'Overconfident', 'Impatient', 'Fearful', 'Greedy', 'Distracted', 'Frustrated', 'Anxious'];
const GRADES = ['A+', 'A', 'B', 'C', 'F'];
const gcls = { A: 'g-a', C: 'g-c', F: 'g-f' };

const blank = () => ({
  date: today(), symbol: '', assetClass: 'Futures', tradeType: 'Day', direction: 'long', session: '', followedPlan: true, accounts: [],
  entry: '', exit: '', pnl: '', size: '', plannedRR: '', realizedRR: '', entryTime: '', exitTime: '', stopLoss: '', target: '', partials: [], addOns: [],
  mae: '', mfe: '', exitReason: '', playbook: '', targets: [], confluences: [], confirmations: [], bonus: [], postLoss: 'No revenge trade',
  emotionsPos: [], emotionsNeg: [], grade: '', notes: '', images: [],
});
const NUMS = ['entry', 'exit', 'pnl', 'size', 'plannedRR', 'realizedRR', 'stopLoss', 'target', 'mae', 'mfe'];

export default function LogTrade({ open, onClose, trade }) {
  const { saveTrade, deleteTrade, accounts, settings, updateUser, notify, importTrades, openModal, confirmAsk } = useApp();
  const [tab, setTab] = useState('Advanced');
  const [f, setF] = useState(blank());
  const [saving, setSaving] = useState(false);
  const csvRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (trade) {
      const t = { ...blank(), ...trade };
      for (const k of NUMS) t[k] = trade[k] ?? '';
      setF(t); setTab(trade.noTrade ? 'No Trade Day' : 'Advanced');
    } else { setF({ ...blank(), entryTime: nowTime() }); setTab(localStorage.getItem('edgelog.logtab') || 'Advanced'); }
  }, [open, trade]);

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const tags = settings.tags || {};
  const addTag = (group) => (v) => updateUser({ settings: { tags: { ...tags, [group]: [...new Set([...(tags[group] || []), v])] } } });

  // Auto P&L from prices when possible
  const autoPnl = () => {
    const e = parseFloat(f.entry), x = parseFloat(f.exit), s = parseFloat(f.size) || 1;
    if (Number.isFinite(e) && Number.isFinite(x) && f.pnl === '') setF((v) => ({ ...v, pnl: String(+(((f.direction === 'long' ? x - e : e - x) * s).toFixed(2))) }));
  };
  const autoRR = () => {
    const e = parseFloat(f.entry), sl = parseFloat(f.stopLoss), tp = parseFloat(f.target), x = parseFloat(f.exit);
    if (![e, sl].every(Number.isFinite) || e === sl) return;
    const risk = Math.abs(e - sl);
    setF((v) => ({ ...v, plannedRR: v.plannedRR === '' && Number.isFinite(tp) ? String(+(Math.abs(tp - e) / risk).toFixed(2)) : v.plannedRR, realizedRR: v.realizedRR === '' && Number.isFinite(x) ? String(+(((v.direction === 'long' ? x - e : e - x)) / risk).toFixed(2)) : v.realizedRR }));
  };

  const save = async () => {
    const noTrade = tab === 'No Trade Day';
    const body = { ...f, noTrade };
    for (const k of NUMS) { const n = parseFloat(String(body[k]).replace(/[$,]/g, '')); body[k] = Number.isFinite(n) ? n : null; }
    if (noTrade) { body.pnl = 0; body.symbol = ''; }
    else if (body.pnl == null) return notify('Add the P&L');
    body.partials = body.partials.filter((p) => p.price || p.size);
    body.addOns = body.addOns.filter((p) => p.price || p.size);
    delete body.id; delete body.user; delete body.createdAt; delete body.updatedAt;
    setSaving(true);
    try { await saveTrade(body, trade?.id); notify(trade ? 'Trade updated' : noTrade ? 'No-trade day logged' : 'Trade logged'); onClose(); }
    catch (e) { notify(e.message); }
    setSaving(false);
  };

  const onCSV = async (file) => {
    try {
      const rows = fromCSV(await file.text());
      if (!rows.length) return notify('No rows found in that CSV');
      await importTrades(rows); notify(`Imported ${rows.length} trades`); onClose();
    } catch (e) { notify(e.message); }
  };

  const adv = tab === 'Advanced';
  const actions = (
    <>
      <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files[0] && onCSV(e.target.files[0])} />
      <button className="btn sm" onClick={() => csvRef.current.click()}><FileText size={15} /> Import CSV</button>
      <button className="btn sm" onClick={() => openModal('settings', { tab: 'Tags' })}><SlidersHorizontal size={15} /> Log settings</button>
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Journal" title={trade ? 'Edit Trade' : 'Log Trade'} actions={actions}>
      <div className="log-grid">
        <div>
          <div style={{ marginBottom: 18 }}><Seg size="lg" options={['Basic', 'Advanced', 'No Trade Day']} value={tab} onChange={(t) => { setTab(t); if (t !== 'No Trade Day') localStorage.setItem('edgelog.logtab', t); }} /></div>
          <AnimatePresence mode="wait">
            <motion.div key={tab === 'No Trade Day' ? 'nt' : 'trade'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
              {tab === 'No Trade Day' ? (
                <section className="log-section">
                  <h4>No Trade Day</h4>
                  <p className="muted" style={{ marginTop: -8 }}>Sitting out is a decision. Log it so your streaks and discipline stats count it.</p>
                  <div className="fgrid" style={{ marginTop: 16 }}>
                    <Field label="Date"><input type="date" className="input" value={f.date} onChange={set('date')} /></Field>
                    <Field label="Account"><AccountPick accounts={accounts} value={f.accounts} onChange={set('accounts')} /></Field>
                  </div>
                  <div style={{ marginTop: 18 }}><Field label="Why no trade?"><textarea className="textarea" value={f.notes} onChange={set('notes')} placeholder="No setup formed. News day. Already hit my weekly goal…" /></Field></div>
                </section>
              ) : (
                <>
                  <section className="log-section">
                    <h4>Trade Info</h4>
                    <div className="fgrid">
                      <AssetPicker assetClass={f.assetClass} symbol={f.symbol} onChange={(v) => setF((x) => ({ ...x, ...v }))} />
                      <Field label="Date"><input type="date" className="input" value={f.date} onChange={set('date')} /></Field>
                      <Field label="Trade type"><select className="select" value={f.tradeType} onChange={set('tradeType')}>{['Day', 'Scalp', 'Swing', 'Position'].map((o) => <option key={o}>{o}</option>)}</select></Field>
                    </div>
                    <div className="row" style={{ gap: 10, margin: '20px 0' }}>
                      {[['long', 'Long', ArrowUp], ['short', 'Short', ArrowDown]].map(([v, l, I]) => <button key={v} className={cls('dir-btn row', v, f.direction === v && 'on')} style={{ justifyContent: 'center' }} onClick={() => set('direction')(v)}><I size={17} /> {l}</button>)}
                    </div>
                    <Field label="Session">
                      <div className="row wrap" style={{ gap: 8 }}>{SESSIONS.map((s) => <button key={s} className={cls('chip', f.session === s && 'on')} onClick={() => set('session')(f.session === s ? '' : s)}>{s}</button>)}</div>
                    </Field>
                    {f.session && f.session !== 'No session' && <p className="muted" style={{ fontSize: 13.5 }}>Lands in {longDate(f.date)}, {f.session}. Counts in the {f.session} P&amp;L and the daily P&amp;L.</p>}
                    <div style={{ marginTop: 18 }}><Field label="Followed my plan"><div className="row" style={{ gap: 8 }}>{[true, false].map((v) => <button key={String(v)} className={cls('dir-btn', !v && 'short', f.followedPlan === v && 'on')} style={{ flex: '0 0 140px' }} onClick={() => set('followedPlan')(v)}>{v ? 'Yes' : 'No'}</button>)}</div></Field></div>
                    <div style={{ marginTop: 18 }}><Field label="Account" right={<button className="muted" style={{ textTransform: 'none', letterSpacing: 0 }} onClick={() => openModal('addAccount')}>Manage</button>}><AccountPick accounts={accounts} value={f.accounts} onChange={set('accounts')} /></Field></div>
                  </section>

                  <section className="log-section">
                    <h4>Execution</h4>
                    <div className="fgrid">
                      <Field label="Entry price"><input className="input" inputMode="decimal" placeholder="0.00" value={f.entry} onChange={set('entry')} onBlur={() => { autoPnl(); autoRR(); }} /></Field>
                      <Field label="Exit price"><input className="input" inputMode="decimal" placeholder="0.00" value={f.exit} onChange={set('exit')} onBlur={() => { autoPnl(); autoRR(); }} /></Field>
                      <Field label="P&L"><input className="input" inputMode="decimal" placeholder="$ +500 or -200" value={f.pnl} onChange={set('pnl')} style={{ color: parseFloat(f.pnl) < 0 ? 'var(--red)' : parseFloat(f.pnl) > 0 ? 'var(--green)' : undefined }} /></Field>
                      <Field label="Size / Qty"><input className="input" inputMode="decimal" placeholder="1" value={f.size} onChange={set('size')} /></Field>
                      <Field label="Planned R:R"><input className="input" inputMode="decimal" placeholder="e.g. 2.0" value={f.plannedRR} onChange={set('plannedRR')} /></Field>
                      <Field label="Realized R:R"><input className="input" inputMode="decimal" placeholder="e.g. 2.5" value={f.realizedRR} onChange={set('realizedRR')} /></Field>
                    </div>
                    {adv && (
                      <>
                        <div className="divider" style={{ margin: '22px 0' }} />
                        <div className="fgrid">
                          <Field label="Entry time"><input type="time" step="1" className="input" value={f.entryTime || ''} onChange={set('entryTime')} /></Field>
                          <Field label="Exit / close time"><input type="time" step="1" className="input" value={f.exitTime || ''} onChange={set('exitTime')} /></Field>
                          <Field label="Stop loss"><input className="input" inputMode="decimal" placeholder="0.00" value={f.stopLoss} onChange={set('stopLoss')} onBlur={autoRR} /></Field>
                          <Field label="Target"><input className="input" inputMode="decimal" placeholder="0.00" value={f.target} onChange={set('target')} onBlur={autoRR} /></Field>
                          <Legs label="Partials" add="Add partial" value={f.partials} onChange={set('partials')} />
                          <Legs label="Add-ons" add="Add add-on" value={f.addOns} onChange={set('addOns')} />
                          <Field label={<>MAE (max adverse) <span className="dim" style={{ textTransform: 'none' }}>(optional)</span></>}><input className="input" inputMode="decimal" placeholder="Against you, in $" value={f.mae} onChange={set('mae')} /></Field>
                          <Field label={<>MFE (max favorable) <span className="dim" style={{ textTransform: 'none' }}>(optional)</span></>}><input className="input" inputMode="decimal" placeholder="In your favour, in $" value={f.mfe} onChange={set('mfe')} /></Field>
                        </div>
                        <div style={{ marginTop: 20 }}>
                          <Field label="Exit reason">
                            <ChipGroup multi={false} options={tags.exitReasons || []} value={f.exitReason} onChange={set('exitReason')} onAdd={addTag('exitReasons')} addLabel="Add your own exit reason…" />
                            {!(tags.exitReasons || []).length && <span className="dim" style={{ fontSize: 13 }}>Nothing here yet. Write the reasons you actually exit for and they stay for every trade.</span>}
                          </Field>
                        </div>
                      </>
                    )}
                  </section>

                  {adv && (
                    <>
                      <Section title="Playbook"><ChipGroup multi={false} options={tags.playbooks || []} value={f.playbook} onChange={set('playbook')} onAdd={addTag('playbooks')} addLabel="Add your own playbook…" /></Section>
                      <Section title="Liquidity Target" sub="What were you targeting? The magnet this trade was built to reach."><ChipGroup options={tags.targets || []} value={f.targets} onChange={set('targets')} onAdd={addTag('targets')} addLabel="Add a target…" /></Section>
                      <Section title="Breakdown">
                        <div className="eyebrow" style={{ color: '#a78bfa', marginBottom: 10 }}>Confluences</div>
                        <ChipGroup options={tags.confluences || []} value={f.confluences} onChange={set('confluences')} onAdd={addTag('confluences')} addLabel="Add confluence…" />
                        <div className="eyebrow" style={{ color: '#60a5fa', margin: '22px 0 10px' }}>Confirmations</div>
                        <ChipGroup options={tags.confirmations || []} value={f.confirmations} onChange={set('confirmations')} onAdd={addTag('confirmations')} addLabel="Add confirmation…" />
                        <div className="eyebrow" style={{ color: '#f59e0b', margin: '22px 0 10px' }}>Bonus</div>
                        <ChipGroup options={tags.bonus || []} value={f.bonus} onChange={set('bonus')} onAdd={addTag('bonus')} addLabel="Add bonus…" />
                      </Section>
                      <Section title="Post-loss Entry">
                        <Field label="Post-loss entry (revenge trade?)"><select className="select" value={f.postLoss} onChange={set('postLoss')}>{['No revenge trade', 'Revenge trade', 'First trade of the day', 'Re-entry after loss (planned)'].map((o) => <option key={o}>{o}</option>)}</select></Field>
                      </Section>
                      <Section title="Emotions & Psychology">
                        <div style={{ fontWeight: 500, marginBottom: 10 }}>POSITIVE, WHAT KEPT YOU DISCIPLINED?</div>
                        <ChipGroup tone="green" options={POS} value={f.emotionsPos} onChange={set('emotionsPos')} onAdd={() => {}} />
                        <div className="muted" style={{ fontWeight: 500, margin: '22px 0 10px' }}>NEGATIVE, WHAT HURT THIS TRADE?</div>
                        <ChipGroup tone="red" options={NEG} value={f.emotionsNeg} onChange={set('emotionsNeg')} onAdd={() => {}} />
                      </Section>
                    </>
                  )}
                  <section className="log-section">
                    <h4>Performance</h4>
                    <Field label="Trade grade"><div className="grade-row">{GRADES.map((g) => <motion.button whileTap={{ scale: 0.95 }} key={g} className={cls('grade-btn', gcls[g], f.grade === g && 'on')} onClick={() => set('grade')(f.grade === g ? '' : g)}>{g}</motion.button>)}</div></Field>
                  </section>
                  <section className="log-section">
                    <h4>Notes</h4>
                    <textarea className="textarea" style={{ minHeight: 140 }} value={f.notes} onChange={set('notes')} placeholder="Explain your trade, entry, and insights. What happened? What did you do well? What would you do differently?" />
                  </section>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="row" style={{ position: 'sticky', bottom: 0, padding: '14px 0', background: 'var(--sheet)', borderTop: '1px solid var(--line)', gap: 10, zIndex: 3 }}>
            {trade && <button className="btn danger" onClick={async () => { if (await confirmAsk('Delete this trade?')) { await deleteTrade(trade.id); notify('Trade deleted'); onClose(); } }}><Trash2 size={15} /> Delete</button>}
            <button className="btn primary grow" style={{ height: 52, fontSize: 16 }} disabled={saving} onClick={save}><Check size={17} /> {trade ? 'Save changes' : 'Log trade'}</button>
          </div>
        </div>
        <Pictures images={f.images} onChange={set('images')} />
      </div>
    </Sheet>
  );
}

function Section({ title, sub, children }) {
  return (
    <section className="log-section">
      <h4>{title} <small>ADVANCED</small></h4>
      {sub && <p className="muted" style={{ marginTop: -10, marginBottom: 16 }}>{sub}</p>}
      {children}
    </section>
  );
}

function AccountPick({ accounts, value, onChange }) {
  const act = accounts.filter((a) => a.status === 'active');
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      <button className={cls('chip', !value.length && 'on')} onClick={() => onChange([])}>None</button>
      {act.map((a) => <button key={a.id} className={cls('chip', value.includes(a.id) && 'on')} onClick={() => onChange(value.includes(a.id) ? value.filter((x) => x !== a.id) : [...value, a.id])}>{a.name}</button>)}
      {act.length > 1 && <button className="chip" onClick={() => onChange(act.map((a) => a.id))}>All {act.length} (copier)</button>}
    </div>
  );
}

function Legs({ label, add, value, onChange }) {
  return (
    <Field label={label}>
      {value.map((p, i) => (
        <div key={i} className="row" style={{ gap: 6 }}>
          <input className="input" placeholder="Price" value={p.price ?? ''} onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, price: e.target.value } : x)))} />
          <input className="input" placeholder="Size" value={p.size ?? ''} onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, size: e.target.value } : x)))} />
          <button className="icon-btn" onClick={() => onChange(value.filter((_, k) => k !== i))}><X size={15} /></button>
        </div>
      ))}
      <button className="row muted" style={{ gap: 6, padding: '6px 0' }} onClick={() => onChange([...value, { price: '', size: '' }])}><Plus size={16} /> {add}</button>
    </Field>
  );
}

function Pictures({ images, onChange }) {
  const [over, setOver] = useState(false);
  const [mode, setMode] = useState('Upload');
  const [link, setLink] = useState('');
  const fileRef = useRef(null);
  const add = async (files) => {
    const out = [];
    for (const f of [...files].filter((f) => f.type.startsWith('image/')).slice(0, 6 - images.length)) out.push(await compressImage(f));
    if (out.length) onChange([...images, ...out]);
  };
  useEffect(() => {
    const p = (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) add(fs); };
    window.addEventListener('paste', p);
    return () => window.removeEventListener('paste', p);
  });
  return (
    <div className="log-section" style={{ position: 'sticky', top: 0 }}>
      <div className="eyebrow mono" style={{ marginBottom: 14 }}>Pictures</div>
      <div style={{ marginBottom: 14 }}><Seg options={['Upload', 'Paste a link']} value={mode} onChange={setMode} /></div>
      {mode === 'Paste a link' && (
        <form className="row" style={{ marginBottom: 12 }} onSubmit={(e) => { e.preventDefault(); if (/^https?:\/\//.test(link)) { onChange([...images, link]); setLink(''); } }}>
          <input className="input" placeholder="https://www.tradingview.com/x/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="btn">Add</button>
        </form>
      )}
      <div className={cls('drop', over && 'over')} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        {images.length > 0 && (
          <div className="thumbs">
            {images.map((src, i) => <motion.div key={i} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><img src={src} alt="" /><button onClick={() => onChange(images.filter((_, k) => k !== i))}><X size={14} /></button></motion.div>)}
          </div>
        )}
        {images.length < 6 && (
          <>
            <ImagePlus size={26} style={{ marginTop: images.length ? 20 : 0 }} />
            <div>Drop screenshots, or <button className="link" onClick={() => fileRef.current.click()}>choose files</button></div>
            <div className="dim row" style={{ gap: 6, fontSize: 13 }}><Clipboard size={13} /> Cmd/Ctrl+V works here too</div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
    </div>
  );
}
