import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  getInvestors, getCompanies, addProfitWithdrawal,
  getProfitWithdrawals, getFinancialData,
} from '../../store/financialStore';
import { getInvestorWallet, fmt, fmtDate } from '../../utils/financial/calculations';
import type { Investor, FinancialCompany, InvestorWallet, WithdrawalType } from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const bgInput = 'var(--t-in,#1f3344)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const inputCls = `w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-cyan-glow/50 transition-colors`;

interface WalletEntry { investor: Investor; wallet: InvestorWallet; companies: FinancialCompany[] }

export default function WithdrawalEngine() {
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState<ReturnType<typeof getProfitWithdrawals>>([]);
  const [allCompanies, setAllCompanies] = useState<FinancialCompany[]>([]);
  const [activeForm, setActiveForm] = useState<string | null>(null); // investorId
  const [form, setForm] = useState({ companyId: '', withdrawalType: 'profit' as WithdrawalType, amount: '', date: new Date().toISOString().split('T')[0], note: '' });
  const [warn, setWarn] = useState('');

  const reload = () => {
    const data = getFinancialData();
    const investors = getInvestors();
    const companies = getCompanies();
    setAllCompanies(companies);

    const walletEntries: WalletEntry[] = investors.map(inv => {
      const wallet = getInvestorWallet(data, inv.id);
      const investorCompanyIds = [...new Set(data.capitalTransactions.filter(t => t.investorId === inv.id).map(t => t.companyId))];
      return { investor: inv, wallet, companies: companies.filter(c => investorCompanyIds.includes(c.id)) };
    });
    setEntries(walletEntries);

    const recent = getProfitWithdrawals().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    setRecentWithdrawals(recent);
  };

  useEffect(() => { reload(); }, []);

  const openForm = (investorId: string) => {
    setActiveForm(investorId);
    const entry = entries.find(e => e.investor.id === investorId);
    setForm({ companyId: entry?.companies[0]?.id ?? '', withdrawalType: 'profit', amount: '', date: new Date().toISOString().split('T')[0], note: '' });
    setWarn('');
  };

  const validateAmount = (value: string) => {
    const entry = entries.find(e => e.investor.id === activeForm);
    if (!entry) return;
    const amount = Number(value);
    const max = form.withdrawalType === 'profit' ? entry.wallet.outstandingProfit : entry.wallet.remainingCapital;
    if (amount > max) {
      setWarn(`⚠️ Amount exceeds available ${form.withdrawalType === 'profit' ? 'profit' : 'capital'} (${fmt(max)})`);
    } else {
      setWarn('');
    }
    setForm(f => ({ ...f, amount: value }));
  };

  const submitWithdrawal = () => {
    if (!activeForm || !form.companyId || !form.amount || Number(form.amount) <= 0) return;
    addProfitWithdrawal({
      investorId: activeForm,
      companyId: form.companyId,
      withdrawalType: form.withdrawalType,
      amount: Number(form.amount),
      note: form.note || undefined,
      date: form.date,
    });
    setActiveForm(null);
    reload();
  };

  const invName = (id: string) => entries.find(e => e.investor.id === id)?.investor.name ?? id;
  const coName = (id: string) => allCompanies.find(c => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Withdrawal Engine</h1>
        <p className="text-sm" style={{ color: textMuted }}>Investors receive TWO independent values: Capital Recovery + Profit Payment. Never merged.</p>
      </div>

      {entries.length === 0 && (
        <div className="rounded-xl border p-12 text-center" style={{ background: bgCard, borderColor: border }}>
          <p className="text-sm" style={{ color: textMuted }}>No investors found. Add investors and capital transactions to use the Withdrawal Engine.</p>
        </div>
      )}

      {/* Investor Wallet Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {entries.map(({ investor, wallet }) => (
          <motion.div key={investor.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border p-5 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">{investor.name}</h3>
                {investor.email && <p className="text-xs" style={{ color: textMuted }}>{investor.email}</p>}
              </div>
              <button onClick={() => openForm(investor.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#00e5ff22', border: '1px solid #00e5ff44', color: '#00e5ff' }}>
                New Withdrawal
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Capital Invested', value: fmt(wallet.capitalInvested), color: '#60a5fa' },
                { label: 'Capital Returned', value: fmt(wallet.capitalReturned), color: '#34d399' },
                { label: 'Remaining Capital', value: fmt(wallet.remainingCapital), color: '#f59e0b' },
              ].map(m => (
                <div key={m.label} className="rounded-lg p-2.5 text-center" style={{ background: bgElevated }}>
                  <p className="text-[10px] mb-1" style={{ color: textMuted }}>{m.label}</p>
                  <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Profit Earned', value: fmt(wallet.profitEarned), color: '#34d399' },
                { label: 'Profit Paid', value: fmt(wallet.profitPaid), color: '#a78bfa' },
                { label: 'Outstanding', value: fmt(wallet.outstandingProfit), color: wallet.outstandingProfit > 0 ? '#f59e0b' : '#4b5563' },
              ].map(m => (
                <div key={m.label} className="rounded-lg p-2.5 text-center" style={{ background: bgElevated }}>
                  <p className="text-[10px] mb-1" style={{ color: textMuted }}>{m.label}</p>
                  <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: borderLight }}>
              <span className="text-xs" style={{ color: textMuted }}>ROI</span>
              <span className="text-sm font-bold" style={{ color: wallet.roi >= 0 ? '#34d399' : '#ef4444' }}>
                {wallet.roi.toFixed(2)}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Withdrawals */}
      {recentWithdrawals.length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: bgCard, borderColor: border }}>
          <h3 className="font-semibold text-white mb-4">Recent Withdrawals</h3>
          <div className="space-y-2">
            {recentWithdrawals.map(w => (
              <div key={w.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 border text-sm" style={{ background: bgElevated, borderColor: borderLight }}>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-xs" style={w.withdrawalType === 'profit' ? { background: '#34d39920', color: '#34d399' } : { background: '#60a5fa20', color: '#60a5fa' }}>
                    {w.withdrawalType === 'profit' ? 'Profit' : 'Capital'}
                  </span>
                  <span className="text-white">{invName(w.investorId)}</span>
                  <span style={{ color: textMuted }}>→ {coName(w.companyId)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-white">{fmt(w.amount)}</span>
                  <span className="text-xs" style={{ color: textMuted }}>{fmtDate(w.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawal Form Modal */}
      {activeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <div>
              <h3 className="font-semibold text-white">New Withdrawal</h3>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>Investor: {entries.find(e => e.investor.id === activeForm)?.investor.name}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Company *</label>
                <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                  <option value="">Select company…</option>
                  {(entries.find(e => e.investor.id === activeForm)?.companies ?? allCompanies).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Withdrawal Type *</label>
                <select value={form.withdrawalType} onChange={e => { setForm(f => ({ ...f, withdrawalType: e.target.value as WithdrawalType })); setWarn(''); }}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                  <option value="profit">Profit Withdrawal</option>
                  <option value="capital_return">Capital Return</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Amount *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => validateAmount(e.target.value)}
                    className={inputCls} style={{ background: bgInput, borderColor: warn ? '#ef444460' : borderLight }} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }} />
                </div>
              </div>
              {warn && <p className="text-xs" style={{ color: '#f59e0b' }}>{warn}</p>}
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Note</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="Optional note" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={submitWithdrawal}
                disabled={!form.companyId || !form.amount || Number(form.amount) <= 0}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: '#34d39922', border: '1px solid #34d39955', color: '#34d399' }}>
                Process Withdrawal
              </button>
              <button onClick={() => setActiveForm(null)} className="px-4 py-2 rounded-lg text-sm" style={{ background: bgElevated, color: textSecondary }}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
