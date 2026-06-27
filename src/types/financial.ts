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
  // Inventory link — set when a sale is tied to a specific inventory item
  inventoryItemId?: string;
  quantity?: number;    // Units sold; required when inventoryItemId is set
  cog?: number;         // Cost of goods: qty × unitCost (auto) or manual
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
  | 'adjustment'
  | 'reship_cost'
  | 'reship_inventory';

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

// ── Inventory Management ───────────────────────────────────────────────────────
// Investor is the Inventory Owner. Capital → Inventory Purchase → Asset → Sale → Recovery + Profit.
// Unsold inventory is NOT withdrawable. Only sold inventory contributes to investor recovery.

export interface InventoryItem {
  id: string;
  companyId: string;
  investorId: string;         // Inventory owner (e.g. Salman Bashir)
  name: string;
  sku: string;
  description?: string;
  unitCost: number;
  currency: string;
  purchasedQty: number;
  soldQty: number;
  currentQty: number;         // purchasedQty - soldQty (kept in sync on every mutation)
  capitalTransactionId?: string; // Optional link to the CapitalTransaction for the purchase
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = 'PURCHASE_IN' | 'SALE_OUT' | 'ADJUSTMENT' | 'RETURN_IN';

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  companyId: string;
  type: StockMovementType;
  qty: number;          // Always positive; direction is determined by type
  unitCost: number;
  totalValue: number;   // qty × unitCost
  saleId?: string;      // Reference to MarketplaceSettlement.id (set for SALE_OUT from sale)
  reshipId?: string;    // Reference to SaleReship.reshipId (set for SALE_OUT from reship)
  note?: string;
  date: string;
  createdAt: string;
  isReconciliation: boolean; // true when auto-created by the reconciliation migration
}

// ── Reship Engine ─────────────────────────────────────────────────────────────
// Every sale can have unlimited reships. A reship is NOT a new sale — it is part of
// the original sale lifecycle. Net Reship Loss = Gross Reship Cost − Supplier Recovery.

export type ReshipDeliveryStatus = 'pending' | 'shipped' | 'delivered' | 'returned' | 'lost';
export type ShippingLabelProvider = 'FedEx' | 'UPS' | 'USPS' | 'DHL' | 'Other';
export type SupplierClaimStatus = 'none' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'paid';

export interface ReshipCosts {
  shippingLabelCost: number;
  shippingProvider?: ShippingLabelProvider;
  trackingNumber?: string;
  labelPurchasedDate?: string;
  labelPdfUrl?: string;
  replacementProductCost: number; // per-unit cost; gross = replacementProductCost × qty
  packagingCost: number;
  insuranceCost: number;
  otherCost: number;
}

export interface SaleReship {
  reshipId: string;
  saleId: string;
  reshipNumber: number;    // auto-assigned, 1-based per saleId
  qty: number;             // default 1; drives inventory deduction + replacement cost
  reason: string;
  notes?: string;
  reshipDate: string;
  deliveryStatus: ReshipDeliveryStatus;
  costs: ReshipCosts;
  inventoryItemId?: string;      // mirrors sale's inventoryItemId for replacement deduction
  inventoryMovementId?: string;  // id of the StockMovement created when reship was added
  supplierClaimStatus: SupplierClaimStatus;
  supplierRecoveredAmount: number;
  recoveryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReshipSummary {
  totalReships: number;
  totalGrossReshipCost: number;
  totalSupplierRecovery: number;
  totalNetReshipLoss: number;
  avgNetReshipLoss: number;
}

// ── Reconciliation Report ─────────────────────────────────────────────────────

export interface InventorySnapshot {
  id: string;
  name: string;
  sku: string;
  soldQty: number;
  currentQty: number;
  inventoryValue: number;
}

export interface ReconciliationReport {
  historicalSalesScanned: number;
  inventoryLinkedSalesFound: number;
  stockMovementsCreated: number;
  duplicateMovementsSkipped: number;
  productsUpdated: number;
  inventoryBefore: InventorySnapshot[];
  inventoryAfter: InventorySnapshot[];
  remainingIssues: string[];
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
  inventoryValue: number;       // Unsold inventory value — NOT withdrawable until sold
  recoveredInventory: number;
  marketplaceFundsAvailable: number;
  marketplaceFundsPending: number;
  profitEarned: number;
  profitPaid: number;
  outstandingProfit: number;
  roi: number;
  recentActivity: FinancialTimelineEvent[];
  // Reship impact
  reshipCount: number;
  reshipGrossLoss: number;
  reshipSupplierRecovery: number;
  reshipNetLoss: number;
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

// ── Financial Summary (computed, used by Dashboard) ───────────────────────────

export interface FinancialSummary {
  totalCapitalInvested: number;
  totalCapitalReturned: number;
  totalOutstandingCapital: number;
  totalProfitPaid: number;
  totalMarketplaceBalance: number;
  totalMarketplacePending: number;
  companyCount: number;
  investorCount: number;
  activeSettlements: number;
  wallets: CompanyWallet[];
  // Reship totals
  totalReships: number;
  totalGrossReshipCost: number;
  totalNetReshipLoss: number;
  totalSupplierRecovery: number;
}

// ── Store Shape ───────────────────────────────────────────────────────────────

export interface FinancialData {
  companies: FinancialCompany[];
  investors: Investor[];
  capitalTransactions: CapitalTransaction[];
  profitWithdrawals: ProfitWithdrawal[];
  marketplaceSettlements: MarketplaceSettlement[];
  ledgerEntries: LedgerEntry[];
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  saleReships: SaleReship[];
  _migrationH: boolean;                       // true after Migration H (withdrawalType backfill)
  _migrationInventoryReconciliation: boolean; // true after first inventory reconciliation pass
  _migrationReshipV1: boolean;               // true after Reship V1 migration (arrays initialized)
}
