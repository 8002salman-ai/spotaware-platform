// Enterprise Financial Engine — localStorage Store
// Matches the existing spotaware storage pattern (storage.ts)

import type {
  FinancialData,
  FinancialCompany,
  Investor,
  CapitalTransaction,
  CapitalTransactionType,
  ProfitWithdrawal,
  WithdrawalType,
  MarketplaceSettlement,
  MarketplaceSettlementStage,
  LedgerEntry,
  LedgerEntryType,
} from '../types/financial';

const STORAGE_KEY = 'spotaware_financial';

// ── Migration H ───────────────────────────────────────────────────────────────
// Backfills all historical ProfitWithdrawal records to withdrawalType = 'profit'.
// Idempotent — safe to run on every load.
function applyMigrationH(data: FinancialData): FinancialData {
  if (data._migrationH) return data;
  const patched = data.profitWithdrawals.map(w =>
    w.withdrawalType ? w : { ...w, withdrawalType: 'profit' as WithdrawalType }
  );
  return { ...data, profitWithdrawals: patched, _migrationH: true };
}

// ── Persistence ───────────────────────────────────────────────────────────────

const EMPTY: FinancialData = {
  companies: [],
  investors: [],
  capitalTransactions: [],
  profitWithdrawals: [],
  marketplaceSettlements: [],
  ledgerEntries: [],
  _migrationH: false,
};

export function getFinancialData(): FinancialData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, _migrationH: true };
    const parsed = JSON.parse(raw) as FinancialData;
    return applyMigrationH({ ...EMPTY, ...parsed });
  } catch {
    return { ...EMPTY, _migrationH: true };
  }
}

function save(data: FinancialData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Company CRUD ──────────────────────────────────────────────────────────────

export function getCompanies(): FinancialCompany[] {
  return getFinancialData().companies;
}

export function addCompany(company: Omit<FinancialCompany, 'id' | 'createdAt'>): FinancialCompany {
  const data = getFinancialData();
  const rec: FinancialCompany = {
    ...company,
    id: `co_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  save({ ...data, companies: [...data.companies, rec] });
  return rec;
}

export function updateCompany(id: string, patch: Partial<FinancialCompany>): void {
  const data = getFinancialData();
  save({ ...data, companies: data.companies.map(c => c.id === id ? { ...c, ...patch } : c) });
}

export function deleteCompany(id: string): void {
  const data = getFinancialData();
  save({ ...data, companies: data.companies.filter(c => c.id !== id) });
}

// ── Investor CRUD ─────────────────────────────────────────────────────────────

export function getInvestors(): Investor[] {
  return getFinancialData().investors;
}

export function addInvestor(investor: Omit<Investor, 'id' | 'createdAt'>): Investor {
  const data = getFinancialData();
  const rec: Investor = {
    ...investor,
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  save({ ...data, investors: [...data.investors, rec] });
  return rec;
}

export function updateInvestor(id: string, patch: Partial<Investor>): void {
  const data = getFinancialData();
  save({ ...data, investors: data.investors.map(i => i.id === id ? { ...i, ...patch } : i) });
}

export function deleteInvestor(id: string): void {
  const data = getFinancialData();
  save({ ...data, investors: data.investors.filter(i => i.id !== id) });
}

// ── Capital Transactions ──────────────────────────────────────────────────────

export function getCapitalTransactions(): CapitalTransaction[] {
  return getFinancialData().capitalTransactions;
}

export function addCapitalTransaction(
  input: Omit<CapitalTransaction, 'id' | 'createdAt' | 'currency' | 'exchangeRate' | 'baseCurrencyAmount'> & {
    currency?: string;
    exchangeRate?: number;
  }
): CapitalTransaction {
  const data = getFinancialData();
  const currency = input.currency ?? 'USD';
  const exchangeRate = input.exchangeRate ?? 1;
  const rec: CapitalTransaction = {
    ...input,
    id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    currency,
    exchangeRate,
    baseCurrencyAmount: input.amount * exchangeRate,
    createdAt: new Date().toISOString(),
  };
  const ledger = buildCapitalLedgerEntry(rec, data);
  save({
    ...data,
    capitalTransactions: [...data.capitalTransactions, rec],
    ledgerEntries: [...data.ledgerEntries, ledger],
  });
  return rec;
}

export function deleteCapitalTransaction(id: string): void {
  const data = getFinancialData();
  save({
    ...data,
    capitalTransactions: data.capitalTransactions.filter(t => t.id !== id),
    ledgerEntries: data.ledgerEntries.filter(e => e.referenceId !== id),
  });
}

// ── Profit Withdrawals ────────────────────────────────────────────────────────

export function getProfitWithdrawals(): ProfitWithdrawal[] {
  return getFinancialData().profitWithdrawals;
}

export function addProfitWithdrawal(
  input: Omit<ProfitWithdrawal, 'id' | 'createdAt'>
): ProfitWithdrawal {
  const data = getFinancialData();
  const rec: ProfitWithdrawal = {
    ...input,
    id: `pwd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const ledger = buildWithdrawalLedgerEntry(rec);
  save({
    ...data,
    profitWithdrawals: [...data.profitWithdrawals, rec],
    ledgerEntries: [...data.ledgerEntries, ledger],
  });
  return rec;
}

export function deleteWithdrawal(id: string): void {
  const data = getFinancialData();
  save({
    ...data,
    profitWithdrawals: data.profitWithdrawals.filter(w => w.id !== id),
    ledgerEntries: data.ledgerEntries.filter(e => e.referenceId !== id),
  });
}

// ── Marketplace Settlements ───────────────────────────────────────────────────

export function getMarketplaceSettlements(): MarketplaceSettlement[] {
  return getFinancialData().marketplaceSettlements;
}

export function addMarketplaceSettlement(
  input: Omit<MarketplaceSettlement, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'>
): MarketplaceSettlement {
  const data = getFinancialData();
  const now = new Date().toISOString();
  const rec: MarketplaceSettlement = {
    ...input,
    id: `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    stageHistory: [{ stage: input.stage, timestamp: now }],
    createdAt: now,
    updatedAt: now,
  };
  const ledger = buildSettlementLedgerEntry(rec);
  save({
    ...data,
    marketplaceSettlements: [...data.marketplaceSettlements, rec],
    ledgerEntries: [...data.ledgerEntries, ledger],
  });
  return rec;
}

export function advanceSettlementStage(
  id: string,
  nextStage: MarketplaceSettlementStage,
  note?: string
): void {
  const data = getFinancialData();
  const now = new Date().toISOString();
  const updated = data.marketplaceSettlements.map(s => {
    if (s.id !== id) return s;
    return {
      ...s,
      stage: nextStage,
      stageHistory: [...s.stageHistory, { stage: nextStage, timestamp: now, note }],
      updatedAt: now,
    };
  });
  const settlement = updated.find(s => s.id === id);
  const stageLedger = settlement ? buildSettlementLedgerEntry({ ...settlement, stage: nextStage }) : null;
  save({
    ...data,
    marketplaceSettlements: updated,
    ledgerEntries: stageLedger
      ? [...data.ledgerEntries, stageLedger]
      : data.ledgerEntries,
  });
}

export function deleteSettlement(id: string): void {
  const data = getFinancialData();
  save({
    ...data,
    marketplaceSettlements: data.marketplaceSettlements.filter(s => s.id !== id),
    ledgerEntries: data.ledgerEntries.filter(e => e.referenceId !== id),
  });
}

// ── Ledger Entries (read-only, auto-posted) ───────────────────────────────────

export function getLedgerEntries(): LedgerEntry[] {
  return getFinancialData().ledgerEntries;
}

export function addManualLedgerEntry(
  input: Omit<LedgerEntry, 'id' | 'createdAt'>
): LedgerEntry {
  const data = getFinancialData();
  const rec: LedgerEntry = {
    ...input,
    id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  save({ ...data, ledgerEntries: [...data.ledgerEntries, rec] });
  return rec;
}

// ── Automatic Ledger Posting Helpers ─────────────────────────────────────────

const CAPITAL_TYPE_TO_LEDGER: Record<CapitalTransactionType, LedgerEntryType> = {
  capital_in: 'capital_in',
  capital_return: 'capital_return',
  inventory_purchase: 'inventory_purchase',
  inventory_adjustment: 'inventory_adjustment',
};

function buildCapitalLedgerEntry(tx: CapitalTransaction, data: FinancialData): LedgerEntry {
  const investor = data.investors.find(i => i.id === tx.investorId);
  const company = data.companies.find(c => c.id === tx.companyId);
  const isDebit = tx.type === 'capital_in' || tx.type === 'inventory_purchase';
  const descriptions: Record<CapitalTransactionType, string> = {
    capital_in: `Capital invested by ${investor?.name ?? tx.investorId} in ${company?.name ?? tx.companyId}`,
    capital_return: `Capital returned to ${investor?.name ?? tx.investorId} from ${company?.name ?? tx.companyId}`,
    inventory_purchase: `Inventory purchased for ${company?.name ?? tx.companyId} (${investor?.name ?? tx.investorId})`,
    inventory_adjustment: `Inventory adjustment for ${company?.name ?? tx.companyId}`,
  };
  return {
    id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    companyId: tx.companyId,
    investorId: tx.investorId,
    type: CAPITAL_TYPE_TO_LEDGER[tx.type],
    debit: isDebit ? tx.amount : 0,
    credit: isDebit ? 0 : tx.amount,
    description: tx.note || descriptions[tx.type],
    referenceId: tx.id,
    date: tx.date,
    createdAt: new Date().toISOString(),
  };
}

function buildWithdrawalLedgerEntry(w: ProfitWithdrawal): LedgerEntry {
  const type: LedgerEntryType = w.withdrawalType === 'capital_return' ? 'capital_return' : 'profit_withdrawn';
  return {
    id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    companyId: w.companyId,
    investorId: w.investorId,
    type,
    debit: 0,
    credit: w.amount,
    description: w.note || `${w.withdrawalType === 'capital_return' ? 'Capital returned' : 'Profit withdrawn'} — investor ${w.investorId}`,
    referenceId: w.id,
    date: w.date,
    createdAt: new Date().toISOString(),
  };
}

const STAGE_TO_LEDGER: Partial<Record<MarketplaceSettlementStage, LedgerEntryType>> = {
  sale: 'sale',
  marketplace_holding: 'marketplace_holding',
  marketplace_released: 'marketplace_released',
  available: 'marketplace_available',
  profit_available: 'profit_earned',
  withdrawn: 'profit_withdrawn',
};

function buildSettlementLedgerEntry(s: MarketplaceSettlement): LedgerEntry {
  const type: LedgerEntryType = STAGE_TO_LEDGER[s.stage] ?? 'adjustment';
  const isDebit = ['sale', 'marketplace_holding', 'marketplace_released', 'marketplace_available', 'profit_earned'].includes(s.stage);
  return {
    id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    companyId: s.companyId,
    type,
    debit: isDebit ? s.amount : 0,
    credit: isDebit ? 0 : s.amount,
    description: `Marketplace settlement [${s.marketplace}] — stage: ${s.stage.replace(/_/g, ' ')}${s.saleRef ? ` (ref: ${s.saleRef})` : ''}`,
    referenceId: s.id,
    date: s.updatedAt.split('T')[0],
    createdAt: new Date().toISOString(),
  };
}
