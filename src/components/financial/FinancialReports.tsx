import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getFinancialData, getInvestors, getCompanies } from '../../store/financialStore';
import {
  getCompanyWallet, getInvestorWallet, buildTimeline,
  getCapitalLedger, getProfitLedger, fmt, fmtDate,
  computeGrossReshipCost, computeNetReshipLoss,
} from '../../utils/financial/calculations';
import type { FinancialCompany, Investor, LedgerEntryType } from '../../types/financial';

const bgCard = 'var(--t-card,#152230)';
const bgElevated = 'var(--t-el,#1a2d3d)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const LEDGER_ICONS: Partial<Record<LedgerEntryType, string>> = {
  capital_in: '💰', capital_return: '🔄', inventory_purchase: '📦',
  profit_earned: '📈', profit_withdrawn: '💸', sale: '🛒',
};

type ReportType = 'investor_statement' | 'capital_report' | 'profit_report' | 'payout_report' | 'company_summary' | 'roi_report' | 'reship_report';

const REPORT_DEFS: { type: ReportType; label: string; icon: string; description: string }[] = [
  { type: 'investor_statement', label: 'Investor Statement', icon: '📄', description: 'Complete financial statement per investor — capital, profit, ROI' },
  { type: 'capital_report', label: 'Capital Report', icon: '💰', description: 'All capital transactions grouped by investor and company' },
  { type: 'profit_report', label: 'Profit Report', icon: '📈', description: 'All profit withdrawals with running totals' },
  { type: 'payout_report', label: 'Payout Report', icon: '💸', description: 'Outstanding amounts owed to each investor' },
  { type: 'company_summary', label: 'Company Summary', icon: '🏢', description: 'Financial summary per company with wallet breakdown' },
  { type: 'roi_report', label: 'ROI Report', icon: '📊', description: 'Return on investment for each investor across all companies' },
  { type: 'reship_report', label: 'Reship Report', icon: '↩️', description: 'All reships with gross cost, supplier recovery, net loss, and final profit' },
];

export default function FinancialReports() {
  const [companies, setCompanies] = useState<FinancialCompany[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [filterCo, setFilterCo] = useState('');
  const [filterInv, setFilterInv] = useState('');
  const [reportData, setReportData] = useState<object | null>(null);

  useEffect(() => {
    setCompanies(getCompanies());
    setInvestors(getInvestors());
  }, []);

  const generateReport = () => {
    if (!selectedReport) return;
    const data = getFinancialData();

    if (selectedReport === 'investor_statement') {
      const targets = filterInv ? investors.filter(i => i.id === filterInv) : investors;
      const result = targets.map(inv => ({
        investor: inv.name,
        ...getInvestorWallet(data, inv.id),
        timeline: buildTimeline(data, inv.id).slice(0, 30),
      }));
      setReportData({ type: 'investor_statement', rows: result });
    } else if (selectedReport === 'capital_report') {
      const txs = getCapitalLedger(data, filterCo || undefined, filterInv || undefined);
      setReportData({ type: 'capital_report', rows: txs.map(t => ({
        date: fmtDate(t.date),
        investor: investors.find(i => i.id === t.investorId)?.name ?? t.investorId,
        company: companies.find(c => c.id === t.companyId)?.name ?? t.companyId,
        type: t.type,
        amount: t.amount,
        note: t.note,
      }))});
    } else if (selectedReport === 'profit_report') {
      const wds = getProfitLedger(data, filterCo || undefined);
      const filtered = filterInv ? wds.filter(w => w.investorId === filterInv) : wds;
      setReportData({ type: 'profit_report', rows: filtered.map(w => ({
        date: fmtDate(w.date),
        investor: investors.find(i => i.id === w.investorId)?.name ?? w.investorId,
        company: companies.find(c => c.id === w.companyId)?.name ?? w.companyId,
        type: w.withdrawalType,
        amount: w.amount,
        note: w.note,
      }))});
    } else if (selectedReport === 'payout_report') {
      const targets = filterInv ? investors.filter(i => i.id === filterInv) : investors;
      const result = targets.map(inv => {
        const w = getInvestorWallet(data, inv.id);
        return { investor: inv.name, profitEarned: w.profitEarned, profitPaid: w.profitPaid, outstandingProfit: w.outstandingProfit, remainingCapital: w.remainingCapital };
      });
      setReportData({ type: 'payout_report', rows: result });
    } else if (selectedReport === 'company_summary') {
      const targets = filterCo ? companies.filter(c => c.id === filterCo) : companies;
      const result = targets.map(co => ({ company: co.name, ...getCompanyWallet(data, co.id) }));
      setReportData({ type: 'company_summary', rows: result });
    } else if (selectedReport === 'roi_report') {
      const targets = filterInv ? investors.filter(i => i.id === filterInv) : investors;
      const result = targets.map(inv => {
        const w = getInvestorWallet(data, inv.id);
        return { investor: inv.name, capitalInvested: w.capitalInvested, profitEarned: w.profitEarned, roi: w.roi };
      }).sort((a, b) => b.roi - a.roi);
      setReportData({ type: 'roi_report', rows: result });
    } else if (selectedReport === 'reship_report') {
      const reships = data.saleReships ?? [];
      const filtered = reships.filter(r => {
        const sale = data.marketplaceSettlements.find(s => s.id === r.saleId);
        return (!filterCo || sale?.companyId === filterCo);
      });
      const result = filtered.map(r => {
        const sale = data.marketplaceSettlements.find(s => s.id === r.saleId);
        const co = sale ? companies.find(c => c.id === sale.companyId) : null;
        const inv = sale?.inventoryItemId ? data.inventoryItems?.find(i => i.id === sale.inventoryItemId) : null;
        const grossCost = computeGrossReshipCost(r);
        const netLoss = computeNetReshipLoss(r);
        return {
          sale: sale?.saleRef ?? r.saleId,
          company: co?.name ?? sale?.companyId ?? '',
          marketplace: sale?.marketplace ?? '',
          reshipNumber: r.reshipNumber,
          reshipDate: fmtDate(r.reshipDate),
          reason: r.reason,
          qty: r.qty,
          productSku: inv?.sku ?? '',
          shippingCost: r.costs.shippingLabelCost,
          replacementCost: r.costs.replacementProductCost * r.qty,
          totalReshipCost: grossCost,
          supplierRecovery: r.supplierRecoveredAmount,
          netLoss,
          deliveryStatus: r.deliveryStatus,
          supplierClaimStatus: r.supplierClaimStatus,
        };
      });
      setReportData({ type: 'reship_report', rows: result });
    }
  };

  const downloadCSV = () => {
    if (!reportData) return;
    const rd = reportData as { type: string; rows: Record<string, unknown>[] };
    if (!rd.rows?.length) return;
    const headers = Object.keys(rd.rows[0]).filter(k => k !== 'timeline' && k !== 'recentActivity');
    const csv = [
      headers.join(','),
      ...rd.rows.map(row =>
        headers.map(h => {
          const v = String(row[h] ?? '');
          return v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${rd.type}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const rd = reportData as { type: string; rows: Record<string, unknown>[] } | null;

  return (
    <div className="space-y-6 p-6" style={{ minHeight: '100%' }}>
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Financial Reports</h1>
        <p className="text-sm" style={{ color: textMuted }}>Generate investor statements, capital reports, profit summaries and ROI analysis.</p>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {REPORT_DEFS.map(r => (
          <button key={r.type} onClick={() => { setSelectedReport(r.type); setReportData(null); }}
            className="rounded-xl border p-4 text-left transition-all hover:bg-white/[0.02]"
            style={{
              background: selectedReport === r.type ? bgElevated : bgCard,
              borderColor: selectedReport === r.type ? '#00e5ff60' : border,
            }}>
            <span className="text-2xl block mb-2">{r.icon}</span>
            <p className="text-sm font-medium text-white mb-1">{r.label}</p>
            <p className="text-xs" style={{ color: textMuted }}>{r.description}</p>
          </button>
        ))}
      </div>

      {selectedReport && (
        <div className="rounded-xl border p-5 space-y-4" style={{ background: bgCard, borderColor: border }}>
          <h3 className="font-semibold text-white">Configure Report</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: textMuted }}>Filter by Company</label>
              <select value={filterCo} onChange={e => setFilterCo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none border"
                style={{ background: bgElevated, borderColor: borderLight }}>
                <option value="">All Companies</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: textMuted }}>Filter by Investor</label>
              <select value={filterInv} onChange={e => setFilterInv(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none border"
                style={{ background: bgElevated, borderColor: borderLight }}>
                <option value="">All Investors</option>
                {investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={generateReport}
            className="px-6 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#00e5ff22', border: '1px solid #00e5ff44', color: '#00e5ff' }}>
            Generate Report
          </button>
        </div>
      )}

      {/* Report Output */}
      {rd && rd.rows && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border p-5 space-y-4" style={{ background: bgCard, borderColor: border }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">{REPORT_DEFS.find(r => r.type === rd.type)?.label} — {rd.rows.length} record{rd.rows.length !== 1 ? 's' : ''}</h3>
            <button onClick={downloadCSV} className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: '#34d39922', border: '1px solid #34d39944', color: '#34d399' }}>
              ↓ Download CSV
            </button>
          </div>

          {rd.rows.length === 0 && (
            <p className="text-sm py-6 text-center" style={{ color: textMuted }}>No data found for the selected filters.</p>
          )}

          {rd.type === 'investor_statement' && (rd.rows as unknown as Array<ReturnType<typeof getInvestorWallet> & { investor: string; timeline: { id: string; type: LedgerEntryType; amount: number; description: string; date: string }[] }>).map((row, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3" style={{ background: bgElevated, borderColor: borderLight }}>
              <h4 className="font-semibold text-white">{(row as unknown as { investor: string }).investor}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[
                  { l: 'Capital Invested', v: fmt(row.capitalInvested), c: '#60a5fa' },
                  { l: 'Capital Returned', v: fmt(row.capitalReturned), c: '#34d399' },
                  { l: 'Profit Earned', v: fmt(row.profitEarned), c: '#34d399' },
                  { l: 'Profit Paid', v: fmt(row.profitPaid), c: '#22c55e' },
                  { l: 'Outstanding Profit', v: fmt(row.outstandingProfit), c: '#f59e0b' },
                  { l: 'Remaining Capital', v: fmt(row.remainingCapital), c: '#f59e0b' },
                  { l: 'ROI', v: `${row.roi.toFixed(2)}%`, c: row.roi >= 0 ? '#34d399' : '#ef4444' },
                ].map(m => (
                  <div key={m.l} className="rounded-lg p-2" style={{ background: bgCard }}>
                    <p style={{ color: textMuted }}>{m.l}</p>
                    <p className="font-bold mt-0.5" style={{ color: m.c }}>{m.v}</p>
                  </div>
                ))}
              </div>
              {row.timeline?.length > 0 && (
                <div className="space-y-1 mt-2">
                  <p className="text-xs font-medium mb-1" style={{ color: textMuted }}>Recent Activity</p>
                  {row.timeline.slice(0, 5).map(e => (
                    <div key={e.id} className="flex justify-between text-xs px-2 py-1 rounded" style={{ background: bgCard }}>
                      <span style={{ color: textSecondary }}>{LEDGER_ICONS[e.type]} {e.description}</span>
                      <span style={{ color: '#00e5ff' }}>{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {rd.type !== 'investor_statement' && rd.rows.length > 0 && (() => {
            const headers = Object.keys(rd.rows[0]).filter(k => k !== 'companyId' && k !== 'investorId');
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="border-b" style={{ borderColor: borderLight }}>
                      {headers.map(h => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-medium capitalize" style={{ color: textMuted }}>
                          {h.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rd.rows.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-white/[0.01]" style={{ borderColor: borderLight }}>
                        {headers.map(h => {
                          const v = row[h];
                          const isNum = typeof v === 'number';
                          return (
                            <td key={h} className="py-2 px-3" style={{ color: isNum ? '#00e5ff' : textSecondary }}>
                              {isNum ? fmt(v as number) : String(v ?? '—')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}
