// Enterprise Financial Engine — Calculations
// Financial Rule Lock:
//   Operating Profit = Revenue - COGS - Marketplace Fees - Shipping - Operating Expenses ONLY
//   NEVER mix: Payroll, Withdrawals, Investor Capital, Investor Profit, Marketplace Payouts into Operating Profit
//
// Investor receives TWO independent values: Capital Recovery + Profit Payment. Never merged.

import type {
  FinancialData,
  CapitalTransaction,
  ProfitWithdrawal,
  MarketplaceSettlement,
  CompanyWallet,
  InvestorWallet,
  FinancialSummary,
  FinancialTimelineEvent,
  LedgerEntry,
} from '../../types/financial';

// ── Company Wallet ────────────────────────────────────────────────────────────

export function getCompanyWallet(data: FinancialData, companyId: string): CompanyWallet {
  const company = data.companies.find(c => c.id === companyId);
  const txs = data.capitalTransactions.filter(t => t.companyId === companyId);
  const withdrawals = data.profitWithdrawals.filter(w => w.companyId === companyId);
  const settlements = data.marketplaceSettlements.filter(s => s.companyId === companyId);

  const capitalInvested = sum(txs.filter(t => t.type === 'capital_in'));
  const capitalReturned = sum(txs.filter(t => t.type === 'capital_return'));
  const outstandingCapital = Math.max(0, capitalInvested - capitalReturned);

  const profitPaid = sum(withdrawals.filter(w => w.withdrawalType === 'profit'));

  // Marketplace balance = sum of settlements that have reached 'available' or beyond but not yet withdrawn
  const marketplaceBalance = settlements
    .filter(s => ['available', 'capital_recovery', 'profit_available'].includes(s.stage))
    .reduce((acc, s) => acc + s.amount, 0);

  // Profit available = marketplace balance minus outstanding capital recovery
  const profitAvailable = Math.max(0, marketplaceBalance - outstandingCapital);
  const outstandingProfit = profitAvailable - profitPaid;

  return {
    companyId,
    companyName: company?.name ?? companyId,
    marketplaceBalance,
    capitalInvested,
    capitalReturned,
    outstandingCapital,
    profitAvailable,
    profitPaid,
    outstandingProfit: Math.max(0, outstandingProfit),
  };
}

// ── Investor Wallet ───────────────────────────────────────────────────────────

export function getInvestorWallet(data: FinancialData, investorId: string): InvestorWallet {
  const investor = data.investors.find(i => i.id === investorId);
  const txs = data.capitalTransactions.filter(t => t.investorId === investorId);
  const withdrawals = data.profitWithdrawals.filter(w => w.investorId === investorId);

  const capitalInvested = sum(txs.filter(t => t.type === 'capital_in'));
  const capitalReturned = sum(txs.filter(t => t.type === 'capital_return'));
  const remainingCapital = Math.max(0, capitalInvested - capitalReturned);

  // Inventory value = unsold stock only — an asset until sold, never withdrawable until recovered
  const inventoryValue = data.inventoryItems
    .filter(i => i.investorId === investorId && i.currentQty > 0)
    .reduce((acc, i) => acc + i.currentQty * i.unitCost, 0);
  const recoveredInventory = capitalReturned;

  // Per-company settlements for this investor's companies
  const investorCompanyIds = [...new Set(txs.map(t => t.companyId))];
  const relevantSettlements = data.marketplaceSettlements.filter(s =>
    investorCompanyIds.includes(s.companyId)
  );

  const marketplaceFundsAvailable = relevantSettlements
    .filter(s => ['available', 'profit_available'].includes(s.stage))
    .reduce((acc, s) => acc + s.amount, 0);

  const marketplaceFundsPending = relevantSettlements
    .filter(s => ['sale', 'delivered', 'marketplace_holding', 'marketplace_released'].includes(s.stage))
    .reduce((acc, s) => acc + s.amount, 0);

  const profitPaid = sum(withdrawals.filter(w => w.withdrawalType === 'profit'));
  const profitEarned = Math.max(0, marketplaceFundsAvailable - remainingCapital);
  const outstandingProfit = Math.max(0, profitEarned - profitPaid);

  const roi = capitalInvested > 0 ? ((profitEarned / capitalInvested) * 100) : 0;

  const recentActivity = buildTimeline(data, investorId).slice(0, 20);

  return {
    investorId,
    investorName: investor?.name ?? investorId,
    capitalInvested,
    capitalReturned,
    remainingCapital,
    inventoryValue,
    recoveredInventory,
    marketplaceFundsAvailable,
    marketplaceFundsPending,
    profitEarned,
    profitPaid,
    outstandingProfit,
    roi,
    recentActivity,
  };
}

// ── Capital Ledger ────────────────────────────────────────────────────────────

export function getCapitalLedger(data: FinancialData, companyId?: string, investorId?: string): CapitalTransaction[] {
  return data.capitalTransactions
    .filter(t => (!companyId || t.companyId === companyId) && (!investorId || t.investorId === investorId))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ── Profit Ledger ─────────────────────────────────────────────────────────────

export function getProfitLedger(data: FinancialData, companyId?: string): ProfitWithdrawal[] {
  return data.profitWithdrawals
    .filter(w => !companyId || w.companyId === companyId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ── Marketplace Settlements ───────────────────────────────────────────────────

export function getSettlementsByCompany(data: FinancialData, companyId?: string): MarketplaceSettlement[] {
  return data.marketplaceSettlements
    .filter(s => !companyId || s.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Unified Financial Timeline ────────────────────────────────────────────────

export function buildTimeline(data: FinancialData, investorId?: string, companyId?: string): FinancialTimelineEvent[] {
  const events: FinancialTimelineEvent[] = [];

  // From capital transactions
  data.capitalTransactions
    .filter(t => (!investorId || t.investorId === investorId) && (!companyId || t.companyId === companyId))
    .forEach(t => {
      events.push({
        id: `tl_ctx_${t.id}`,
        investorId: t.investorId,
        companyId: t.companyId,
        type: t.type,
        amount: t.amount,
        description: t.note || capitalTypeLabel(t.type),
        date: t.date,
        referenceId: t.id,
      });
    });

  // From withdrawals
  data.profitWithdrawals
    .filter(w => (!investorId || w.investorId === investorId) && (!companyId || w.companyId === companyId))
    .forEach(w => {
      events.push({
        id: `tl_pwd_${w.id}`,
        investorId: w.investorId,
        companyId: w.companyId,
        type: w.withdrawalType === 'capital_return' ? 'capital_return' : 'profit_withdrawn',
        amount: w.amount,
        description: w.note || `${w.withdrawalType === 'capital_return' ? 'Capital return' : 'Profit withdrawal'}`,
        date: w.date,
        referenceId: w.id,
      });
    });

  // From marketplace settlements (latest stage only per settlement)
  data.marketplaceSettlements
    .filter(s => !companyId || s.companyId === companyId)
    .forEach(s => {
      const ledgerType = stageToLedgerType(s.stage);
      if (ledgerType) {
        events.push({
          id: `tl_mkt_${s.id}`,
          companyId: s.companyId,
          type: ledgerType,
          amount: s.amount,
          description: `${s.marketplace} — ${s.stage.replace(/_/g, ' ')}${s.saleRef ? ` (${s.saleRef})` : ''}`,
          date: s.updatedAt.split('T')[0],
          referenceId: s.id,
        });
      }
    });

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

// ── Audit Ledger View ─────────────────────────────────────────────────────────

export function getLedgerView(data: FinancialData, companyId?: string, investorId?: string): LedgerEntry[] {
  return data.ledgerEntries
    .filter(e => (!companyId || e.companyId === companyId) && (!investorId || e.investorId === investorId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Financial Dashboard Summary ───────────────────────────────────────────────

export function getFinancialSummary(data: FinancialData): FinancialSummary {
  const wallets = data.companies.map(c => getCompanyWallet(data, c.id));

  return {
    totalCapitalInvested: wallets.reduce((a, w) => a + w.capitalInvested, 0),
    totalCapitalReturned: wallets.reduce((a, w) => a + w.capitalReturned, 0),
    totalOutstandingCapital: wallets.reduce((a, w) => a + w.outstandingCapital, 0),
    totalProfitPaid: wallets.reduce((a, w) => a + w.profitPaid, 0),
    totalMarketplaceBalance: wallets.reduce((a, w) => a + w.marketplaceBalance, 0),
    totalMarketplacePending: data.marketplaceSettlements
      .filter(s => ['sale', 'delivered', 'marketplace_holding', 'marketplace_released'].includes(s.stage))
      .reduce((a, s) => a + s.amount, 0),
    companyCount: data.companies.length,
    investorCount: data.investors.length,
    activeSettlements: data.marketplaceSettlements.filter(s => s.stage !== 'withdrawn').length,
    wallets,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sum(txs: { amount: number }[]): number {
  return txs.reduce((a, t) => a + t.amount, 0);
}

function capitalTypeLabel(type: string): string {
  return {
    capital_in: 'Capital invested',
    capital_return: 'Capital returned',
    inventory_purchase: 'Inventory purchase',
    inventory_adjustment: 'Inventory adjustment',
  }[type] ?? type;
}

function stageToLedgerType(stage: string) {
  const map: Record<string, string> = {
    sale: 'sale',
    marketplace_holding: 'marketplace_holding',
    marketplace_released: 'marketplace_released',
    available: 'marketplace_available',
    profit_available: 'profit_earned',
    withdrawn: 'profit_withdrawn',
  };
  return map[stage] as import('../../types/financial').LedgerEntryType | undefined;
}

export function fmt(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
