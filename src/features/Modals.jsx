import { useEffect, useState } from 'react';
import { Dialog } from '../components/ui.jsx';
import { useApp } from '../store/AppContext.jsx';
import QuickLog from './QuickLog.jsx';
import LogTrade from './LogTrade.jsx';
import Settings from './Settings.jsx';
import AddAccount from './AddAccount.jsx';
import AccountDialog from './AccountDialog.jsx';
import ReportDialog from './ReportDialog.jsx';

export default function Modals() {
  const { modal, closeModal } = useApp();
  const t = modal?.type, p = modal?.props || {};
  return (
    <>
      <QuickLog open={t === 'quick'} onClose={closeModal} />
      <LogTrade open={t === 'log'} onClose={closeModal} trade={p.trade} tab={p.tab} />
      <Settings open={t === 'settings'} onClose={closeModal} tab={p.tab} />
      <AddAccount open={t === 'addAccount'} onClose={closeModal} firmId={p.firmId} />
      <AccountDialog open={t === 'account'} onClose={closeModal} id={p.id} />
      <ReportDialog open={t === 'report'} onClose={closeModal} kind={p.kind} />
      <AskDialog />
    </>
  );
}

export function AskDialog() {
  const { ask, closeAsk } = useApp();
  const [txt, setTxt] = useState('');
  useEffect(() => setTxt(''), [ask]);
  return (
    <Dialog open={!!ask} onClose={() => closeAsk(false)}>
      <p style={{ fontSize: 17, marginTop: 0, lineHeight: 1.5 }}>{ask?.msg}</p>
      {ask?.type && <input className="input" autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={ask.type} />}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
        <button className="btn" onClick={() => closeAsk(false)}>Cancel</button>
        <button className="btn danger" disabled={ask?.type && txt !== ask.type} onClick={() => closeAsk(true)}>Confirm</button>
      </div>
    </Dialog>
  );
}
