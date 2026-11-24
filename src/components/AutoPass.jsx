import { useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext.jsx';
import { mergeFirms, nextAccountBody, readyToPass } from '../lib/firms.js';
import { today } from '../lib/dates.js';

/**
 * Watches your prop accounts. When an evaluation reaches its profit target with the
 * minimum trading days and minimum trades, and no rule broken, it is marked Passed and the
 * next account is created: Phase 2 for 2-step plans, otherwise the Funded (master) account.
 */
export default function AutoPass() {
  const { accounts, allTrades, updateAccount, addAccounts, notify, settings } = useApp();
  const busy = useRef(new Set());
  useEffect(() => {
    const firms = mergeFirms(settings.customFirms);
    for (const a of accounts) {
      if (busy.current.has(a.id)) continue;
      const m = readyToPass(a, allTrades);
      if (!m) continue;
      if (accounts.some((x) => x.prevAccount === a.id)) continue; // next phase already exists
      busy.current.add(a.id);
      const body = nextAccountBody(a, firms, today());
      (async () => {
        try {
          await updateAccount(a.id, { status: 'passed', passedAt: today() });
          await addAccounts(body);
          notify(`🎉 ${a.name} passed ${a.phase} (${m.days} days, ${m.trades} trades). ${body.phase} account added.`);
        } catch (e) { busy.current.delete(a.id); notify(e.message); }
      })();
    }
  }, [accounts, allTrades]); // eslint-disable-line
  return null;
}
