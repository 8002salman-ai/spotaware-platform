import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getFinancialData, getCompanies, deleteSaleReship, updateSaleReship, getInventoryItems } from '../../store/financialStore';
import { computeGrossReshipCost, computeNetReshipLoss, fmt, fmtDate } from '../../utils/financial/calculations';
import type {
  SaleReship, MarketplaceSettlement, FinancialCompany, InventoryItem,
  ReshipDeliveryStatus, SupplierClaimStatus,
} from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const bgInput = 'var(--t-in,#1f3344)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const DELIVERY_COLORS: Record<ReshipDeliveryStatus, string> = {
  pending: '#6b7280', shipped: '#60a5fa', delivered: '#34d399', returned: '#f59e0b', lost: '#ef4444',
};

const CLAIM_COLORS: Record<SupplierClaimStatus, string> = {
  none: '#6b7280', pending: '#f59e0b', submitted: '#60a5fa', approved: '#a78bfa', rejected: '#ef4444', paid: '#34d399',
};

const inputCls = `w-full px-3 py-2 rounded-lg text-sm text-white outline-none border transition-colors`;

type ReshipRow = SaleReship & {
  sale?: MarketplaceSettlement;
  companyName?: string;
  itemSku?: string;
  grossCost: number;
  netLoss: number;
};

interface EditState {
  reshipId: string;
  deliveryStatus: ReshipDeliveryStatus;
  supplierClaimStatus: SupplierClaimStatus;
  supplierRecoveredAmount: string;
  recoveryDate: string;
  notes: string;
}

export default function ReshipEngine() {
  const [rows, setRows] = useState<ReshipRow[]>([]);
  const [companies, setCompanies] = useState<FinancialCompany[]>([]);
  const [filterCo, setFilterCo] = useState('');
  const [filterDelivery, setFilterDelivery] = useState('');
  const [filterClaim, setFilterClaim] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  const reload = () => {
    const data = getFinancialData();
    const cos = getCompanies();
    const items = getInventoryItems();
    setCompanies(cos);

    const mapped: ReshipRow[] = (data.saleReships ?? []).map(r => {
      const sale = data.marketplaceSettlements.find(s => s.id === r.saleId);
      const co = sale ? cos.find(c => c.id === sale.companyId) : undefined;
      const item: InventoryItem | undefined = r.inventoryItemId ? items.find(i => i.id === r.inventoryItemId) : undefined;
      return {
        ...r,
        sale,
        companyName: co?.name,
        itemSku: item?.sku,
        grossCost: computeGrossReshipCost(r),
        netLoss: computeNetReshipLoss(r),
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    setRows(mapped);
  };

  useEffect(() => { reload(); }, []);

  const filtered = rows.filter(r =>
    (!filterCo || r.sale?.companyId === filterCo) &&
    (!filterDelivery || r.deliveryStatus === filterDelivery) &&
    (!filterClaim || r.supplierClaimStatus === filterClaim)
  );

  // Aggregate metrics from filtered rows
  const totalGross = filtered.reduce((a, r) => a + r.grossCost, 0);
  const totalRecovery = filtered.reduce((a, r) => a + r.supplierRecoveredAmount, 0);
  const totalNet = filtered.reduce((a, r) => a + r.netLoss, 0);

  // Top reasons
  const reasonCounts: Record<string, number> = {};
  filtered.forEach(r => { reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1; });
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const startEdit = (r: ReshipRow) => {
    setEditState({
      reshipId: r.reshipId,
      deliveryStatus: r.deliveryStatus,
      supplierClaimStatus: r.supplierClaimStatus,
      supplierRecoveredAmount: String(r.supplierRecoveredAmount),
      recoveryDate: r.recoveryDate ?? '',
      notes: r.notes ?? '',
    });
  };

  const saveEdit = () => {
    if (!editState) return;
    updateSaleReship(editState.reshipId, {
      deliveryStatus: editState.deliveryStatus,
      supplierClaimStatus: editState.supplierClaimStatus,
      supplierRecoveredAmount: Number(editState.supplierRecoveredAmount) || 0,
      recoveryDate: editState.recoveryDate || undefined,
      notes: editState.notes || undefined,
    });
    setEditState(null);
    reload();
  };

  const removeReship = (reshipId: string) => {
    if (!window.confirm('Delete this reship? Inventory stock will be restored if linked.')) return;
    deleteSaleReship(reshipId);
    reload();
  };

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Reship Engine</h1>
        <p className="text-sm" style={{ color: textMuted }}>Track replacement shipments, shipping costs, supplier recovery, and net company loss per sale.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Reships', value: String(filtered.length), color: '#f97316', icon: '↩️' },
          { label: 'Gross Reship Cost', value: fmt(totalGross), color: '#ef4444', icon: '💸' },
          { label: 'Supplier Recovery', value: fmt(totalRecovery), color: '#34d399', icon: '🔄' },
          { label: 'Net Company Loss', value: fmt(totalNet), color: '#f59e0b', icon: '⚠️' },
        ].map(m => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border p-4" style={{ background: bgCard, borderColor: borderLight }}>
            <div className="flex items-center gap-2 mb-2">
              <span>{m.icon}</span>
              <p className="text-xs" style={{ color: textMuted }}>{m.label}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: m.color }}>{m.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Avg loss card if reships exist */}
      {filtered.length > 0 && (
        <div className="rounded-xl border p-4 flex items-center gap-4" style={{ background: bgCard, borderColor: borderLight }}>
          <span className="text-2xl">📉</span>
          <div>
            <p className="text-xs mb-0.5" style={{ color: textMuted }}>Avg Net Loss per Reship</p>
            <p className="text-lg font-bold" style={{ color: '#f59e0b' }}>{fmt(filtered.length > 0 ? totalNet / filtered.length : 0)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ background: bgCard, borderColor: border }}>
        <select value={filterCo} onChange={e => setFilterCo(e.target.value)}
          className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterDelivery} onChange={e => setFilterDelivery(e.target.value)}
          className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
          <option value="">All Delivery Statuses</option>
          {(['pending', 'shipped', 'delivered', 'returned', 'lost'] as ReshipDeliveryStatus[]).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select value={filterClaim} onChange={e => setFilterClaim(e.target.value)}
          className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
          <option value="">All Claim Statuses</option>
          {(['none', 'pending', 'submitted', 'approved', 'rejected', 'paid'] as SupplierClaimStatus[]).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Top Reasons */}
      {topReasons.length > 0 && (
        <div className="rounded-xl border p-5 space-y-3" style={{ background: bgCard, borderColor: border }}>
          <h2 className="font-semibold text-white">Top Reship Reasons</h2>
          <div className="space-y-2">
            {topReasons.map(([reason, count]) => (
              <div key={reason} className="flex items-center gap-3">
                <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: bgElevated }}>
                  <div className="h-2 rounded-full" style={{ width: `${(count / filtered.length) * 100}%`, background: '#f97316' }} />
                </div>
                <span className="text-xs w-36 truncate" style={{ color: textSecondary }}>{reason}</span>
                <span className="text-xs font-medium text-white w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reship List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border p-12 text-center" style={{ background: bgCard, borderColor: border }}>
            <p className="text-sm" style={{ color: textMuted }}>
              {rows.length === 0 ? 'No reships recorded yet. Add reships from the Marketplace Payouts page.' : 'No reships match the current filters.'}
            </p>
          </div>
        )}

        {filtered.map(r => (
          <motion.div key={r.reshipId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
            {/* Row Header */}
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setExpandedId(expandedId === r.reshipId ? null : r.reshipId)}
                  className="text-xs w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ color: textSecondary, background: bgElevated }}>
                  {expandedId === r.reshipId ? '▼' : '▶'}
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">↩️ Reship #{r.reshipNumber}</span>
                    {r.sale && <span className="text-xs" style={{ color: textMuted }}>{r.sale.marketplace}{r.sale.saleRef ? ` · ${r.sale.saleRef}` : ''}</span>}
                    {r.companyName && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: bgElevated, color: textMuted }}>{r.companyName}</span>}
                    {r.itemSku && <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: '#34d39915', color: '#34d399' }}>📦 {r.itemSku} ×{r.qty}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: DELIVERY_COLORS[r.deliveryStatus] + '20', color: DELIVERY_COLORS[r.deliveryStatus], border: `1px solid ${DELIVERY_COLORS[r.deliveryStatus]}40` }}>
                      {r.deliveryStatus}
                    </span>
                    {r.supplierClaimStatus !== 'none' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: CLAIM_COLORS[r.supplierClaimStatus] + '20', color: CLAIM_COLORS[r.supplierClaimStatus], border: `1px solid ${CLAIM_COLORS[r.supplierClaimStatus]}40` }}>
                        claim: {r.supplierClaimStatus}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: textMuted }}>{fmtDate(r.reshipDate)}</span>
                    <span className="text-xs" style={{ color: textMuted }}>{r.reason}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs" style={{ color: textMuted }}>Gross / Net Loss</p>
                  <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>{fmt(r.grossCost)} <span style={{ color: textMuted }}>/</span> <span style={{ color: '#f59e0b' }}>{fmt(r.netLoss)}</span></p>
                </div>
                <button onClick={() => startEdit(r)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#00e5ff15', border: '1px solid #00e5ff30', color: '#00e5ff' }}>
                  Edit
                </button>
                <button onClick={() => removeReship(r.reshipId)} className="text-xs px-1.5 py-1 rounded" style={{ background: '#ef444415', color: '#ef4444' }}>✕</button>
              </div>
            </div>

            {/* Expanded Detail */}
            {expandedId === r.reshipId && (
              <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: borderLight }}>
                {/* Cost Breakdown */}
                <div className="rounded-lg p-3 space-y-1.5 text-xs" style={{ background: bgElevated }}>
                  <p className="font-medium mb-2 text-white">Cost Breakdown</p>
                  {[
                    { label: 'Shipping Label', value: r.costs.shippingLabelCost },
                    { label: `Replacement Product × ${r.qty}`, value: r.costs.replacementProductCost * r.qty },
                    { label: 'Packaging', value: r.costs.packagingCost },
                    { label: 'Insurance', value: r.costs.insuranceCost },
                    { label: 'Other', value: r.costs.otherCost },
                  ].filter(l => l.value > 0).map(l => (
                    <div key={l.label} className="flex justify-between" style={{ color: textSecondary }}>
                      <span>{l.label}</span><span className="text-white">{fmt(l.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-medium border-t pt-1.5" style={{ borderColor: borderLight, color: textSecondary }}>
                    <span>Gross Total</span><span style={{ color: '#ef4444' }}>{fmt(r.grossCost)}</span>
                  </div>
                  {r.supplierRecoveredAmount > 0 && (
                    <div className="flex justify-between" style={{ color: textSecondary }}>
                      <span>Supplier Recovery</span><span style={{ color: '#34d399' }}>− {fmt(r.supplierRecoveredAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold" style={{ color: textSecondary }}>
                    <span>Net Loss</span><span style={{ color: '#f59e0b' }}>{fmt(r.netLoss)}</span>
                  </div>
                </div>

                {/* Shipping Label Metadata */}
                {(r.costs.trackingNumber || r.costs.shippingProvider || r.costs.labelPurchasedDate || r.costs.labelPdfUrl) && (
                  <div className="rounded-lg p-3 text-xs space-y-1.5" style={{ background: bgElevated }}>
                    <p className="font-medium mb-1.5 text-white">Shipping Label</p>
                    {r.costs.shippingProvider && (
                      <div className="flex gap-2" style={{ color: textSecondary }}>
                        <span>Provider:</span><span className="text-white">{r.costs.shippingProvider}</span>
                      </div>
                    )}
                    {r.costs.trackingNumber && (
                      <div className="flex gap-2" style={{ color: textSecondary }}>
                        <span>Tracking:</span><span className="text-white font-mono">{r.costs.trackingNumber}</span>
                      </div>
                    )}
                    {r.costs.labelPurchasedDate && (
                      <div className="flex gap-2" style={{ color: textSecondary }}>
                        <span>Purchased:</span><span className="text-white">{fmtDate(r.costs.labelPurchasedDate)}</span>
                      </div>
                    )}
                    {r.costs.labelPdfUrl && (
                      <div className="flex gap-2" style={{ color: textSecondary }}>
                        <span>Label URL:</span>
                        <a href={r.costs.labelPdfUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: '#00e5ff' }}>View</a>
                      </div>
                    )}
                  </div>
                )}

                {r.notes && (
                  <p className="text-xs" style={{ color: textSecondary }}>Notes: {r.notes}</p>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Edit Modal */}
      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <h3 className="font-semibold text-white">Edit Reship</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Delivery Status</label>
                <select value={editState.deliveryStatus}
                  onChange={e => setEditState(s => s ? { ...s, deliveryStatus: e.target.value as ReshipDeliveryStatus } : s)}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                  {(['pending', 'shipped', 'delivered', 'returned', 'lost'] as ReshipDeliveryStatus[]).map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Supplier Claim Status</label>
                <select value={editState.supplierClaimStatus}
                  onChange={e => setEditState(s => s ? { ...s, supplierClaimStatus: e.target.value as SupplierClaimStatus } : s)}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                  {(['none', 'pending', 'submitted', 'approved', 'rejected', 'paid'] as SupplierClaimStatus[]).map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Supplier Recovered Amount</label>
                <input type="number" min="0" step="0.01" value={editState.supplierRecoveredAmount}
                  onChange={e => setEditState(s => s ? { ...s, supplierRecoveredAmount: e.target.value } : s)}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Recovery Date</label>
                <input type="date" value={editState.recoveryDate}
                  onChange={e => setEditState(s => s ? { ...s, recoveryDate: e.target.value } : s)}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Notes</label>
                <input value={editState.notes}
                  onChange={e => setEditState(s => s ? { ...s, notes: e.target.value } : s)}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={saveEdit} className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#00e5ff22', border: '1px solid #00e5ff55', color: '#00e5ff' }}>
                Save Changes
              </button>
              <button onClick={() => setEditState(null)} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: bgElevated, color: textSecondary }}>
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
