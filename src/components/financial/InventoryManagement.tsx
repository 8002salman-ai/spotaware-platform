import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getInventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem,
  getStockMovements, getCompanies, getInvestors, runInventoryReconciliation,
} from '../../store/financialStore';
import { fmt, fmtDate } from '../../utils/financial/calculations';
import type {
  InventoryItem, FinancialCompany, Investor, ReconciliationReport, StockMovement,
} from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const bgInput = 'var(--t-in,#1f3344)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const inputCls = `w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-cyan-glow/50 transition-colors`;

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_IN: 'Purchase In',
  SALE_OUT: 'Sale Out',
  ADJUSTMENT: 'Adjustment',
  RETURN_IN: 'Return In',
};
const MOVEMENT_COLORS: Record<string, string> = {
  PURCHASE_IN: '#34d399',
  SALE_OUT: '#f87171',
  ADJUSTMENT: '#fbbf24',
  RETURN_IN: '#60a5fa',
};

const EMPTY_FORM = {
  companyId: '', investorId: '', sku: '', name: '', description: '',
  unitCost: '', purchasedQty: '', currency: 'USD', capitalTransactionId: '',
};

export default function InventoryManagement() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [companies, setCompanies] = useState<FinancialCompany[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCo, setFilterCo] = useState('');
  const [filterInv, setFilterInv] = useState('');
  const [running, setRunning] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const reload = () => {
    setItems(getInventoryItems());
    setCompanies(getCompanies());
    setInvestors(getInvestors());
    setMovements(getStockMovements());
  };

  useEffect(() => { reload(); }, []);

  const filtered = items.filter(i =>
    (!filterCo || i.companyId === filterCo) &&
    (!filterInv || i.investorId === filterInv)
  );

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setForm({
      companyId: item.companyId,
      investorId: item.investorId,
      sku: item.sku,
      name: item.name,
      description: item.description ?? '',
      unitCost: String(item.unitCost),
      purchasedQty: String(item.purchasedQty),
      currency: item.currency,
      capitalTransactionId: item.capitalTransactionId ?? '',
    });
    setShowForm(true);
  };

  const saveForm = () => {
    if (!form.companyId || !form.investorId || !form.sku || !form.name || !form.unitCost || !form.purchasedQty) return;
    if (editItem) {
      updateInventoryItem(editItem.id, {
        companyId: form.companyId,
        investorId: form.investorId,
        sku: form.sku,
        name: form.name,
        description: form.description || undefined,
        unitCost: Number(form.unitCost),
        purchasedQty: Number(form.purchasedQty),
        currency: form.currency,
        capitalTransactionId: form.capitalTransactionId || undefined,
      });
    } else {
      addInventoryItem({
        companyId: form.companyId,
        investorId: form.investorId,
        sku: form.sku,
        name: form.name,
        description: form.description || undefined,
        unitCost: Number(form.unitCost),
        purchasedQty: Number(form.purchasedQty),
        currency: form.currency,
        capitalTransactionId: form.capitalTransactionId || undefined,
      });
    }
    setShowForm(false);
    setEditItem(null);
    reload();
  };

  const handleDelete = (id: string) => {
    setDeleteError('');
    const ok = deleteInventoryItem(id);
    if (!ok) {
      setDeleteError('Cannot delete: this item has linked sales or stock movements.');
    } else {
      reload();
    }
  };

  const handleReconcile = () => {
    setRunning(true);
    setTimeout(() => {
      const r = runInventoryReconciliation();
      setReport(r);
      reload();
      setRunning(false);
    }, 0);
  };

  const coName = (id: string) => companies.find(c => c.id === id)?.name ?? id;
  const invName = (id: string) => investors.find(i => i.id === id)?.name ?? id;

  const totalInventoryValue = items.reduce((a, i) => a + i.currentQty * i.unitCost, 0);
  const totalSoldValue = items.reduce((a, i) => a + i.soldQty * i.unitCost, 0);
  const totalItems = items.length;

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Inventory Management</h1>
          <p className="text-sm" style={{ color: textMuted }}>
            SKU-level stock tracking — Unsold inventory is an asset, not withdrawable.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReconcile} disabled={running}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: '#a78bfa22', border: '1px solid #a78bfa44', color: '#a78bfa' }}>
            {running ? '⟳ Running…' : '⚡ Run Reconciliation'}
          </button>
          <button onClick={openAdd}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#00e5ff22', border: '1px solid #00e5ff44', color: '#00e5ff' }}>
            + Add Item
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total SKUs', value: String(totalItems), color: '#00e5ff' },
          { label: 'Current Stock Value', value: fmt(totalInventoryValue), color: '#34d399' },
          { label: 'Sold Value (COGS)', value: fmt(totalSoldValue), color: '#f87171' },
          { label: 'Total Purchased Value', value: fmt(totalInventoryValue + totalSoldValue), color: '#a78bfa' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border p-4" style={{ background: bgCard, borderColor: border }}>
            <p className="text-xs mb-1" style={{ color: textMuted }}>{c.label}</p>
            <p className="text-lg font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Reconciliation Report */}
      <AnimatePresence>
        {report && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border p-5 space-y-4" style={{ background: bgCard, borderColor: '#a78bfa44' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: '#a78bfa' }}>⚡ Reconciliation Report</h2>
              <button onClick={() => setReport(null)} className="text-xs" style={{ color: textMuted }}>✕ Close</button>
            </div>

            {/* 12-point summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '1. Historical Sales Scanned', value: report.historicalSalesScanned },
                { label: '2. Inventory-Linked Sales', value: report.inventoryLinkedSalesFound },
                { label: '3. Stock Movements Created', value: report.stockMovementsCreated, highlight: report.stockMovementsCreated > 0 },
                { label: '4. Duplicate Movements Skipped', value: report.duplicateMovementsSkipped },
                { label: '5. Products Updated', value: report.productsUpdated, highlight: report.productsUpdated > 0 },
              ].map(s => (
                <div key={s.label} className="rounded-lg border p-3" style={{ background: bgElevated, borderColor: borderLight }}>
                  <p className="text-[10px] mb-1" style={{ color: textMuted }}>{s.label}</p>
                  <p className="text-lg font-bold" style={{ color: s.highlight ? '#34d399' : 'white' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Before / After comparison */}
            {report.inventoryBefore.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: textMuted }}>6-11. Inventory Before → After</p>
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: borderLight }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: bgElevated }}>
                        {['SKU', 'Name', 'Sold (Before)', 'Sold (After)', 'Stock (Before)', 'Stock (After)', 'Value (Before)', 'Value (After)'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: textMuted }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.inventoryBefore.map((b, idx) => {
                        const a = report.inventoryAfter[idx];
                        if (!a) return null;
                        const changed = b.soldQty !== a.soldQty;
                        return (
                          <tr key={b.id} style={{ borderTop: `1px solid ${borderLight}`, background: changed ? '#34d39908' : 'transparent' }}>
                            <td className="px-3 py-2 font-mono text-white">{b.sku}</td>
                            <td className="px-3 py-2" style={{ color: textSecondary }}>{b.name}</td>
                            <td className="px-3 py-2 text-white">{b.soldQty}</td>
                            <td className="px-3 py-2 font-semibold" style={{ color: changed ? '#34d399' : 'white' }}>{a.soldQty}</td>
                            <td className="px-3 py-2 text-white">{b.currentQty}</td>
                            <td className="px-3 py-2 font-semibold" style={{ color: changed ? '#34d399' : 'white' }}>{a.currentQty}</td>
                            <td className="px-3 py-2 text-white">{fmt(b.inventoryValue)}</td>
                            <td className="px-3 py-2 font-semibold" style={{ color: changed ? '#34d399' : 'white' }}>{fmt(a.inventoryValue)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 12. Investor Inventory Reconciliation */}
            <div className="rounded-lg border p-3" style={{ background: bgElevated, borderColor: borderLight }}>
              <p className="text-xs font-medium mb-2" style={{ color: textMuted }}>12. Investor Inventory Reconciliation</p>
              {items.length === 0 ? (
                <p className="text-xs" style={{ color: textMuted }}>No inventory items found.</p>
              ) : (
                <div className="space-y-1.5">
                  {[...new Set(items.map(i => i.investorId))].map(invId => {
                    const investorItems = items.filter(i => i.investorId === invId);
                    const unsoldValue = investorItems.reduce((a, i) => a + i.currentQty * i.unitCost, 0);
                    const soldValue = investorItems.reduce((a, i) => a + i.soldQty * i.unitCost, 0);
                    return (
                      <div key={invId} className="flex items-center justify-between text-xs">
                        <span style={{ color: textSecondary }}>{invName(invId)}</span>
                        <span style={{ color: textMuted }}>
                          Unsold asset: <span className="text-white font-medium">{fmt(unsoldValue)}</span>
                          &nbsp;·&nbsp;Sold COGS: <span className="font-medium" style={{ color: '#f87171' }}>{fmt(soldValue)}</span>
                          &nbsp;·&nbsp;SKUs: <span className="text-white">{investorItems.length}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 13. Remaining Issues */}
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: textMuted }}>13. Remaining Issues</p>
              {report.remainingIssues.length === 0 ? (
                <p className="text-xs" style={{ color: '#34d399' }}>✓ No issues found.</p>
              ) : (
                <ul className="space-y-1">
                  {report.remainingIssues.map((issue, i) => (
                    <li key={i} className="text-xs px-3 py-1.5 rounded" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>
                      ⚠ {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {deleteError && (
        <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>
          {deleteError}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border p-4" style={{ background: bgCard, borderColor: border }}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <select value={filterCo} onChange={e => setFilterCo(e.target.value)}
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterInv} onChange={e => setFilterInv(e.target.value)}
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
            <option value="">All Investors</option>
            {investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border p-12 text-center" style={{ background: bgCard, borderColor: border }}>
            <p className="text-2xl mb-3">📦</p>
            <p className="text-sm font-medium text-white mb-1">No inventory items yet</p>
            <p className="text-xs" style={{ color: textMuted }}>Add your first inventory item to start tracking stock.</p>
          </div>
        )}

        {filtered.map(item => {
          const itemMovements = movements.filter(m => m.inventoryItemId === item.id);
          const isExpanded = expandedId === item.id;
          const stockPct = item.purchasedQty > 0 ? (item.currentQty / item.purchasedQty) * 100 : 0;
          const isLow = item.currentQty > 0 && stockPct < 20;
          const isOut = item.currentQty === 0;

          return (
            <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
              <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => { setExpandedId(isExpanded ? null : item.id); setDeleteError(''); }}
                    className="text-xs w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ color: textSecondary, background: bgElevated }}>
                    {isExpanded ? '▼' : '▶'}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: bgElevated, color: '#00e5ff' }}>{item.sku}</span>
                      <span className="text-sm font-medium text-white">{item.name}</span>
                      {isOut && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#ef444420', color: '#ef4444' }}>OUT OF STOCK</span>}
                      {isLow && !isOut && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#f59e0b20', color: '#f59e0b' }}>LOW STOCK</span>}
                      {item.capitalTransactionId && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: bgElevated, color: textMuted }}>linked</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs flex-wrap" style={{ color: textMuted }}>
                      <span>{coName(item.companyId)}</span>
                      <span>·</span>
                      <span>{invName(item.investorId)}</span>
                      <span>·</span>
                      <span>{fmtDate(item.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[10px]" style={{ color: textMuted }}>Purchased</p>
                    <p className="text-sm font-semibold text-white">{item.purchasedQty}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px]" style={{ color: textMuted }}>Sold</p>
                    <p className="text-sm font-semibold" style={{ color: '#f87171' }}>{item.soldQty}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px]" style={{ color: textMuted }}>Stock</p>
                    <p className="text-sm font-semibold" style={{ color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#34d399' }}>{item.currentQty}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px]" style={{ color: textMuted }}>Unit Cost</p>
                    <p className="text-sm font-semibold text-white">{fmt(item.unitCost)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px]" style={{ color: textMuted }}>Value</p>
                    <p className="text-sm font-semibold" style={{ color: '#00e5ff' }}>{fmt(item.currentQty * item.unitCost)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(item)}
                      className="text-xs px-2.5 py-1 rounded-lg" style={{ background: bgElevated, color: textSecondary }}>Edit</button>
                    <button onClick={() => handleDelete(item.id)}
                      className="text-xs px-2.5 py-1 rounded-lg" style={{ background: '#ef444415', color: '#ef4444' }}>✕</button>
                  </div>
                </div>
              </div>

              {/* Stock progress bar */}
              <div className="px-4 pb-2">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: bgElevated }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, stockPct)}%`, background: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#34d399' }} />
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t overflow-hidden" style={{ borderColor: borderLight }}>
                    <div className="px-4 py-3">
                      <p className="text-xs font-medium mb-2" style={{ color: textMuted }}>
                        Stock Movements ({itemMovements.length})
                      </p>
                      {itemMovements.length === 0 ? (
                        <p className="text-xs" style={{ color: textMuted }}>No stock movements recorded.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {itemMovements
                            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                            .map(m => (
                              <div key={m.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
                                style={{ background: bgElevated }}>
                                <div className="flex items-center gap-3">
                                  <span className="px-2 py-0.5 rounded-full font-medium"
                                    style={{ background: (MOVEMENT_COLORS[m.type] ?? '#888') + '20', color: MOVEMENT_COLORS[m.type] ?? '#888' }}>
                                    {MOVEMENT_LABELS[m.type] ?? m.type}
                                  </span>
                                  <span className="font-semibold text-white">×{m.qty}</span>
                                  {m.isReconciliation && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#a78bfa20', color: '#a78bfa' }}>reconciled</span>
                                  )}
                                  {m.note && <span style={{ color: textMuted }}>{m.note}</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span style={{ color: textMuted }}>{fmt(m.totalValue)}</span>
                                  <span style={{ color: textMuted }}>{fmtDate(m.date)}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* SKU verification summary */}
                      <div className="mt-3 rounded-lg p-3 text-xs space-y-1" style={{ background: '#00e5ff08', border: '1px solid #00e5ff20' }}>
                        <p className="font-medium" style={{ color: '#00e5ff' }}>Verification: {item.sku}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2" style={{ color: textSecondary }}>
                          <span>Purchased: <span className="text-white font-medium">{item.purchasedQty}</span></span>
                          <span>Sold: <span className="font-medium" style={{ color: '#f87171' }}>{item.soldQty}</span></span>
                          <span>Current Stock: <span className="font-medium" style={{ color: item.currentQty > 0 ? '#34d399' : '#ef4444' }}>{item.currentQty}</span></span>
                          <span>Inventory Value: <span className="font-medium" style={{ color: '#00e5ff' }}>{fmt(item.currentQty * item.unitCost)}</span></span>
                        </div>
                        <div className="grid grid-cols-2 gap-2" style={{ color: textSecondary }}>
                          <span>Unit Cost: <span className="text-white font-medium">{fmt(item.unitCost)}</span></span>
                          <span>Total COGS Sold: <span className="font-medium" style={{ color: '#f87171' }}>{fmt(item.soldQty * item.unitCost)}</span></span>
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: textMuted }}>
                          Formula: {item.purchasedQty} purchased − {item.soldQty} sold = {item.currentQty} remaining · {item.currentQty} × {fmt(item.unitCost)} = {fmt(item.currentQty * item.unitCost)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-2xl border p-6 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <h3 className="font-semibold text-white">{editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Company *</label>
                <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                  <option value="">Select…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Investor / Owner *</label>
                <select value={form.investorId} onChange={e => setForm(f => ({ ...f, investorId: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                  <option value="">Select…</option>
                  {investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>SKU *</label>
                <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}
                  placeholder="e.g. FASS-001" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Product Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}
                  placeholder="e.g. FASS Filters" />
              </div>
            </div>

            <div>
              <label className="text-xs mb-1 block" style={{ color: textMuted }}>Description (optional)</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={inputCls} style={{ background: bgInput, borderColor: borderLight }}
                placeholder="Product description" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Unit Cost *</label>
                <input type="number" min="0" step="0.01" value={form.unitCost}
                  onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Purchased Qty *</label>
                <input type="number" min="0" step="1" value={form.purchasedQty}
                  onChange={e => setForm(f => ({ ...f, purchasedQty: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="0" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Currency</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                  <option>USD</option>
                  <option>PKR</option>
                  <option>AED</option>
                </select>
              </div>
            </div>

            {form.unitCost && form.purchasedQty && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: bgElevated, color: textSecondary }}>
                Total purchase value: <span className="text-white font-semibold">
                  {fmt(Number(form.unitCost) * Number(form.purchasedQty))}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs mb-1 block" style={{ color: textMuted }}>Capital Transaction ID (optional — links to purchase record)</label>
              <input value={form.capitalTransactionId} onChange={e => setForm(f => ({ ...f, capitalTransactionId: e.target.value }))}
                className={inputCls} style={{ background: bgInput, borderColor: borderLight }}
                placeholder="ctx_…" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={saveForm}
                disabled={!form.companyId || !form.investorId || !form.sku || !form.name || !form.unitCost || !form.purchasedQty}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: '#00e5ff22', border: '1px solid #00e5ff55', color: '#00e5ff' }}>
                {editItem ? 'Save Changes' : 'Add Item'}
              </button>
              <button onClick={() => { setShowForm(false); setEditItem(null); }}
                className="px-4 py-2 rounded-lg text-sm" style={{ background: bgElevated, color: textSecondary }}>
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
