import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  getInvestors, addInvestor, updateInvestor, deleteInvestor,
  getCompanies, addCompany, updateCompany, deleteCompany,
  getCapitalTransactions,
} from '../../store/financialStore';
import { fmt } from '../../utils/financial/calculations';
import type { Investor, FinancialCompany } from '../../types/financial';

const bg = 'var(--t-bg,#0f1923)';
const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const bgInput = 'var(--t-in,#1f3344)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const inputCls = `w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-cyan-glow/50 transition-colors`;

export default function InvestorManagement() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [companies, setCompanies] = useState<FinancialCompany[]>([]);
  const [capitalTotals, setCapitalTotals] = useState<Record<string, number>>({});

  // Investor form
  const [showInvForm, setShowInvForm] = useState(false);
  const [editInvId, setEditInvId] = useState<string | null>(null);
  const [invForm, setInvForm] = useState({ name: '', email: '', phone: '', notes: '' });

  // Company form
  const [showCoForm, setShowCoForm] = useState(false);
  const [editCoId, setEditCoId] = useState<string | null>(null);
  const [coForm, setCoForm] = useState({ name: '', currency: 'USD', baseCurrency: 'USD', notes: '' });

  const reload = () => {
    const inv = getInvestors();
    const co = getCompanies();
    const txs = getCapitalTransactions();
    setInvestors(inv);
    setCompanies(co);
    const totals: Record<string, number> = {};
    inv.forEach(i => {
      totals[i.id] = txs
        .filter(t => t.investorId === i.id && t.type === 'capital_in')
        .reduce((a, t) => a + t.amount, 0);
    });
    setCapitalTotals(totals);
  };

  useEffect(() => { reload(); }, []);

  const openAddInv = () => { setEditInvId(null); setInvForm({ name: '', email: '', phone: '', notes: '' }); setShowInvForm(true); };
  const openEditInv = (inv: Investor) => { setEditInvId(inv.id); setInvForm({ name: inv.name, email: inv.email ?? '', phone: inv.phone ?? '', notes: inv.notes ?? '' }); setShowInvForm(true); };
  const saveInvestor = () => {
    if (!invForm.name.trim()) return;
    if (editInvId) {
      updateInvestor(editInvId, { name: invForm.name, email: invForm.email || undefined, phone: invForm.phone || undefined, notes: invForm.notes || undefined });
    } else {
      addInvestor({ name: invForm.name, email: invForm.email || undefined, phone: invForm.phone || undefined, notes: invForm.notes || undefined });
    }
    setShowInvForm(false);
    reload();
  };
  const removeInvestor = (id: string, name: string) => {
    if (!window.confirm(`Delete investor "${name}"? All associated capital records will remain but won't link to this investor.`)) return;
    deleteInvestor(id);
    reload();
  };

  const openAddCo = () => { setEditCoId(null); setCoForm({ name: '', currency: 'USD', baseCurrency: 'USD', notes: '' }); setShowCoForm(true); };
  const openEditCo = (co: FinancialCompany) => { setEditCoId(co.id); setCoForm({ name: co.name, currency: co.currency, baseCurrency: co.baseCurrency, notes: co.notes ?? '' }); setShowCoForm(true); };
  const saveCompany = () => {
    if (!coForm.name.trim()) return;
    if (editCoId) {
      updateCompany(editCoId, { name: coForm.name, currency: coForm.currency, baseCurrency: coForm.baseCurrency, notes: coForm.notes || undefined });
    } else {
      addCompany({ name: coForm.name, currency: coForm.currency, baseCurrency: coForm.baseCurrency, notes: coForm.notes || undefined });
    }
    setShowCoForm(false);
    reload();
  };
  const removeCompany = (id: string, name: string) => {
    if (!window.confirm(`Delete company "${name}"?`)) return;
    deleteCompany(id);
    reload();
  };

  return (
    <div className="space-y-8" style={{ background: bg, minHeight: '100%', padding: '1.5rem' }}>
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Investor Management</h1>
        <p style={{ color: textMuted }} className="text-sm">Manage investors and companies. Relationship tracked at transaction level.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Investors ── */}
        <div className="rounded-xl border p-5 space-y-4" style={{ background: bgCard, borderColor: border }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Investors</h2>
            <button onClick={openAddInv} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#00e5ff22', border: '1px solid #00e5ff44', color: '#00e5ff' }}>
              + Add Investor
            </button>
          </div>

          {investors.length === 0 && (
            <p className="text-sm py-6 text-center" style={{ color: textMuted }}>No investors yet. Add one to get started.</p>
          )}

          <div className="space-y-2">
            {investors.map(inv => (
              <motion.div key={inv.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-lg px-3 py-3 border" style={{ background: bgElevated, borderColor: borderLight }}>
                <div>
                  <p className="text-sm font-medium text-white">{inv.name}</p>
                  {inv.email && <p className="text-xs mt-0.5" style={{ color: textMuted }}>{inv.email}</p>}
                  {capitalTotals[inv.id] > 0 && (
                    <span className="text-xs mt-1 inline-block px-2 py-0.5 rounded-full" style={{ background: '#00e5ff15', color: '#00e5ff', border: '1px solid #00e5ff30' }}>
                      {fmt(capitalTotals[inv.id])} invested
                    </span>
                  )}
                </div>
                <div className="flex gap-2 ml-3">
                  <button onClick={() => openEditInv(inv)} className="text-xs px-2 py-1 rounded" style={{ background: bgInput, color: textSecondary }}>Edit</button>
                  <button onClick={() => removeInvestor(inv.id, inv.name)} className="text-xs px-2 py-1 rounded" style={{ background: '#ef444415', color: '#ef4444' }}>Del</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Companies ── */}
        <div className="rounded-xl border p-5 space-y-4" style={{ background: bgCard, borderColor: border }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Companies</h2>
            <button onClick={openAddCo} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#a78bfa22', border: '1px solid #a78bfa44', color: '#a78bfa' }}>
              + Add Company
            </button>
          </div>

          {companies.length === 0 && (
            <p className="text-sm py-6 text-center" style={{ color: textMuted }}>No companies yet. Add one (e.g. Embani LLC, Luxedge, Himalayan Koh).</p>
          )}

          <div className="space-y-2">
            {companies.map(co => (
              <motion.div key={co.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-lg px-3 py-3 border" style={{ background: bgElevated, borderColor: borderLight }}>
                <div>
                  <p className="text-sm font-medium text-white">{co.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: textMuted }}>{co.currency} · base {co.baseCurrency}</p>
                  {co.notes && <p className="text-xs mt-0.5" style={{ color: textMuted }}>{co.notes}</p>}
                </div>
                <div className="flex gap-2 ml-3">
                  <button onClick={() => openEditCo(co)} className="text-xs px-2 py-1 rounded" style={{ background: bgInput, color: textSecondary }}>Edit</button>
                  <button onClick={() => removeCompany(co.id, co.name)} className="text-xs px-2 py-1 rounded" style={{ background: '#ef444415', color: '#ef4444' }}>Del</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Investor Form Modal ── */}
      {showInvForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <h3 className="font-semibold text-white">{editInvId ? 'Edit Investor' : 'Add Investor'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Name *</label>
                <input value={invForm.name} onChange={e => setInvForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: border }} placeholder="Investor name" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Email</label>
                <input value={invForm.email} onChange={e => setInvForm(f => ({ ...f, email: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: border }} placeholder="investor@email.com" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Phone</label>
                <input value={invForm.phone} onChange={e => setInvForm(f => ({ ...f, phone: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: border }} placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Notes</label>
                <textarea value={invForm.notes} onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: border }} rows={2} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={saveInvestor} disabled={!invForm.name.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ background: '#00e5ff22', border: '1px solid #00e5ff55', color: '#00e5ff' }}>
                {editInvId ? 'Save Changes' : 'Add Investor'}
              </button>
              <button onClick={() => setShowInvForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: bgInput, color: textSecondary }}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Company Form Modal ── */}
      {showCoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <h3 className="font-semibold text-white">{editCoId ? 'Edit Company' : 'Add Company'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Company Name *</label>
                <input value={coForm.name} onChange={e => setCoForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: border }} placeholder="e.g. Embani LLC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Currency</label>
                  <input value={coForm.currency} onChange={e => setCoForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    className={inputCls} style={{ background: bgInput, borderColor: border }} placeholder="USD" maxLength={3} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Base Currency</label>
                  <input value={coForm.baseCurrency} onChange={e => setCoForm(f => ({ ...f, baseCurrency: e.target.value.toUpperCase() }))}
                    className={inputCls} style={{ background: bgInput, borderColor: border }} placeholder="USD" maxLength={3} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Notes</label>
                <textarea value={coForm.notes} onChange={e => setCoForm(f => ({ ...f, notes: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: border }} rows={2} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={saveCompany} disabled={!coForm.name.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: '#a78bfa22', border: '1px solid #a78bfa55', color: '#a78bfa' }}>
                {editCoId ? 'Save Changes' : 'Add Company'}
              </button>
              <button onClick={() => setShowCoForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: bgInput, color: textSecondary }}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
