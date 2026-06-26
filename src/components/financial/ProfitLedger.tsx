import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  getProfitWithdrawals, addProfitWithdrawal, deleteWithdrawal,
  getInvestors, getCompanies, getFinancialData,
} from '../../store/financialStore';
import { fmt, fmtDate } from '../../utils/financial/calculations';
import type { ProfitWithdrawal, WithdrawalType, Investor, FinancialCompany } from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const bgInput = 'var(--t-in,#1f3344)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const inputCls = `w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-cyan-glow/50 transition-colors`;

const EMPTY_FORM = { investorId: '', companyId: '', withdrawalType: 'profit' as WithdrawalType, amount: '', date: new Date().toISOString().split('T')[0], note: '' };

export default function ProfitLedger() {
  const [withdrawals, setWithdrawals] = useState<ProfitWithdrawal[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [companies, setCompanies] = useState<FinancialCompany[]>([]);
  const [migrationH, setMigrationH] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterInv, setFilterInv] = useState('');
  const [filterCo, setFilterCo] = useState('');
  const [filterType, setFilterType] = useState('');

  const reload = () => {
    setWithdrawals(getProfitWithdrawals());
    setInvestors(getInvestors());
    setCompanies(getCompanies());
    setMigrationH(getFinancialData()._migrationH);
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => withdrawals.filter(w =>
    (!filterInv || w.investorId === filterInv) &&
    (!filterCo || w.companyId === filterCo) &&
    (!filterType || w.withdrawalType === filterType)
  ).sort((a, b) => b.date.localeCompare(a.date)), [withdrawals, filterInv, filterCo, filterType]);

  const summary = useMemo(() => ({
    profitPaid: withdrawals.filter(w => w.withdrawalType === 'profit').reduce((a, w) => a + w.amount, 0),
    capitalReturn: withdrawals.filter(w => w.withdrawalType === 'capital_return').reduce((a, w) => a + w.amount, 0),
  }), [withdrawals]);

  const addW = () => {
    if (!form.investorId || !form.companyId || !form.amount || Number(form.amount) <= 0) return;
    addProfitWithdrawal({
      investorId: form.investorId,
      companyId: form.companyId,
      withdrawalType: form.withdrawalType,
      amount: Number(form.amount),
      note: form.note || undefined,
      date: form.date,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    reload();
  };

  const removeW = (id: string) => {
    if (!window.confirm('Delete this withdrawal record?')) return;
    deleteWithdrawal(id);
    reload();
  };

  const invName = (id: string) => investors.find(i => i.id === id)?.name ?? id;
  const coName = (id: string) => companies.find(c => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Profit Ledger</h1>
          <p className="text-sm" style={{ color: textMuted }}>Profit and Capital are permanently separate. This ledger tracks Profit Withdrawals only.</p>
        </div>
        <div className="flex items-center gap-3">
          {migrationH && (
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: '#34d39920', color: '#34d399', border: '1px solid #34d39940' }}>
              ✓ Migration H Applied
            </span>
          )}
          <button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}
            className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#34d39922', border: '1px solid #34d39944', color: '#34d399' }}>
            + Add Withdrawal
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Profit Withdrawn', value: fmt(summary.profitPaid), color: '#34d399' },
          { label: 'Capital Returned', value: fmt(summary.capitalReturn), color: '#60a5fa' },
          { label: 'Grand Total', value: fmt(summary.profitPaid + summary.capitalReturn), color: '#00e5ff' },
          { label: 'Total Records', value: String(withdrawals.length), color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border p-4" style={{ background: bgCard, borderColor: borderLight }}>
            <p className="text-xs mb-1" style={{ color: textMuted }}>{s.label}</p>
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border p-4" style={{ background: bgCard, borderColor: border }}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <select value={filterInv} onChange={e => setFilterInv(e.target.value)}
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
            <option value="">All Investors</option>
            {investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select value={filterCo} onChange={e => setFilterCo(e.target.value)}
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
            <option value="">All Types</option>
            <option value="profit">Profit Withdrawal</option>
            <option value="capital_return">Capital Return</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        <div className="grid text-xs font-medium px-4 py-2.5 border-b" style={{ borderColor: borderLight, color: textMuted, gridTemplateColumns: '110px 1fr 1fr 140px 100px 1fr 40px' }}>
          <span>Date</span><span>Investor</span><span>Company</span><span>Type</span><span>Amount</span><span>Note</span><span></span>
        </div>
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm" style={{ color: textMuted }}>No withdrawal records found.</p>
        )}
        {filtered.map((w, i) => (
          <motion.div key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="grid items-center px-4 py-3 border-b text-sm" style={{ borderColor: borderLight, gridTemplateColumns: '110px 1fr 1fr 140px 100px 1fr 40px' }}>
            <span style={{ color: textMuted }}>{fmtDate(w.date)}</span>
            <span className="text-white truncate pr-2">{invName(w.investorId)}</span>
            <span className="truncate pr-2" style={{ color: textSecondary }}>{coName(w.companyId)}</span>
            <span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={w.withdrawalType === 'profit'
                  ? { background: '#34d39920', color: '#34d399', border: '1px solid #34d39940' }
                  : { background: '#60a5fa20', color: '#60a5fa', border: '1px solid #60a5fa40' }}>
                {w.withdrawalType === 'profit' ? 'Profit' : 'Capital Return'}
              </span>
            </span>
            <span className="font-medium text-white">{fmt(w.amount)}</span>
            <span className="text-xs truncate pr-2" style={{ color: textMuted }}>{w.note ?? '—'}</span>
            <button onClick={() => removeW(w.id)} className="text-xs px-1.5 py-1 rounded" style={{ background: '#ef444415', color: '#ef4444' }}>✕</button>
          </motion.div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <h3 className="font-semibold text-white">Add Withdrawal</h3>
            {investors.length === 0 || companies.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: '#f59e0b' }}>
                ⚠️ Please add at least one investor and one company first.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Investor *</label>
                  <select value={form.investorId} onChange={e => setForm(f => ({ ...f, investorId: e.target.value }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                    <option value="">Select investor…</option>
                    {investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Company *</label>
                  <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                    <option value="">Select company…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Withdrawal Type *</label>
                  <select value={form.withdrawalType} onChange={e => setForm(f => ({ ...f, withdrawalType: e.target.value as WithdrawalType }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                    <option value="profit">Profit Withdrawal</option>
                    <option value="capital_return">Capital Return</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: textMuted }}>Amount *</label>
                    <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: textMuted }}>Date *</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className={inputCls} style={{ background: bgInput, borderColor: borderLight }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Note</label>
                  <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="Optional note" />
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={addW} disabled={!form.investorId || !form.companyId || !form.amount || Number(form.amount) <= 0}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: '#34d39922', border: '1px solid #34d39955', color: '#34d399' }}>
                Add Withdrawal
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: bgElevated, color: textSecondary }}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
