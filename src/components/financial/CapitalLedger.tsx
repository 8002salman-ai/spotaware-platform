import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  getCapitalTransactions, addCapitalTransaction, deleteCapitalTransaction,
  getInvestors, getCompanies,
} from '../../store/financialStore';
import { fmt, fmtDate } from '../../utils/financial/calculations';
import type { CapitalTransaction, CapitalTransactionType, Investor, FinancialCompany } from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const bgInput = 'var(--t-in,#1f3344)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const TYPE_COLORS: Record<CapitalTransactionType, string> = {
  capital_in: '#34d399',
  capital_return: '#60a5fa',
  inventory_purchase: '#f59e0b',
  inventory_adjustment: '#6b7280',
};

const TYPE_LABELS: Record<CapitalTransactionType, string> = {
  capital_in: 'Capital In',
  capital_return: 'Capital Return',
  inventory_purchase: 'Inventory Purchase',
  inventory_adjustment: 'Inventory Adjustment',
};

const inputCls = `w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-cyan-glow/50 transition-colors`;

const EMPTY_FORM = { investorId: '', companyId: '', type: 'capital_in' as CapitalTransactionType, amount: '', date: new Date().toISOString().split('T')[0], note: '' };

export default function CapitalLedger() {
  const [txs, setTxs] = useState<CapitalTransaction[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [companies, setCompanies] = useState<FinancialCompany[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterInv, setFilterInv] = useState('');
  const [filterCo, setFilterCo] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const reload = () => {
    setTxs(getCapitalTransactions());
    setInvestors(getInvestors());
    setCompanies(getCompanies());
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => txs.filter(t =>
    (!filterInv || t.investorId === filterInv) &&
    (!filterCo || t.companyId === filterCo) &&
    (!filterType || t.type === filterType) &&
    (!filterFrom || t.date >= filterFrom) &&
    (!filterTo || t.date <= filterTo)
  ).sort((a, b) => b.date.localeCompare(a.date)), [txs, filterInv, filterCo, filterType, filterFrom, filterTo]);

  const summary = useMemo(() => ({
    capitalIn: txs.filter(t => t.type === 'capital_in').reduce((a, t) => a + t.amount, 0),
    capitalReturn: txs.filter(t => t.type === 'capital_return').reduce((a, t) => a + t.amount, 0),
    inventory: txs.filter(t => t.type === 'inventory_purchase').reduce((a, t) => a + t.amount, 0),
  }), [txs]);

  const addTx = () => {
    if (!form.investorId || !form.companyId || !form.amount || Number(form.amount) <= 0) return;
    addCapitalTransaction({
      investorId: form.investorId,
      companyId: form.companyId,
      type: form.type,
      amount: Number(form.amount),
      note: form.note || undefined,
      date: form.date,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    reload();
  };

  const removeTx = (id: string) => {
    if (!window.confirm('Delete this capital transaction and its ledger entry?')) return;
    deleteCapitalTransaction(id);
    reload();
  };

  const invName = (id: string) => investors.find(i => i.id === id)?.name ?? id;
  const coName = (id: string) => companies.find(c => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Capital Ledger</h1>
          <p className="text-sm" style={{ color: textMuted }}>Capital and Profit are permanently separate. This ledger tracks Capital only.</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}
          className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#34d39922', border: '1px solid #34d39944', color: '#34d399' }}>
          + Add Transaction
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Capital Invested', value: fmt(summary.capitalIn), color: '#34d399' },
          { label: 'Capital Returned', value: fmt(summary.capitalReturn), color: '#60a5fa' },
          { label: 'Inventory Purchased', value: fmt(summary.inventory), color: '#f59e0b' },
          { label: 'Outstanding Capital', value: fmt(Math.max(0, summary.capitalIn - summary.capitalReturn)), color: '#00e5ff' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border p-4" style={{ background: bgCard, borderColor: borderLight }}>
            <p className="text-xs mb-1" style={{ color: textMuted }}>{s.label}</p>
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border p-4" style={{ background: bgCard, borderColor: border }}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
            {(Object.keys(TYPE_LABELS) as CapitalTransactionType[]).map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }} />
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        <div className="grid text-xs font-medium px-4 py-2.5 border-b" style={{ borderColor: borderLight, color: textMuted, gridTemplateColumns: '110px 1fr 1fr 140px 100px 1fr 40px' }}>
          <span>Date</span><span>Investor</span><span>Company</span><span>Type</span><span>Amount</span><span>Note</span><span></span>
        </div>
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm" style={{ color: textMuted }}>No capital transactions match the current filters.</p>
        )}
        {filtered.map((tx, i) => (
          <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="grid items-center px-4 py-3 border-b text-sm" style={{ borderColor: borderLight, gridTemplateColumns: '110px 1fr 1fr 140px 100px 1fr 40px' }}>
            <span style={{ color: textMuted }}>{fmtDate(tx.date)}</span>
            <span className="text-white truncate pr-2">{invName(tx.investorId)}</span>
            <span className="truncate pr-2" style={{ color: textSecondary }}>{coName(tx.companyId)}</span>
            <span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: TYPE_COLORS[tx.type] + '20', color: TYPE_COLORS[tx.type], border: `1px solid ${TYPE_COLORS[tx.type]}40` }}>
                {TYPE_LABELS[tx.type]}
              </span>
            </span>
            <span className="font-medium text-white">{fmt(tx.amount)}</span>
            <span className="text-xs truncate pr-2" style={{ color: textMuted }}>{tx.note ?? '—'}</span>
            <button onClick={() => removeTx(tx.id)} className="text-xs px-1.5 py-1 rounded" style={{ background: '#ef444415', color: '#ef4444' }}>✕</button>
          </motion.div>
        ))}
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <h3 className="font-semibold text-white">Add Capital Transaction</h3>
            {investors.length === 0 || companies.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: '#f59e0b' }}>
                ⚠️ Please add at least one investor and one company before adding a transaction.
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
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Type *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CapitalTransactionType }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                    {(Object.keys(TYPE_LABELS) as CapitalTransactionType[]).map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
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
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="Optional description" />
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={addTx}
                disabled={!form.investorId || !form.companyId || !form.amount || Number(form.amount) <= 0}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: '#34d39922', border: '1px solid #34d39955', color: '#34d399' }}>
                Add Transaction
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: bgElevated, color: textSecondary }}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
