import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getMarketplaceSettlements, addMarketplaceSettlement, advanceSettlementStage, deleteSettlement,
  getCompanies, getInventoryItems,
} from '../../store/financialStore';
import { fmt, fmtDate } from '../../utils/financial/calculations';
import type { MarketplaceSettlement, MarketplaceSettlementStage, FinancialCompany, InventoryItem } from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const bgInput = 'var(--t-in,#1f3344)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const STAGES: MarketplaceSettlementStage[] = [
  'sale', 'delivered', 'marketplace_holding', 'marketplace_released',
  'available', 'capital_recovery', 'profit_available', 'withdrawn',
];

const STAGE_LABELS: Record<MarketplaceSettlementStage, string> = {
  sale: 'Sale',
  delivered: 'Delivered',
  marketplace_holding: 'Marketplace Holding',
  marketplace_released: 'Marketplace Released',
  available: 'Available',
  capital_recovery: 'Capital Recovery',
  profit_available: 'Profit Available',
  withdrawn: 'Withdrawn',
};

const STAGE_COLORS: Record<MarketplaceSettlementStage, string> = {
  sale: '#6b7280',
  delivered: '#60a5fa',
  marketplace_holding: '#f59e0b',
  marketplace_released: '#eab308',
  available: '#00e5ff',
  capital_recovery: '#a78bfa',
  profit_available: '#34d399',
  withdrawn: '#10b981',
};

const inputCls = `w-full px-3 py-2 rounded-lg text-sm text-white outline-none border focus:border-cyan-glow/50 transition-colors`;

const EMPTY_FORM = {
  companyId: '',
  marketplace: '',
  saleRef: '',
  amount: '',
  stage: 'sale' as MarketplaceSettlementStage,
  inventoryItemId: '',
  quantity: '1',
  cog: '',
};

export default function MarketplacePayoutEngine() {
  const [settlements, setSettlements] = useState<MarketplaceSettlement[]>([]);
  const [companies, setCompanies] = useState<FinancialCompany[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCo, setFilterCo] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = () => {
    setSettlements(getMarketplaceSettlements());
    setCompanies(getCompanies());
    setInventoryItems(getInventoryItems());
  };
  useEffect(() => { reload(); }, []);

  const filtered = settlements.filter(s =>
    (!filterCo || s.companyId === filterCo) &&
    (!filterStage || s.stage === filterStage)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Inventory items filtered to the selected company
  const companyInventory = inventoryItems.filter(
    i => !form.companyId || i.companyId === form.companyId
  );

  const selectedItem = form.inventoryItemId
    ? inventoryItems.find(i => i.id === form.inventoryItemId)
    : null;

  // Auto-computed COG when inventory item is selected
  const autoCog = selectedItem ? (Number(form.quantity) || 1) * selectedItem.unitCost : null;

  const addS = () => {
    if (!form.companyId || !form.marketplace || !form.amount || Number(form.amount) <= 0) return;
    const inventoryItemId = form.inventoryItemId || undefined;
    const quantity = inventoryItemId ? (Number(form.quantity) || 1) : undefined;
    const cog = autoCog ?? (form.cog ? Number(form.cog) : undefined);

    addMarketplaceSettlement({
      companyId: form.companyId,
      marketplace: form.marketplace,
      saleRef: form.saleRef || undefined,
      amount: Number(form.amount),
      stage: form.stage,
      inventoryItemId,
      quantity,
      cog,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    reload();
  };

  const advance = (id: string, current: MarketplaceSettlementStage) => {
    const idx = STAGES.indexOf(current);
    if (idx < STAGES.length - 1) {
      advanceSettlementStage(id, STAGES[idx + 1]);
      reload();
    }
  };

  const remove = (id: string) => {
    if (!window.confirm('Delete this settlement record? Inventory stock will be restored if linked.')) return;
    deleteSettlement(id);
    reload();
  };

  const coName = (id: string) => companies.find(c => c.id === id)?.name ?? id;
  const itemBySaleId = (s: MarketplaceSettlement) =>
    s.inventoryItemId ? inventoryItems.find(i => i.id === s.inventoryItemId) : null;

  // Pipeline summary
  const pipelineSummary = STAGES.map(stage => ({
    stage,
    count: settlements.filter(s => s.stage === stage).length,
    total: settlements.filter(s => s.stage === stage).reduce((a, s) => a + s.amount, 0),
  }));

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Marketplace Payout Engine</h1>
          <p className="text-sm" style={{ color: textMuted }}>Money moves through fixed stages — nothing skips a stage.</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}
          className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#00e5ff22', border: '1px solid #00e5ff44', color: '#00e5ff' }}>
          + Add Settlement
        </button>
      </div>

      {/* Pipeline Overview */}
      <div className="rounded-xl border p-4 overflow-x-auto" style={{ background: bgCard, borderColor: border }}>
        <p className="text-xs font-medium mb-3" style={{ color: textMuted }}>Pipeline Overview</p>
        <div className="flex gap-2 min-w-max">
          {pipelineSummary.map((s, i) => (
            <div key={s.stage} className="flex items-center gap-2">
              <div className="rounded-lg px-3 py-2.5 text-center min-w-[100px] border" style={{ background: bgElevated, borderColor: borderLight }}>
                <p className="text-[10px] mb-1" style={{ color: STAGE_COLORS[s.stage] }}>{STAGE_LABELS[s.stage]}</p>
                <p className="text-sm font-bold text-white">{s.count}</p>
                {s.total > 0 && <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>{fmt(s.total)}</p>}
              </div>
              {i < pipelineSummary.length - 1 && <span style={{ color: textMuted }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border p-4" style={{ background: bgCard, borderColor: border }}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <select value={filterCo} onChange={e => setFilterCo(e.target.value)}
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      {/* Settlement List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border p-12 text-center" style={{ background: bgCard, borderColor: border }}>
            <p className="text-sm" style={{ color: textMuted }}>No settlements found.</p>
          </div>
        )}
        {filtered.map(s => {
          const linkedItem = itemBySaleId(s);
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    className="text-xs w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ color: textSecondary, background: bgElevated }}>
                    {expandedId === s.id ? '▼' : '▶'}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{s.marketplace}</span>
                      <span className="text-xs" style={{ color: textMuted }}>{coName(s.companyId)}</span>
                      {s.saleRef && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: bgElevated, color: textMuted }}>
                          ref: {s.saleRef}
                        </span>
                      )}
                      {linkedItem && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: '#34d39915', color: '#34d399', border: '1px solid #34d39930' }}>
                          📦 {linkedItem.sku}
                        </span>
                      )}
                      {s.quantity && <span className="text-xs" style={{ color: textMuted }}>×{s.quantity}</span>}
                      {s.cog != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f8717115', color: '#f87171' }}>
                          COGS {fmt(s.cog)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: STAGE_COLORS[s.stage] + '20', color: STAGE_COLORS[s.stage], border: `1px solid ${STAGE_COLORS[s.stage]}40` }}>
                        {STAGE_LABELS[s.stage]}
                      </span>
                      <span className="text-xs" style={{ color: textMuted }}>{fmtDate(s.createdAt.split('T')[0])}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <span className="font-semibold text-white">{fmt(s.amount)}</span>
                  {s.stage !== 'withdrawn' && (
                    <button onClick={() => advance(s.id, s.stage)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                      style={{ background: '#00e5ff15', border: '1px solid #00e5ff30', color: '#00e5ff' }}>
                      → {STAGE_LABELS[STAGES[STAGES.indexOf(s.stage) + 1]]}
                    </button>
                  )}
                  <button onClick={() => remove(s.id)} className="text-xs px-1.5 py-1 rounded" style={{ background: '#ef444415', color: '#ef4444' }}>✕</button>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === s.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t px-4 py-3 overflow-hidden" style={{ borderColor: borderLight }}>
                    {linkedItem && (
                      <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: '#34d39908', border: '1px solid #34d39920' }}>
                        <p className="font-medium mb-1" style={{ color: '#34d399' }}>Inventory Link</p>
                        <div className="flex gap-4 flex-wrap" style={{ color: textSecondary }}>
                          <span>SKU: <span className="text-white font-mono">{linkedItem.sku}</span></span>
                          <span>Name: <span className="text-white">{linkedItem.name}</span></span>
                          <span>Qty Sold: <span className="text-white">{s.quantity ?? 1}</span></span>
                          <span>Unit Cost: <span className="text-white">{fmt(linkedItem.unitCost)}</span></span>
                          <span>COGS: <span className="font-semibold" style={{ color: '#f87171' }}>{fmt((s.quantity ?? 1) * linkedItem.unitCost)}</span></span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs font-medium mb-2" style={{ color: textMuted }}>Stage History</p>
                    <div className="space-y-1.5">
                      {s.stageHistory.map((h, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="px-2 py-0.5 rounded-full" style={{ background: STAGE_COLORS[h.stage] + '20', color: STAGE_COLORS[h.stage] }}>
                            {STAGE_LABELS[h.stage]}
                          </span>
                          <span style={{ color: textMuted }}>{new Date(h.timestamp).toLocaleString()}</span>
                          {h.note && <span style={{ color: textSecondary }}>{h.note}</span>}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-2xl border p-6 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <h3 className="font-semibold text-white">Add Marketplace Settlement</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Company *</label>
                <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value, inventoryItemId: '' }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                  <option value="">Select company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Marketplace *</label>
                <input value={form.marketplace} onChange={e => setForm(f => ({ ...f, marketplace: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="e.g. Amazon, Daraz, eBay" />
              </div>

              {/* Inventory Item (optional) */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>
                  Inventory Item (optional — links sale to stock)
                </label>
                <select value={form.inventoryItemId} onChange={e => setForm(f => ({ ...f, inventoryItemId: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                  <option value="">No inventory link</option>
                  {companyInventory.map(i => (
                    <option key={i.id} value={i.id}>
                      [{i.sku}] {i.name} — stock: {i.currentQty} @ {fmt(i.unitCost)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity (shown when inventory linked) */}
              {form.inventoryItemId && (
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Units Sold *</label>
                  <input type="number" min="1" step="1" value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }} />
                  {autoCog != null && (
                    <p className="text-xs mt-1" style={{ color: textMuted }}>
                      Auto COGS: <span className="font-medium" style={{ color: '#f87171' }}>{fmt(autoCog)}</span>
                      &nbsp;({form.quantity} × {selectedItem ? fmt(selectedItem.unitCost) : '—'}) · locked from inventory
                    </p>
                  )}
                </div>
              )}

              {/* Manual COG (only when no inventory linked) */}
              {!form.inventoryItemId && (
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>COGS / Unit Cost (optional)</label>
                  <input type="number" min="0" step="0.01" value={form.cog}
                    onChange={e => setForm(f => ({ ...f, cog: e.target.value }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="0.00" />
                </div>
              )}

              <div>
                <label className="text-xs mb-1 block" style={{ color: textMuted }}>Sale Reference (optional)</label>
                <input value={form.saleRef} onChange={e => setForm(f => ({ ...f, saleRef: e.target.value }))}
                  className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="Order ID or reference" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Sale Amount *</label>
                  <input type="number" min="0" step="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: textMuted }}>Starting Stage</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as MarketplaceSettlementStage }))}
                    className={inputCls} style={{ background: bgInput, borderColor: borderLight }}>
                    {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>

              {/* Preview */}
              {form.amount && autoCog != null && (
                <div className="rounded-lg px-3 py-2 text-xs space-y-1" style={{ background: bgElevated }}>
                  <div className="flex justify-between" style={{ color: textSecondary }}>
                    <span>Sale Amount</span><span className="text-white">{fmt(Number(form.amount))}</span>
                  </div>
                  <div className="flex justify-between" style={{ color: textSecondary }}>
                    <span>COGS</span><span style={{ color: '#f87171' }}>− {fmt(autoCog)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1" style={{ borderColor: borderLight, color: textSecondary }}>
                    <span>Gross Profit</span>
                    <span style={{ color: Number(form.amount) - autoCog >= 0 ? '#34d399' : '#ef4444' }}>
                      {fmt(Number(form.amount) - autoCog)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={addS} disabled={!form.companyId || !form.marketplace || !form.amount || Number(form.amount) <= 0}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: '#00e5ff22', border: '1px solid #00e5ff55', color: '#00e5ff' }}>
                Add Settlement
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: bgElevated, color: textSecondary }}>
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
