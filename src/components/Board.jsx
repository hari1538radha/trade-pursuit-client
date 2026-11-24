import { Children, Fragment, createContext, isValidElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GripVertical, Maximize2, RotateCcw } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { cls } from '../lib/format.js';

/**
 * Customisable page layouts.
 * <Board id="money"> lays its direct children on a 12-column grid. In "Customize layout" mode
 * each block can be dragged (grip, top-left) to a new place and resized from its bottom-right
 * corner: sideways snaps to columns, downwards sets a height. Saved per page to your account
 * (and this browser). Phones and tablets always get the simple stacked layout.
 *
 * Child props read by the board (any element):
 *   data-span={6}   default width in columns (12 = full)
 *   data-fixed      stays where it is and can't be moved or resized (page headers)
 *   data-blk="id"   stable id when the child order changes with data
 *   data-free       not a block (dialogs, drawers): rendered as-is after the grid
 */
export const LayoutEdit = createContext({ editing: false, setEditing: () => {}, desktop: true });
export const useLayoutEdit = () => useContext(LayoutEdit);

const COLS = 12, GAP = 16, MIN_H = 90;
const lsKey = (id) => `tp.layout.${id}`;

function flatten(children, prefix = '') {
  const out = [];
  Children.toArray(children).forEach((el) => {
    if (!isValidElement(el)) return;
    if (el.type === Fragment) out.push(...flatten(el.props.children, `${prefix}${el.key}/`));
    else out.push({ key: el.props['data-blk'] || `${prefix}${el.key}`, el });
  });
  return out;
}

export function useSavedLayout(id) {
  const { settings, updateUser } = useApp();
  const fromServer = settings.layouts?.[id];
  const [layout, setLayout] = useState(() => {
    try { return fromServer || JSON.parse(localStorage.getItem(lsKey(id)) || 'null') || {}; } catch { return fromServer || {}; }
  });
  const first = useRef(true);
  useEffect(() => { // follow the account's copy (e.g. after "Reset layout" or a change on another device)
    if (first.current) { first.current = false; return; }
    setLayout(fromServer || {});
  }, [JSON.stringify(fromServer)]); // eslint-disable-line
  const timer = useRef();
  const all = useRef(settings.layouts || {});
  all.current = settings.layouts || {};
  const save = useCallback((next) => {
    setLayout(next);
    try { localStorage.setItem(lsKey(id), JSON.stringify(next)); } catch { /* storage full or blocked */ }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const layouts = { ...all.current };
      if (next && (next.order?.length || Object.keys(next.items || {}).length)) layouts[id] = next; else delete layouts[id];
      updateUser({ settings: { layouts } }).catch(() => {});
    }, 700);
  }, [id, updateUser]);
  return [layout, save];
}

export default function Board({ id, className, children }) {
  const { editing, desktop } = useLayoutEdit();
  const [layout, save] = useSavedLayout(id);
  const ref = useRef(null);
  const [drag, setDrag] = useState(null); // { key } while moving
  const [live, setLive] = useState(null); // { key, span, h } while resizing
  const all = flatten(children);
  const kids = all.filter((k) => k.el.props['data-free'] == null);
  const free = all.filter((k) => k.el.props['data-free'] != null);
  const keys = kids.map((k) => k.key);

  // Saved order first; blocks the saved layout doesn't know keep their natural place.
  // (Only the order of keys is worked out here; the elements are always the current ones.)
  const savedOrder = (layout.order || []).filter((k) => keys.includes(k));
  let ordered = kids;
  if (savedOrder.length) {
    const rank = new Map(savedOrder.map((k, i) => [k, i]));
    ordered = kids.filter((k) => rank.has(k.key)).sort((a, b) => rank.get(a.key) - rank.get(b.key));
    kids.forEach((k, i) => { if (!rank.has(k.key)) ordered.splice(Math.min(i, ordered.length), 0, k); });
  }

  const sizeOf = (k) => {
    if (live?.key === k.key) return live;
    const s = layout.items?.[k.key] || {};
    return { span: s.span ?? (+k.el.props['data-span'] || COLS), h: s.h ?? null };
  };
  const setItem = (key, patch) => save({ ...layout, items: { ...(layout.items || {}), [key]: { ...(layout.items?.[key] || {}), ...patch } } });

  // ---- move: drag the grip over another block; the order updates as you go
  const startMove = (e, key) => {
    e.preventDefault();
    let order = ordered.map((k) => k.key);
    setDrag({ key });
    const move = (ev) => {
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.(`[data-board="${id}"] > .blk`);
      const target = over?.dataset.key;
      if (!target || target === key || over.dataset.fixed) return;
      const r = over.getBoundingClientRect();
      const after = r.width > r.height * 1.4 ? ev.clientY > r.top + r.height / 2 : ev.clientX > r.left + r.width / 2;
      const next = order.filter((k) => k !== key);
      const at = next.indexOf(target) + (after ? 1 : 0);
      next.splice(at, 0, key);
      if (next.join() !== order.join()) { order = next; save({ ...layout, order: next }); }
    };
    const up = () => { setDrag(null); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---- resize: drag the corner; width snaps to columns, height in pixels
  const startResize = (e, k) => {
    e.preventDefault(); e.stopPropagation();
    const box = e.currentTarget.closest('.blk').getBoundingClientRect();
    const colW = (ref.current.clientWidth - GAP * (COLS - 1)) / COLS;
    const x0 = e.clientX, y0 = e.clientY;
    let cur = sizeOf(k);
    const move = (ev) => {
      const span = Math.max(2, Math.min(COLS, Math.round((box.width + ev.clientX - x0 + GAP) / (colW + GAP))));
      const h = Math.max(MIN_H, Math.round(box.height + ev.clientY - y0));
      cur = { key: k.key, span, h: Math.abs(ev.clientY - y0) > 6 || cur.h ? h : null };
      setLive(cur);
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setLive(null);
      setItem(k.key, { span: cur.span, h: cur.h });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const custom = desktop;
  return (
    <div ref={ref} data-board={id} className={cls(className, 'board', custom && 'board-grid', editing && custom && 'editing', drag && 'dragging')}>
      {ordered.map((k) => {
        const fixed = k.el.props['data-fixed'] != null;
        const { span, h } = sizeOf(k);
        return (
          <div key={k.key} data-key={k.key} data-fixed={fixed ? '1' : undefined}
            className={cls('blk', h && 'sized', drag?.key === k.key && 'moving', live?.key === k.key && 'resizing')}
            style={custom ? { gridColumn: fixed ? '1 / -1' : `span ${span}`, height: h || undefined } : undefined}>
            {k.el}
            {editing && custom && !fixed && (
              <>
                <button className="blk-grip" aria-label="Drag to move" title="Drag to move" onPointerDown={(e) => startMove(e, k.key)}><GripVertical size={15} /></button>
                <div className="blk-tools">
                  <span className="blk-size">{span}/12{h ? ` · ${h}px` : ''}</span>
                  {(layout.items?.[k.key]) && <button title="Default size" onClick={() => { const items = { ...(layout.items || {}) }; delete items[k.key]; save({ ...layout, items }); }}><RotateCcw size={12} /></button>}
                  <button title="Full width" onClick={() => setItem(k.key, { span: 12 })}><Maximize2 size={12} /></button>
                </div>
                <span className="blk-corner" title="Drag to resize" onPointerDown={(e) => startResize(e, k)} />
              </>
            )}
          </div>
        );
      })}
      {free.map((k) => <Fragment key={k.key}>{k.el}</Fragment>)}
    </div>
  );
}

/** Clear one page's saved layout */
export function useResetLayout() {
  const { settings, updateUser } = useApp();
  return (id) => {
    try { localStorage.removeItem(lsKey(id)); } catch { /* ignore */ }
    const layouts = { ...(settings.layouts || {}) };
    delete layouts[id];
    return updateUser({ settings: { layouts } });
  };
}
