// Enterprise Financial Engine — Core Types
// Every dollar answers: Which Company? Which Investor? Capital or Profit? Available? Withdrawn? Outstanding?

// ── Entities ──────────────────────────────────────────────────────────────────

export interface FinancialCompany {
  id: string;
  name: string;
  currency: string;
  baseCurrency: string;
  notes?: string;
  createdAt: string;
}

export interface Investor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

// ── Capital Ledger ─────────────────────────────────────────────────────────────
// Capital and Profit NEVER merge. Decision 1.

export type CapitalTransactionType =
  | 'capital_in'
  | 'capital_return'
  | 'inventory_purchase'
  | 'inventory_adjustment';

export interface CapitalTransaction {
  id: string;
  investorId: string;   // Decision 2: relationship at transaction level
  companyId: string;    // Decision 2: relationship at transaction level
  type: CapitalTransactionType;
  amount: number;
  currency: string;
  exchangeRate: number;       // Future multi-currency — default 1
  baseCurrencyAmount: number; // Future multi-currency — mirrors amount until multi-currency active
  note?: string;
  date: string;
  createdAt: string;
}

// ── Withdrawal Engine ─────────────────────────────────────────────────────────
// Decision 3: extend existing Withdrawal with withdrawalType + Migration H

export type WithdrawalType = 'profit' | 'capital_return';

export interface ProfitWithdrawal {
  id: string;
  investorId: string;
  companyId: string;
  withdrawalType: WithdrawalType; // Migration H backfills all historical as 'profit'
  amount: number;
  note?: string;
  date: string;
  createdAt: string;
}

// ── Marketplace Settlement ─────────────────────────────────────────────────────
// Nothing skips a stage: Sale → Delivered → Holding → Released → Available → Capital Recovery → Profit → Withdrawn

export type MarketplaceSettlementStage =
  | 'sale'
  | 'delivered'
  | 'marketplace_holding'
  | 'marketplace_released'
  | 'available'
  | 'capital_recovery'
  | 'profit_available'
  | 'withdrawn';

export interface MarketplaceSettlementHistoryEntry {
  stage: MarketplaceSettlementStage;
  timestamp: string;
  note?: string;
}

export interface MarketplaceSettlement {
  id: string;
  companyId: string;
  marketplace: string;
  saleRef?: string;
  amount: number;
  stage: MarketplaceSettlementStage;
  stageHistory: MarketplaceSettlementHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── Immutable Audit Ledger ─────────────────────────────────────────────────────

export type LedgerEntryType =
  | 'capital_in'
  | 'capital_return'
  | 'inventory_purchase'
  | 'inventory_adjustment'
  | 'sale'
  | 'marketplace_holding'
  | 'marketplace_released'
  | 'marketplace_available'
  | 'profit_earned'
  | 'profit_withdrawn'
  | 'adjustment';

export interface LedgerEntry {
  id: string;
  companyId: string;
  investorId?: string;
  type: LedgerEntryType;
  debit: number;
  credit: number;
  description: string;
  referenceId?: string;
  date: string;
  createdAt: string; // immutable — never updated after creation
}

// ── Financial Timeline ─────────────────────────────────────────────────────────

export interface FinancialTimelineEvent {
  id: string;
  investorId?: string;
  companyId: string;
  type: LedgerEntryType;
  amount: number;
  description: string;
  date: string;
  referenceId?: string;
}

// ── Computed Wallets ──────────────────────────────────────────────────────────

export interface CompanyWallet {
  companyId: string;
  companyName: string;
  marketplaceBalance: number;
  capitalInvested: number;
  capitalReturned: number;
  outstandingCapital: number;
  profitAvailable: number;
  profitPaid: number;
  outstandingProfit: number;
}

export interface InvestorWallet {
  investorId: string;
  investorName: string;
  capitalInvested: number;
  capitalReturned: number;
  remainingCapital: number;
  inventoryValue: number;
  recoveredInventory: number;
  marketplaceFundsAvailable: number;
  marketplaceFundsPending: number;
  profitEarned: number;
  profitPaid: number;
  outstandingProfit: number;
  roi: number;
  recentActivity: FinancialTimelineEvent[];
}

// ── Future Multi-Currency ─────────────────────────────────────────────────────
// Architecture prepared. No calculations yet.

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: string;
}

// ── Store Shape ───────────────────────────────────────────────────────────────

export interface FinancialData {
  companies: FinancialCompany[];
  investors: Investor[];
  capitalTransactions: CapitalTransaction[];
  profitWithdrawals: ProfitWithdrawal[];
  marketplaceSettlements: MarketplaceSettlement[];
  ledgerEntries: LedgerEntry[];
  _migrationH: boolean; // true after Migration H has been applied
}
