import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getFinancialData, getInvestors, getCompanies } from '../../store/financialStore';
import { getInvestorWallet, getCompanyWallet, buildTimeline, fmt, fmtDate } from '../../utils/financial/calculations';
import type { Investor, InvestorWallet, FinancialTimelineEvent, LedgerEntryType } from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const TYPE_ICONS: Record<LedgerEntryType, string> = {
  capital_in: '💰',
  capital_return: '🔄',
  inventory_purchase: '📦',
  inventory_adjustment: '🔧',
  sale: '🛒',
  marketplace_holding: '⏳',
  marketplace_released: '🏦',
  marketplace_available: '✅',
  profit_earned: '📈',
  profit_withdrawn: '💸',
  adjustment: '⚙️',
};

const TYPE_COLORS: Record<LedgerEntryType, string> = {
  capital_in: '#60a5fa',
  capital_return: '#34d399',
  inventory_purchase: '#f59e0b',
  inventory_adjustment: '#6b7280',
  sale: '#a78bfa',
  marketplace_holding: '#f59e0b',
  marketplace_released: '#eab308',
  marketplace_available: '#00e5ff',
  profit_earned: '#34d399',
  profit_withdrawn: '#22c55e',
  adjustment: '#6b7280',
};

function WalletMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: bgElevated }}>
      <p className="text-[10px] mb-1" style={{ color: textMuted }}>{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

export default function InvestorDashboard() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [wallet, setWallet] = useState<InvestorWallet | null>(null);
  const [timeline, setTimeline] = useState<FinancialTimelineEvent[]>([]);
  const [companyWallets, setCompanyWallets] = useState<{ name: string; capitalInvested: number; profitEarned: number; profitPaid: number }[]>([]);

  const reload = () => {
    const invs = getInvestors();
    setInvestors(invs);
    if (invs.length > 0 && !selectedId) setSelectedId(invs[0].id);
  };
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (!selectedId) { setWallet(null); setTimeline([]); return; }
    const data = getFinancialData();
    const companies = getCompanies();
    setWallet(getInvestorWallet(data, selectedId));
    setTimeline(buildTimeline(data, selectedId));

    const investorCompanyIds = [...new Set(
      data.capitalTransactions.filter(t => t.investorId === selectedId).map(t => t.companyId)
    )];
    const cws = investorCompanyIds.map(cid => {
      const co = companies.find(c => c.id === cid);
      const cw = getCompanyWallet(data, cid);
      return { name: co?.name ?? cid, capitalInvested: cw.capitalInvested, profitEarned: cw.profitAvailable, profitPaid: cw.profitPaid };
    });
    setCompanyWallets(cws);
  }, [selectedId]);

  if (investors.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-white mb-4">Investor Dashboard</h1>
        <div className="rounded-xl border p-12 text-center" style={{ background: bgCard, borderColor: border }}>
          <p style={{ color: textMuted }} className="text-sm">No investors found. Add investors in Investor Management first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Investor Dashboard</h1>
          <p className="text-sm" style={{ color: textMuted }}>Live wallet and financial timeline per investor.</p>
        </div>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white outline-none border"
          style={{ background: bgCard, borderColor: border, minWidth: 200 }}>
          {investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      {wallet && (
        <>
          {/* Wallet Metrics */}
          <div className="rounded-xl border p-5 space-y-4" style={{ background: bgCard, borderColor: border }}>
            <h2 className="font-semibold text-white">Investor Wallet — {investors.find(i => i.id === selectedId)?.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <WalletMetric label="Capital Invested" value={fmt(wallet.capitalInvested)} color="#60a5fa" />
              <WalletMetric label="Capital Returned" value={fmt(wallet.capitalReturned)} color="#34d399" />
              <WalletMetric label="Remaining Capital" value={fmt(wallet.remainingCapital)} color="#f59e0b" />
              <WalletMetric label="ROI" value={`${wallet.roi.toFixed(2)}%`} color={wallet.roi >= 0 ? '#34d399' : '#ef4444'} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <WalletMetric label="Inventory Value" value={fmt(wallet.inventoryValue)} color="#a78bfa" />
              <WalletMetric label="Recovered Inventory" value={fmt(wallet.recoveredInventory)} color="#6b7280" />
              <WalletMetric label="Marketplace Available" value={fmt(wallet.marketplaceFundsAvailable)} color="#00e5ff" />
              <WalletMetric label="Marketplace Pending" value={fmt(wallet.marketplaceFundsPending)} color="#f59e0b" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <WalletMetric label="Profit Earned" value={fmt(wallet.profitEarned)} color="#34d399" />
              <WalletMetric label="Profit Paid" value={fmt(wallet.profitPaid)} color="#22c55e" />
              <WalletMetric label="Outstanding Profit" value={fmt(wallet.outstandingProfit)} color={wallet.outstandingProfit > 0 ? '#f59e0b' : '#4b5563'} />
            </div>
          </div>

          {/* Per-Company Breakdown */}
          {companyWallets.length > 0 && (
            <div className="rounded-xl border p-5 space-y-3" style={{ background: bgCard, borderColor: border }}>
              <h2 className="font-semibold text-white">Per-Company Breakdown</h2>
              <div className="space-y-2">
                {companyWallets.map(cw => (
                  <div key={cw.name} className="rounded-lg px-4 py-3 border grid grid-cols-4 gap-2 text-sm"
                    style={{ background: bgElevated, borderColor: borderLight }}>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: textMuted }}>Company</p>
                      <p className="font-medium text-white">{cw.name}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: textMuted }}>Capital Invested</p>
                      <p className="font-medium" style={{ color: '#60a5fa' }}>{fmt(cw.capitalInvested)}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: textMuted }}>Profit Earned</p>
                      <p className="font-medium" style={{ color: '#34d399' }}>{fmt(cw.profitEarned)}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: textMuted }}>Profit Paid</p>
                      <p className="font-medium" style={{ color: '#22c55e' }}>{fmt(cw.profitPaid)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border p-5 space-y-3" style={{ background: bgCard, borderColor: border }}>
            <h2 className="font-semibold text-white">Financial Timeline</h2>
            {timeline.length === 0 && (
              <p className="text-sm py-6 text-center" style={{ color: textMuted }}>No timeline events yet.</p>
            )}
            <div className="space-y-1.5">
              {timeline.map((evt, i) => (
                <motion.div key={evt.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 border" style={{ background: bgElevated, borderColor: borderLight }}>
                  <div className="flex items-center gap-3">
                    <span className="text-base">{TYPE_ICONS[evt.type]}</span>
                    <div>
                      <p className="text-sm text-white">{evt.description}</p>
                      <p className="text-xs" style={{ color: textMuted }}>{fmtDate(evt.date)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold ml-4" style={{ color: TYPE_COLORS[evt.type] }}>{fmt(evt.amount)}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Statement Summary */}
          <div className="rounded-xl border p-5" style={{ background: bgCard, borderColor: border }}>
            <h2 className="font-semibold text-white mb-4">Statement Summary — {investors.find(i => i.id === selectedId)?.name}</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Total Capital Invested', value: fmt(wallet.capitalInvested) },
                { label: 'Total Capital Returned', value: fmt(wallet.capitalReturned) },
                { label: 'Remaining Capital at Risk', value: fmt(wallet.remainingCapital) },
                { label: 'Total Profit Earned', value: fmt(wallet.profitEarned) },
                { label: 'Total Profit Paid', value: fmt(wallet.profitPaid) },
                { label: 'Outstanding Profit Owed', value: fmt(wallet.outstandingProfit) },
                { label: 'Return on Investment', value: `${wallet.roi.toFixed(2)}%` },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-1.5 border-b" style={{ borderColor: borderLight }}>
                  <span style={{ color: textSecondary }}>{row.label}</span>
                  <span className="font-medium text-white">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
