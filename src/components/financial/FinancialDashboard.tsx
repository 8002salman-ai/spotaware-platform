import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getFinancialData } from '../../store/financialStore';
import { getFinancialSummary, getLedgerView, fmt, fmtDate } from '../../utils/financial/calculations';
import type { FinancialSummary, CompanyWallet, LedgerEntry, LedgerEntryType } from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const LEDGER_ICONS: Record<LedgerEntryType, string> = {
  capital_in: '💰', capital_return: '🔄', inventory_purchase: '📦', inventory_adjustment: '🔧',
  sale: '🛒', marketplace_holding: '⏳', marketplace_released: '🏦', marketplace_available: '✅',
  profit_earned: '📈', profit_withdrawn: '💸', adjustment: '⚙️',
};

const LEDGER_COLORS: Record<LedgerEntryType, string> = {
  capital_in: '#60a5fa', capital_return: '#34d399', inventory_purchase: '#f59e0b', inventory_adjustment: '#6b7280',
  sale: '#a78bfa', marketplace_holding: '#f59e0b', marketplace_released: '#eab308',
  marketplace_available: '#00e5ff', profit_earned: '#34d399', profit_withdrawn: '#22c55e', adjustment: '#6b7280',
};

const NAV_LINKS = [
  { href: '/financial/investors', label: 'Investors & Companies', icon: '👥' },
  { href: '/financial/capital', label: 'Capital Ledger', icon: '💰' },
  { href: '/financial/profit', label: 'Profit Ledger', icon: '📈' },
  { href: '/financial/withdrawals', label: 'Withdrawal Engine', icon: '💸' },
  { href: '/financial/marketplace', label: 'Marketplace Payouts', icon: '🛒' },
  { href: '/financial/investor-dashboard', label: 'Investor Dashboard', icon: '📊' },
  { href: '/financial/company-wallet', label: 'Company Wallets', icon: '🏦' },
  { href: '/financial/reports', label: 'Financial Reports', icon: '📋' },
];

export default function FinancialDashboard() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [migrationH, setMigrationH] = useState(false);

  useEffect(() => {
    const data = getFinancialData();
    setSummary(getFinancialSummary(data));
    setLedger(getLedgerView(data).slice(0, 15));
    setMigrationH(data._migrationH);
  }, []);

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Financial Dashboard</h1>
        <p className="text-sm" style={{ color: textMuted }}>Enterprise Financial Engine — Command Center</p>
      </div>

      {migrationH && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#34d39912', border: '1px solid #34d39930', color: '#34d399' }}>
          ✓ Migration H applied — all historical withdrawals have been backfilled with withdrawalType.
        </div>
      )}

      {!summary || (summary.companyCount === 0 && summary.investorCount === 0) ? (
        <div className="rounded-xl border p-12 text-center space-y-4" style={{ background: bgCard, borderColor: border }}>
          <p className="text-white font-semibold">Welcome to the Enterprise Financial Engine</p>
          <p style={{ color: textMuted }} className="text-sm">Start by adding companies and investors, then record capital transactions to begin tracking.</p>
          <button onClick={() => { window.location.href = '/financial/investors'; }}
            className="px-6 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#00e5ff22', border: '1px solid #00e5ff44', color: '#00e5ff' }}>
            Get Started → Add Companies & Investors
          </button>
        </div>
      ) : (
        <>
          {/* Primary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Capital Invested', value: fmt(summary.totalCapitalInvested), color: '#60a5fa', icon: '💰' },
              { label: 'Total Capital Returned', value: fmt(summary.totalCapitalReturned), color: '#34d399', icon: '🔄' },
              { label: 'Outstanding Capital', value: fmt(summary.totalOutstandingCapital), color: '#f59e0b', icon: '⚡' },
              { label: 'Total Profit Paid', value: fmt(summary.totalProfitPaid), color: '#22c55e', icon: '📈' },
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

          {/* Secondary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Marketplace Balance', value: fmt(summary.totalMarketplaceBalance), color: '#00e5ff', icon: '🏦' },
              { label: 'Marketplace Pending', value: fmt(summary.totalMarketplacePending), color: '#f59e0b', icon: '⏳' },
              { label: 'Active Settlements', value: String(summary.activeSettlements), color: '#a78bfa', icon: '🔄' },
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

          {/* Counts */}
          <div className="flex gap-3 flex-wrap">
            <span className="px-3 py-1.5 rounded-full text-sm" style={{ background: bgCard, border: `1px solid ${borderLight}`, color: textSecondary }}>
              👥 {summary.investorCount} investor{summary.investorCount !== 1 ? 's' : ''}
            </span>
            <span className="px-3 py-1.5 rounded-full text-sm" style={{ background: bgCard, border: `1px solid ${borderLight}`, color: textSecondary }}>
              🏢 {summary.companyCount} compan{summary.companyCount !== 1 ? 'ies' : 'y'}
            </span>
          </div>

          {/* Company Wallets Grid */}
          {summary.wallets.length > 0 && (
            <div className="rounded-xl border p-5 space-y-3" style={{ background: bgCard, borderColor: border }}>
              <h2 className="font-semibold text-white">Company Wallets</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {summary.wallets.map((w: CompanyWallet) => (
                  <button key={w.companyId} onClick={() => { window.location.href = '/financial/company-wallet'; }}
                    className="rounded-xl border p-4 text-left space-y-2 hover:bg-white/[0.02] transition-colors"
                    style={{ background: bgElevated, borderColor: borderLight }}>
                    <p className="font-medium text-white">{w.companyName}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span style={{ color: textMuted }}>Outstanding</span><br /><span style={{ color: '#f59e0b' }}>{fmt(w.outstandingCapital)}</span></div>
                      <div><span style={{ color: textMuted }}>Profit Avail</span><br /><span style={{ color: '#34d399' }}>{fmt(w.profitAvailable)}</span></div>
                      <div><span style={{ color: textMuted }}>Profit Paid</span><br /><span style={{ color: '#22c55e' }}>{fmt(w.profitPaid)}</span></div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {ledger.length > 0 && (
            <div className="rounded-xl border p-5 space-y-3" style={{ background: bgCard, borderColor: border }}>
              <h2 className="font-semibold text-white">Recent Activity</h2>
              <div className="space-y-1.5">
                {ledger.map(e => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 border" style={{ background: bgElevated, borderColor: borderLight }}>
                    <div className="flex items-center gap-3">
                      <span className="text-base">{LEDGER_ICONS[e.type]}</span>
                      <div>
                        <p className="text-sm text-white">{e.description}</p>
                        <p className="text-xs" style={{ color: textMuted }}>{fmtDate(e.date)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold ml-4 flex-shrink-0" style={{ color: LEDGER_COLORS[e.type] }}>
                      {e.debit > 0 ? `+${fmt(e.debit)}` : `-${fmt(e.credit)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick Navigation */}
      <div className="rounded-xl border p-5 space-y-3" style={{ background: bgCard, borderColor: border }}>
        <h2 className="font-semibold text-white">Quick Navigation</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {NAV_LINKS.map(link => (
            <button key={link.href} onClick={() => { window.location.href = link.href; }}
              className="rounded-lg px-3 py-3 text-left border hover:bg-white/[0.03] transition-colors"
              style={{ background: bgElevated, borderColor: borderLight }}>
              <span className="text-lg block mb-1">{link.icon}</span>
              <span className="text-xs" style={{ color: textSecondary }}>{link.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
