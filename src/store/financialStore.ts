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
  InventoryItem,
  StockMovement,
  ReconciliationReport,
  InventorySnapshot,
  SaleReship,
  ReshipCosts,
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

// ── Inventory Reconciliation Migration ───────────────────────────────────────
// Scans all MarketplaceSettlements that have inventoryItemId set.
// For any settlement missing a SALE_OUT stock movement, creates one and updates inventory.
// Idempotent — safe to run on every load. Returns same reference if nothing changed.
function applyInventoryReconciliation(data: FinancialData): FinancialData {
  const pending = data.marketplaceSettlements.filter(
    s => s.inventoryItemId && !data.stockMovements.find(m => m.saleId === s.id && m.type === 'SALE_OUT')
  );

  if (pending.length === 0) {
    return data._migrationInventoryReconciliation ? data : { ...data, _migrationInventoryReconciliation: true };
  }

  const mutatedItems = data.inventoryItems.map(i => ({ ...i }));
  const mutatedMovements = [...data.stockMovements];
  const now = new Date().toISOString();

  for (const sale of pending) {
    const item = mutatedItems.find(i => i.id === sale.inventoryItemId);
    if (!item) continue;

    const qty = sale.quantity ?? 1;
    mutatedMovements.push({
      id: `smv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      inventoryItemId: item.id,
      companyId: sale.companyId,
      type: 'SALE_OUT',
      qty,
      unitCost: item.unitCost,
      totalValue: qty * item.unitCost,
      saleId: sale.id,
      note: 'Auto-reconciled on load',
      date: sale.createdAt.split('T')[0],
      createdAt: now,
      isReconciliation: true,
    });
    item.soldQty += qty;
    item.currentQty = Math.max(0, item.purchasedQty - item.soldQty);
    item.updatedAt = now;
  }

  return {
    ...data,
    inventoryItems: mutatedItems,
    stockMovements: mutatedMovements,
    _migrationInventoryReconciliation: true,
  };
}

// ── Reship V1 Migration ───────────────────────────────────────────────────────
// No-op for existing data (no legacy reship records exist). Ensures saleReships array exists.
function applyMigrationReshipV1(data: FinancialData): FinancialData {
  if (data._migrationReshipV1) return data;
  return { ...data, saleReships: data.saleReships ?? [], _migrationReshipV1: true };
}

// ── Persistence ───────────────────────────────────────────────────────────────

const EMPTY: FinancialData = {
  companies: [],
  investors: [],
  capitalTransactions: [],
  profitWithdrawals: [],
  marketplaceSettlements: [],
  ledgerEntries: [],
  inventoryItems: [],
  stockMovements: [],
  saleReships: [],
  _migrationH: false,
  _migrationInventoryReconciliation: false,
  _migrationReshipV1: false,
};

export function getFinancialData(): FinancialData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, _migrationH: true, _migrationInventoryReconciliation: true, _migrationReshipV1: true };
    const parsed = JSON.parse(raw) as FinancialData;
    const migH = applyMigrationH({ ...EMPTY, ...parsed });
    const migInv = applyInventoryReconciliation(migH);
    const result = applyMigrationReshipV1(migInv);
    // Persist if any migration changed state (reference inequality = something mutated)
    if (result !== migH) save(result);
    return result;
  } catch {
    return { ...EMPTY, _migrationH: true, _migrationInventoryReconciliation: true, _migrationReshipV1: true };
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

  // Inventory deduction — atomic with settlement creation
  let updatedInventoryItems = data.inventoryItems;
  let updatedStockMovements = data.stockMovements;

  if (input.inventoryItemId) {
    const item = data.inventoryItems.find(i => i.id === input.inventoryItemId);
    if (item) {
      const qty = input.quantity ?? 1;
      const movement: StockMovement = {
        id: `smv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        inventoryItemId: item.id,
        companyId: rec.companyId,
        type: 'SALE_OUT',
        qty,
        unitCost: item.unitCost,
        totalValue: qty * item.unitCost,
        saleId: rec.id,
        note: `Sale: ${rec.marketplace}${rec.saleRef ? ` (${rec.saleRef})` : ''}`,
        date: now.split('T')[0],
        createdAt: now,
        isReconciliation: false,
      };
      updatedStockMovements = [...data.stockMovements, movement];
      updatedInventoryItems = data.inventoryItems.map(i =>
        i.id === item.id
          ? {
              ...i,
              soldQty: i.soldQty + qty,
              currentQty: Math.max(0, i.purchasedQty - i.soldQty - qty),
              updatedAt: now,
            }
          : i
      );
    }
  }

  save({
    ...data,
    marketplaceSettlements: [...data.marketplaceSettlements, rec],
    ledgerEntries: [...data.ledgerEntries, ledger],
    inventoryItems: updatedInventoryItems,
    stockMovements: updatedStockMovements,
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
  const settlement = data.marketplaceSettlements.find(s => s.id === id);

  // Collect all reships for this settlement and their inventory movements
  const reships = data.saleReships.filter(r => r.saleId === id);
  const reshipIds = new Set(reships.map(r => r.reshipId));

  let inventoryItems = data.inventoryItems;
  const now = new Date().toISOString();

  // Reverse inventory deduction from the original sale
  if (settlement?.inventoryItemId) {
    const movement = data.stockMovements.find(m => m.saleId === id && m.type === 'SALE_OUT' && !m.reshipId);
    if (movement) {
      inventoryItems = inventoryItems.map(i =>
        i.id === settlement.inventoryItemId
          ? { ...i, soldQty: Math.max(0, i.soldQty - movement.qty), currentQty: i.currentQty + movement.qty, updatedAt: now }
          : i
      );
    }
  }

  // Reverse inventory deductions from all cascade-deleted reships
  for (const reship of reships) {
    if (reship.inventoryItemId && reship.inventoryMovementId) {
      const mv = data.stockMovements.find(m => m.id === reship.inventoryMovementId);
      if (mv) {
        inventoryItems = inventoryItems.map(i =>
          i.id === reship.inventoryItemId
            ? { ...i, soldQty: Math.max(0, i.soldQty - mv.qty), currentQty: i.currentQty + mv.qty, updatedAt: now }
            : i
        );
      }
    }
  }

  save({
    ...data,
    marketplaceSettlements: data.marketplaceSettlements.filter(s => s.id !== id),
    saleReships: data.saleReships.filter(r => r.saleId !== id),
    ledgerEntries: data.ledgerEntries.filter(e => e.referenceId !== id && !reshipIds.has(e.referenceId ?? '')),
    stockMovements: data.stockMovements.filter(m => m.saleId !== id && (!m.reshipId || !reshipIds.has(m.reshipId))),
    inventoryItems,
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

// ── Inventory Items CRUD ──────────────────────────────────────────────────────

export function getInventoryItems(): InventoryItem[] {
  return getFinancialData().inventoryItems;
}

export function addInventoryItem(
  input: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'soldQty' | 'currentQty'>
): InventoryItem {
  const data = getFinancialData();
  const now = new Date().toISOString();
  const rec: InventoryItem = {
    ...input,
    id: `itm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    soldQty: 0,
    currentQty: input.purchasedQty,
    createdAt: now,
    updatedAt: now,
  };
  save({ ...data, inventoryItems: [...data.inventoryItems, rec] });
  return rec;
}

export function updateInventoryItem(id: string, patch: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>): void {
  const data = getFinancialData();
  const now = new Date().toISOString();
  save({
    ...data,
    inventoryItems: data.inventoryItems.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, ...patch, updatedAt: now };
      // Recompute currentQty if purchasedQty or soldQty changed
      updated.currentQty = Math.max(0, updated.purchasedQty - updated.soldQty);
      return updated;
    }),
  });
}

export function deleteInventoryItem(id: string): boolean {
  const data = getFinancialData();
  const hasMovements = data.stockMovements.some(m => m.inventoryItemId === id);
  const hasLinkedSales = data.marketplaceSettlements.some(s => s.inventoryItemId === id);
  if (hasMovements || hasLinkedSales) return false;
  save({ ...data, inventoryItems: data.inventoryItems.filter(i => i.id !== id) });
  return true;
}

// ── Stock Movements ───────────────────────────────────────────────────────────

export function getStockMovements(inventoryItemId?: string): StockMovement[] {
  const data = getFinancialData();
  return inventoryItemId
    ? data.stockMovements.filter(m => m.inventoryItemId === inventoryItemId)
    : data.stockMovements;
}

// ── Sale Reships ──────────────────────────────────────────────────────────────

export function getSaleReships(saleId?: string): SaleReship[] {
  const data = getFinancialData();
  return saleId
    ? data.saleReships.filter(r => r.saleId === saleId)
    : data.saleReships;
}

export function addSaleReship(
  input: Omit<SaleReship, 'reshipId' | 'reshipNumber' | 'createdAt' | 'updatedAt' | 'inventoryMovementId'> & {
    costs: ReshipCosts;
  }
): SaleReship {
  const data = getFinancialData();
  const now = new Date().toISOString();
  const existingForSale = data.saleReships.filter(r => r.saleId === input.saleId);
  const reshipNumber = existingForSale.length > 0
    ? Math.max(...existingForSale.map(r => r.reshipNumber)) + 1
    : 1;

  const reshipId = `rsh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const qty = input.qty ?? 1;

  let inventoryMovementId: string | undefined;
  let updatedInventoryItems = data.inventoryItems;
  let updatedStockMovements = data.stockMovements;

  // Deduct replacement inventory if linked
  if (input.inventoryItemId) {
    const item = data.inventoryItems.find(i => i.id === input.inventoryItemId);
    if (item) {
      const mvId = `smv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      inventoryMovementId = mvId;
      const movement: StockMovement = {
        id: mvId,
        inventoryItemId: item.id,
        companyId: item.companyId,
        type: 'SALE_OUT',
        qty,
        unitCost: item.unitCost,
        totalValue: qty * item.unitCost,
        reshipId,
        note: `Reship #${reshipNumber}: ${input.reason}`,
        date: input.reshipDate,
        createdAt: now,
        isReconciliation: false,
      };
      updatedStockMovements = [...data.stockMovements, movement];
      updatedInventoryItems = data.inventoryItems.map(i =>
        i.id === item.id
          ? { ...i, soldQty: i.soldQty + qty, currentQty: Math.max(0, i.purchasedQty - i.soldQty - qty), updatedAt: now }
          : i
      );
    }
  }

  const rec: SaleReship = {
    ...input,
    reshipId,
    reshipNumber,
    qty,
    inventoryMovementId,
    createdAt: now,
    updatedAt: now,
  };

  // Build ledger entries for reship costs
  const grossCost =
    input.costs.shippingLabelCost +
    (input.costs.replacementProductCost * qty) +
    input.costs.packagingCost +
    input.costs.insuranceCost +
    input.costs.otherCost;

  const sale = data.marketplaceSettlements.find(s => s.id === input.saleId);
  const newLedger: LedgerEntry[] = [];

  if (grossCost > 0) {
    newLedger.push({
      id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      companyId: sale?.companyId ?? '',
      type: 'reship_cost',
      debit: grossCost,
      credit: 0,
      description: `Reship #${reshipNumber} cost — ${input.reason}${sale?.saleRef ? ` (sale: ${sale.saleRef})` : ''}`,
      referenceId: reshipId,
      date: input.reshipDate,
      createdAt: now,
    });
  }

  if (input.inventoryItemId && input.costs.replacementProductCost > 0) {
    const item = data.inventoryItems.find(i => i.id === input.inventoryItemId);
    newLedger.push({
      id: `led_${Date.now() + 1}_${Math.random().toString(36).slice(2, 9)}`,
      companyId: sale?.companyId ?? '',
      type: 'reship_inventory',
      debit: input.costs.replacementProductCost * qty,
      credit: 0,
      description: `Reship #${reshipNumber} replacement inventory × ${qty}${item ? ` [${item.sku}]` : ''}`,
      referenceId: reshipId,
      date: input.reshipDate,
      createdAt: now,
    });
  }

  save({
    ...data,
    saleReships: [...data.saleReships, rec],
    ledgerEntries: [...data.ledgerEntries, ...newLedger],
    inventoryItems: updatedInventoryItems,
    stockMovements: updatedStockMovements,
  });

  return rec;
}

export function updateSaleReship(reshipId: string, patch: Partial<Omit<SaleReship, 'reshipId' | 'reshipNumber' | 'saleId' | 'createdAt'>>): void {
  const data = getFinancialData();
  const now = new Date().toISOString();
  save({
    ...data,
    saleReships: data.saleReships.map(r =>
      r.reshipId === reshipId ? { ...r, ...patch, reshipId: r.reshipId, reshipNumber: r.reshipNumber, saleId: r.saleId, createdAt: r.createdAt, updatedAt: now } : r
    ),
  });
}

export function deleteSaleReship(reshipId: string): void {
  const data = getFinancialData();
  const reship = data.saleReships.find(r => r.reshipId === reshipId);
  if (!reship) return;

  let inventoryItems = data.inventoryItems;
  const now = new Date().toISOString();

  // Reverse inventory deduction if linked
  if (reship.inventoryItemId && reship.inventoryMovementId) {
    const mv = data.stockMovements.find(m => m.id === reship.inventoryMovementId);
    if (mv) {
      inventoryItems = data.inventoryItems.map(i =>
        i.id === reship.inventoryItemId
          ? { ...i, soldQty: Math.max(0, i.soldQty - mv.qty), currentQty: i.currentQty + mv.qty, updatedAt: now }
          : i
      );
    }
  }

  save({
    ...data,
    saleReships: data.saleReships.filter(r => r.reshipId !== reshipId),
    ledgerEntries: data.ledgerEntries.filter(e => e.referenceId !== reshipId),
    stockMovements: data.stockMovements.filter(m => m.reshipId !== reshipId),
    inventoryItems,
  });
}

// ── Inventory Reconciliation (explicit, with report) ─────────────────────────
// Reads raw localStorage to capture the true "before" state, then reconciles and saves.
// Returns a full ReconciliationReport. Safe to call multiple times — idempotent.
export function runInventoryReconciliation(): ReconciliationReport {
  let raw: FinancialData;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    raw = stored ? { ...EMPTY, ...(JSON.parse(stored) as FinancialData) } : { ...EMPTY };
  } catch {
    raw = { ...EMPTY };
  }

  // Snapshot inventory BEFORE reconciliation
  const inventoryBefore: InventorySnapshot[] = raw.inventoryItems.map(i => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    soldQty: i.soldQty,
    currentQty: i.currentQty,
    inventoryValue: i.currentQty * i.unitCost,
  }));

  const linkedSales = raw.marketplaceSettlements.filter(s => s.inventoryItemId);
  let stockMovementsCreated = 0;
  let duplicateMovementsSkipped = 0;
  let productsUpdated = 0;
  const remainingIssues: string[] = [];

  const mutatedItems = raw.inventoryItems.map(i => ({ ...i }));
  const mutatedMovements = [...raw.stockMovements];
  const now = new Date().toISOString();

  for (const sale of linkedSales) {
    const item = mutatedItems.find(i => i.id === sale.inventoryItemId);
    if (!item) {
      remainingIssues.push(`Sale "${sale.saleRef ?? sale.id}" — linked inventory item "${sale.inventoryItemId ?? ''}" not found`);
      continue;
    }

    const existing = mutatedMovements.find(m => m.saleId === sale.id && m.type === 'SALE_OUT');
    if (existing) {
      duplicateMovementsSkipped++;
      continue;
    }

    const qty = sale.quantity ?? 1;
    mutatedMovements.push({
      id: `smv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      inventoryItemId: item.id,
      companyId: sale.companyId,
      type: 'SALE_OUT',
      qty,
      unitCost: item.unitCost,
      totalValue: qty * item.unitCost,
      saleId: sale.id,
      note: 'Reconciliation: auto-created from linked sale',
      date: sale.createdAt.split('T')[0],
      createdAt: now,
      isReconciliation: true,
    });

    item.soldQty += qty;
    item.currentQty = Math.max(0, item.purchasedQty - item.soldQty);
    item.updatedAt = now;
    stockMovementsCreated++;
    productsUpdated++;
  }

  // Also validate items that have more sold than purchased
  for (const item of mutatedItems) {
    if (item.soldQty > item.purchasedQty) {
      remainingIssues.push(`SKU "${item.sku}" — soldQty (${item.soldQty}) exceeds purchasedQty (${item.purchasedQty})`);
    }
  }

  const inventoryAfter: InventorySnapshot[] = mutatedItems.map(i => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    soldQty: i.soldQty,
    currentQty: i.currentQty,
    inventoryValue: i.currentQty * i.unitCost,
  }));

  // Save the reconciled data (also apply Migration H for safety)
  const updated: FinancialData = applyMigrationH({
    ...raw,
    inventoryItems: mutatedItems,
    stockMovements: mutatedMovements,
    _migrationInventoryReconciliation: true,
  });
  save(updated);

  return {
    historicalSalesScanned: raw.marketplaceSettlements.length,
    inventoryLinkedSalesFound: linkedSales.length,
    stockMovementsCreated,
    duplicateMovementsSkipped,
    productsUpdated,
    inventoryBefore,
    inventoryAfter,
    remainingIssues,
  };
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
