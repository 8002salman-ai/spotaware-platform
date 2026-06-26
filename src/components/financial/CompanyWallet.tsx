import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getFinancialData, getCompanies, getInvestors,
  getCapitalTransactions, getProfitWithdrawals,
} from '../../store/financialStore';
import { getCompanyWallet, fmt } from '../../utils/financial/calculations';
import type { FinancialCompany, CompanyWallet as CompanyWalletType, Investor } from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

interface InvestorBreakdown {
  investor: Investor;
  capitalIn: number;
  capitalReturn: number;
  profitWithdrawn: number;
}

export default function CompanyWallet() {
  const [companies, setCompanies] = useState<FinancialCompany[]>([]);
  const [wallets, setWallets] = useState<CompanyWalletType[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<string, InvestorBreakdown[]>>({});
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = () => {
    const data = getFinancialData();
    const cos = getCompanies();
    const invs = getInvestors();
    const txs = getCapitalTransactions();
    const wds = getProfitWithdrawals();

    setCompanies(cos);
    setInvestors(invs);
    setWallets(cos.map(c => getCompanyWallet(data, c.id)));

    const bds: Record<string, InvestorBreakdown[]> = {};
    cos.forEach(co => {
      bds[co.id] = invs
        .map(inv => ({
          investor: inv,
          capitalIn: txs.filter(t => t.investorId === inv.id && t.companyId === co.id && t.type === 'capital_in').reduce((a, t) => a + t.amount, 0),
          capitalReturn: txs.filter(t => t.investorId === inv.id && t.companyId === co.id && t.type === 'capital_return').reduce((a, t) => a + t.amount, 0),
          profitWithdrawn: wds.filter(w => w.investorId === inv.id && w.companyId === co.id && w.withdrawalType === 'profit').reduce((a, w) => a + w.amount, 0),
        }))
        .filter(b => b.capitalIn > 0 || b.capitalReturn > 0 || b.profitWithdrawn > 0);
    });
    setBreakdowns(bds);
  };

  useEffect(() => { reload(); }, []);

  if (companies.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-white mb-4">Company Wallets</h1>
        <div className="rounded-xl border p-12 text-center" style={{ background: bgCard, borderColor: border }}>
          <p style={{ color: textMuted }} className="text-sm">No companies found. Add companies in Investor Management first.</p>
          <button onClick={() => { window.location.href = '/financial/investors'; }}
            className="mt-4 px-4 py-2 rounded-lg text-sm" style={{ background: '#00e5ff22', border: '1px solid #00e5ff44', color: '#00e5ff' }}>
            Go to Investor Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Company Wallets</h1>
        <p className="text-sm" style={{ color: textMuted }}>Each company has its own separate financial wallet. Companies never mix.</p>
      </div>

      {/* Wallet Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map(w => {
          const co = companies.find(c => c.id === w.companyId);
          const isExpanded = expandedId === w.companyId;
          return (
            <motion.div key={w.companyId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : w.companyId)}
                className="w-full text-left p-5 space-y-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white text-lg">{w.companyName}</h3>
                  <span className="text-xs" style={{ color: textMuted }}>{co?.currency ?? 'USD'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Marketplace Balance', value: fmt(w.marketplaceBalance), color: '#00e5ff' },
                    { label: 'Capital Invested', value: fmt(w.capitalInvested), color: '#60a5fa' },
                    { label: 'Capital Returned', value: fmt(w.capitalReturned), color: '#34d399' },
                    { label: 'Outstanding Capital', value: fmt(w.outstandingCapital), color: '#f59e0b' },
                    { label: 'Profit Available', value: fmt(w.profitAvailable), color: '#10b981' },
                    { label: 'Profit Paid', value: fmt(w.profitPaid), color: '#22c55e' },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg p-2.5" style={{ background: bgElevated }}>
                      <p className="text-[10px] mb-0.5" style={{ color: textMuted }}>{m.label}</p>
                      <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: borderLight }}>
                  <span className="text-xs" style={{ color: textMuted }}>Outstanding Profit</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={w.outstandingProfit > 0
                      ? { background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }
                      : { background: '#34d39920', color: '#34d399', border: '1px solid #34d39940' }}>
                    {fmt(w.outstandingProfit)}
                  </span>
                </div>

                <p className="text-[10px] text-center" style={{ color: textMuted }}>
                  {isExpanded ? '▲ Collapse' : '▼ View investor breakdown'}
                </p>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t overflow-hidden" style={{ borderColor: borderLight }}>
                    <div className="p-4 space-y-2">
                      <p className="text-xs font-medium mb-2" style={{ color: textMuted }}>Investor Breakdown</p>
                      {(breakdowns[w.companyId] ?? []).length === 0 && (
                        <p className="text-xs py-3 text-center" style={{ color: textMuted }}>No investor capital recorded for this company.</p>
                      )}
                      {(breakdowns[w.companyId] ?? []).map(b => (
                        <div key={b.investor.id} className="rounded-lg px-3 py-2.5 border" style={{ background: bgElevated, borderColor: borderLight }}>
                          <p className="text-sm font-medium text-white mb-1.5">{b.investor.name}</p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div><span style={{ color: textMuted }}>Capital In</span><br /><span style={{ color: '#60a5fa' }}>{fmt(b.capitalIn)}</span></div>
                            <div><span style={{ color: textMuted }}>Returned</span><br /><span style={{ color: '#34d399' }}>{fmt(b.capitalReturn)}</span></div>
                            <div><span style={{ color: textMuted }}>Profit Paid</span><br /><span style={{ color: '#22c55e' }}>{fmt(b.profitWithdrawn)}</span></div>
                          </div>
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

      {/* Company × Investor Matrix */}
      {investors.length > 0 && companies.length > 0 && (
        <div className="rounded-xl border p-5 overflow-x-auto" style={{ background: bgCard, borderColor: border }}>
          <h2 className="font-semibold text-white mb-4">Company × Investor Capital Matrix</h2>
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="border-b" style={{ borderColor: borderLight }}>
                <th className="text-left pb-2 pr-4 text-xs font-medium" style={{ color: textMuted }}>Company</th>
                {investors.map(inv => (
                  <th key={inv.id} className="text-right pb-2 px-3 text-xs font-medium" style={{ color: textMuted }}>{inv.name}</th>
                ))}
                <th className="text-right pb-2 pl-3 text-xs font-medium" style={{ color: textSecondary }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(co => {
                const bd = breakdowns[co.id] ?? [];
                const rowTotal = bd.reduce((a, b) => a + b.capitalIn, 0);
                return (
                  <tr key={co.id} className="border-b" style={{ borderColor: borderLight }}>
                    <td className="py-2 pr-4 font-medium text-white">{co.name}</td>
                    {investors.map(inv => {
                      const entry = bd.find(b => b.investor.id === inv.id);
                      return (
                        <td key={inv.id} className="py-2 px-3 text-right" style={{ color: entry && entry.capitalIn > 0 ? '#60a5fa' : textMuted }}>
                          {entry && entry.capitalIn > 0 ? fmt(entry.capitalIn) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2 pl-3 text-right font-semibold" style={{ color: '#00e5ff' }}>
                      {rowTotal > 0 ? fmt(rowTotal) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
