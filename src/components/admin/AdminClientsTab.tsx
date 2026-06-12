import {
  type ClientUser, type Order, type Invoice, type InvoiceItem, type SiteSettings,
  updateOrder, addOrderUpdate, createInvoice, updateInvoiceStatus, deleteInvoice, updateInvoice, calcTax, TX_TAX_RATE,
  holdOrder, resumeOrder, markInstallmentPaid, addClientDeadline, markDeadlineReceived, markDeadlineOverdue,
} from '../../utils/storage';
import {
  updateOrderInSupabase,
  setupOrderInstallmentsInSupabase,
  markInstallmentPaidInSupabase,
  createAdminOrderInSupabase,
} from '../../utils/supabaseData';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { downloadInvoice, emailInvoiceToClient } from '../../utils/invoice';
import { bgCard, bgElevated, bgInput, border, borderLight, textSecondary, textMuted } from './types';

interface Props {
  clients: ClientUser[];
  allOrders: Order[];
  allInvoices: Invoice[];
  selClientId: string | null;
  setSelClientId: (id: string | null) => void;
  selAdminOrder: Order | null;
  setSelAdminOrder: (o: Order | null) => void;
  adminUpdateMsg: string;
  setAdminUpdateMsg: (v: string) => void;
  showInvForm: boolean;
  setShowInvForm: (v: boolean) => void;
  invItems: InvoiceItem[];
  setInvItems: (items: InvoiceItem[]) => void;
  invMeta: { clientId: string; note: string; dueDate: string; packageName: string; autoTax: boolean };
  setInvMeta: (v: { clientId: string; note: string; dueDate: string; packageName: string; autoTax: boolean }) => void;
  editInvId: string | null;
  setEditInvId: (id: string | null) => void;
  dlItem: string;
  setDlItem: (v: string) => void;
  dlDate: string;
  setDlDate: (v: string) => void;
  holdMsg: string;
  setHoldMsg: (v: string) => void;
  holdType: 'payment_overdue' | 'client_delay' | 'admin_pause';
  setHoldType: (v: 'payment_overdue' | 'client_delay' | 'admin_pause') => void;
  instCount: number;
  setInstCount: (v: number) => void;
  showNewOrder: string | null;
  setShowNewOrder: (id: string | null) => void;
  newOrd: { service: string; pkg: string; price: number; notes: string; installments: number };
  setNewOrd: (v: { service: string; pkg: string; price: number; notes: string; installments: number }) => void;
  settings: SiteSettings;
  reload: () => void;
}

export default function AdminClientsTab({
  clients, allOrders, allInvoices,
  selClientId, setSelClientId,
  selAdminOrder, setSelAdminOrder,
  adminUpdateMsg, setAdminUpdateMsg,
  showInvForm, setShowInvForm,
  invItems, setInvItems,
  invMeta, setInvMeta,
  editInvId, setEditInvId,
  dlItem, setDlItem,
  dlDate, setDlDate,
  holdMsg, setHoldMsg,
  holdType, setHoldType,
  instCount, setInstCount,
  showNewOrder, setShowNewOrder,
  newOrd, setNewOrd,
  settings,
  reload,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clients.map(c => {
          const co = allOrders.filter(o => o.clientId === c.id);
          const ci = allInvoices.filter(i => i.clientId === c.id);
          return (
            <div key={c.id} className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: selClientId === c.id ? 'rgba(0,229,255,0.4)' : border }}>
              <div className="p-4 cursor-pointer" onClick={() => setSelClientId(selClientId === c.id ? null : c.id)}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border" style={{ background: bgElevated, borderColor: border, color: textSecondary }}>{c.name[0]}</div>
                  <div><p className="text-[14px] font-medium text-white">{c.name}</p><p className="text-xs" style={{ color: textMuted }}>{c.email}{c.company ? ` • ${c.company}` : ''}</p></div>
                </div>
                <div className="flex gap-3 text-xs" style={{ color: textSecondary }}><span>📦 {co.length} orders</span><span>📄 {ci.length} invoices</span><span>${ci.filter(i => i.status === 'paid').reduce((a, i) => a + i.total, 0).toLocaleString()} paid</span></div>
              </div>
              {selClientId === c.id && (
                <div className="border-t p-4 space-y-3" style={{ borderColor: borderLight, background: bgElevated }}>
                  <p className="text-xs font-semibold text-white">Orders</p>
                  {co.map(o => (
                    <div key={o.id} className={`p-3 rounded-lg border ${o.onHold ? 'border-red-500/30 bg-red-500/5' : ''}`} style={!o.onHold ? { borderColor: borderLight, background: bgCard } : undefined}>
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[13px] text-white font-medium">{o.service} — ${o.price}</p>
                        <select value={o.status} onChange={e => { if (isSupabaseAuthEnabled()) { void updateOrderInSupabase(o.id, { status: e.target.value as Order['status'] }).then(() => reload()); } else { updateOrder(o.id, { status: e.target.value as Order['status'] }); void reload(); } }} className="text-[10px] rounded px-1 py-0.5 border" style={{ background: 'transparent', borderColor: borderLight, color: textSecondary }}>
                          {['pending','in_progress','review','revision','completed','cancelled','on_hold'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {/* Hold Banner */}
                      {o.onHold && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 mb-2">
                          <p className="text-[11px] text-red-400 font-medium">⚠️ ON HOLD — {o.holdReason === 'payment_overdue' ? 'Payment Overdue' : o.holdReason === 'client_delay' ? 'Client Delay' : 'Paused'}</p>
                          {o.holdMessage && <p className="text-[10px] text-red-400/70 mt-0.5">{o.holdMessage}</p>}
                          <button onClick={() => { resumeOrder(o.id); reload(); }} className="mt-1.5 px-3 py-1 rounded text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/20">▶ Resume Project</button>
                        </div>
                      )}
                      {/* Progress */}
                      <div className="flex items-center gap-2 mb-2"><span className="text-xs" style={{ color: textMuted }}>Progress:</span><input type="range" min="0" max="100" value={o.progress} onChange={e => { const progress = parseInt(e.target.value); if (isSupabaseAuthEnabled()) { void updateOrderInSupabase(o.id, { progress }).then(() => reload()); } else { updateOrder(o.id, { progress }); void reload(); } }} className="flex-1 h-1" /><span className="text-xs text-cyan-glow">{o.progress}%</span></div>
                      {/* Payment Plan */}
                      <div className="p-2 rounded-lg mb-2 border" style={{ borderColor: borderLight, background: bgElevated }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-white">💰 Payment: ${o.totalPaid || 0} / ${o.price}</span>
                          <span className="text-[10px]" style={{ color: textMuted }}>{o.paymentPlan === 'installment' ? `${o.installments.length} installments` : 'Full payment'}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: borderLight }}><div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${o.price > 0 ? (o.totalPaid || 0) / o.price * 100 : 0}%` }} /></div>
                        {/* Installments */}
                        {o.installments.length > 0 && o.installments.map(inst => (
                          <div key={inst.id} className="flex items-center justify-between py-1 border-t" style={{ borderColor: borderLight }}>
                            <span className="text-[10px]" style={{ color: textSecondary }}>{inst.label} — ${inst.amount} — Due: {inst.dueDate}</span>
                            {inst.status === 'paid' ? <span className="text-[9px] text-green-400">✓ Paid</span> : (
                              <button onClick={() => { if (isSupabaseAuthEnabled()) { void markInstallmentPaidInSupabase(o.id, inst.id).then(() => reload()); } else { markInstallmentPaid(o.id, inst.id); void reload(); } }} className="text-[9px] text-cyan-glow hover:underline">Mark Paid</button>
                            )}
                          </div>
                        ))}
                        {/* Setup installments */}
                        {o.paymentPlan === 'full' && o.status !== 'completed' && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: borderLight }}>
                            <select value={instCount} onChange={e => setInstCount(+e.target.value)} className="px-1 py-0.5 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }}>
                              {[2,3,4,5,6].map(n => <option key={n} value={n}>{n} parts</option>)}
                            </select>
                            <button onClick={() => {
                              const amt = Math.round(o.price / instCount * 100) / 100;
                              const insts = Array.from({ length: instCount }, (_, i) => ({
                                id: `inst_${Date.now()}_${i}`, amount: i === instCount - 1 ? o.price - amt * (instCount - 1) : amt,
                                dueDate: new Date(Date.now() + (i + 1) * 15 * 86400000).toISOString().split('T')[0],
                                status: 'pending' as const, label: `Installment ${i + 1} of ${instCount}`,
                              }));
                              if (isSupabaseAuthEnabled()) {
                                void setupOrderInstallmentsInSupabase(o.id, o.price, instCount).then(() => reload());
                              } else {
                                updateOrder(o.id, { paymentPlan: 'installment', installments: insts }); void reload();
                              }
                            }} className="text-[10px] text-cyan-glow hover:underline">Setup Flex Payment</button>
                          </div>
                        )}
                      </div>
                      {/* Hold controls */}
                      {!o.onHold && o.status !== 'completed' && (
                        <div className="flex gap-1.5 mb-2">
                          <select value={holdType} onChange={e => setHoldType(e.target.value as typeof holdType)} className="px-1 py-0.5 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }}>
                            <option value="payment_overdue">Payment Overdue</option><option value="client_delay">Client Delay</option><option value="admin_pause">Admin Pause</option>
                          </select>
                          <input value={holdMsg} onChange={e => setHoldMsg(e.target.value)} placeholder="Reason..." className="flex-1 px-2 py-0.5 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                          <button onClick={() => { holdOrder(o.id, holdType, holdMsg || 'Work paused'); setHoldMsg(''); reload(); }} className="px-2 py-0.5 rounded text-[10px] text-red-400 border border-red-500/20">⏸ Hold</button>
                        </div>
                      )}
                      {/* Client Deadlines */}
                      {(o.clientDeadlines || []).length > 0 && (
                        <div className="p-2 rounded-lg mb-2 border" style={{ borderColor: borderLight, background: bgElevated }}>
                          <span className="text-[10px] font-medium text-white">📋 Waiting from client:</span>
                          {o.clientDeadlines.map(dl => (
                            <div key={dl.id} className="flex items-center justify-between py-1 border-t" style={{ borderColor: borderLight }}>
                              <span className={`text-[10px] ${dl.status === 'overdue' ? 'text-red-400' : dl.status === 'received' ? 'text-green-400' : ''}`} style={dl.status === 'pending' ? { color: textSecondary } : undefined}>{dl.item} — {dl.dueDate}</span>
                              <div className="flex gap-1">
                                {dl.status === 'pending' && <><button onClick={() => { markDeadlineReceived(o.id, dl.id); reload(); }} className="text-[9px] text-green-400">✓ Got</button><button onClick={() => { markDeadlineOverdue(o.id, dl.id); reload(); }} className="text-[9px] text-red-400">⚠ Late</button></>}
                                {dl.status === 'received' && <span className="text-[9px] text-green-400">✓</span>}
                                {dl.status === 'overdue' && <span className="text-[9px] text-red-400">⏸ Holding</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Add deadline */}
                      <div className="flex gap-1.5 mb-2">
                        <input value={dlItem} onChange={e => setDlItem(e.target.value)} placeholder="Request item from client..." className="flex-1 px-2 py-1 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                        <input type="date" value={dlDate} onChange={e => setDlDate(e.target.value)} className="px-1 py-1 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                        <button onClick={() => { if (dlItem && dlDate) { addClientDeadline(o.id, dlItem, dlDate); setDlItem(''); setDlDate(''); reload(); } }} className="px-2 py-1 rounded text-[10px] bg-cyan-glow/20 text-cyan-glow">+</button>
                      </div>
                      {/* Message */}
                      <div className="flex gap-2">
                        <input value={selAdminOrder?.id === o.id ? adminUpdateMsg : ''} onFocus={() => setSelAdminOrder(o)} onChange={e => setAdminUpdateMsg(e.target.value)} placeholder="Send update..." className="flex-1 px-2 py-1 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                        <button onClick={() => { if (adminUpdateMsg.trim()) { addOrderUpdate(o.id, adminUpdateMsg, 'admin'); setAdminUpdateMsg(''); reload(); } }} className="px-2 py-1 rounded text-xs bg-cyan-glow text-midnight">Send</button>
                      </div>
                    </div>
                  ))}
                  {co.length === 0 && <p className="text-xs" style={{ color: textMuted }}>No orders</p>}

                  {/* Create Order for Client */}
                  {showNewOrder === c.id ? (
                    <div className="p-3 rounded-xl border space-y-2" style={{ borderColor: borderLight, background: bgCard }}>
                      <p className="text-xs font-semibold text-white">📦 New Order for {c.name}</p>
                      <input value={newOrd.service} onChange={e => setNewOrd({ ...newOrd, service: e.target.value })} placeholder="Service name — e.g. Business Website" className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                      <input value={newOrd.pkg} onChange={e => setNewOrd({ ...newOrd, pkg: e.target.value })} placeholder="Package details" className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                      <div className="flex gap-2">
                        <input type="number" value={newOrd.price || ''} onChange={e => setNewOrd({ ...newOrd, price: +e.target.value })} placeholder="Price $" className="flex-1 px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                        <select value={newOrd.installments} onChange={e => setNewOrd({ ...newOrd, installments: +e.target.value })} className="px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }}>
                          <option value={1}>Full Pay</option><option value={2}>2 parts</option><option value={3}>3 parts</option><option value={4}>4 parts</option><option value={6}>6 parts</option>
                        </select>
                      </div>
                      <textarea value={newOrd.notes} onChange={e => setNewOrd({ ...newOrd, notes: e.target.value })} placeholder="Notes..." rows={2} className="w-full px-2 py-1.5 rounded text-xs text-white resize-none" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                      <div className="flex gap-2">
                        <button onClick={() => setShowNewOrder(null)} className="px-3 py-1.5 rounded text-xs border" style={{ borderColor: borderLight, color: textSecondary }}>Cancel</button>
                        <button onClick={() => {
                          if (!newOrd.service || !newOrd.price) return;
                          if (isSupabaseAuthEnabled()) {
                            void createAdminOrderInSupabase({
                              clientId: c.id,
                              service: newOrd.service,
                              package: newOrd.pkg,
                              price: newOrd.price,
                              notes: newOrd.notes,
                              installmentCount: newOrd.installments > 1 ? newOrd.installments : undefined,
                            }).then(() => {
                              setShowNewOrder(null); setNewOrd({ service: '', pkg: '', price: 0, notes: '', installments: 1 }); reload();
                            });
                          } else {
                            import('../../utils/storage').then(({ adminCreateOrder }) => {
                              adminCreateOrder(c.id, newOrd.service, newOrd.pkg, newOrd.price, newOrd.notes, newOrd.installments > 1 ? newOrd.installments : undefined);
                              setShowNewOrder(null); setNewOrd({ service: '', pkg: '', price: 0, notes: '', installments: 1 }); void reload();
                            });
                          }
                        }} disabled={!newOrd.service || !newOrd.price} className="flex-1 py-1.5 rounded text-xs font-medium bg-cyan-glow text-midnight disabled:opacity-40">Create Order</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowNewOrder(c.id)} className="w-full py-2 rounded-lg text-xs font-medium bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/15 hover:bg-cyan-glow/15 transition-colors">📦 + Create Order</button>
                  )}

                  {/* Invoice Creator */}
                  {!showInvForm || invMeta.clientId !== c.id ? (
                    <button onClick={() => { setShowInvForm(true); setInvMeta({ clientId: c.id, note: '', dueDate: '', packageName: '', autoTax: true }); setInvItems([{ description: '', quantity: 1, rate: 0, amount: 0, type: 'package' }]); }} className="w-full py-2.5 rounded-lg text-xs font-medium border hover:bg-white/5" style={{ borderColor: border, color: textSecondary }}>+ Create Invoice</button>
                  ) : (
                    <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: borderLight, background: bgCard }}>
                      <p className="text-xs font-semibold text-white">📄 New Invoice — {c.name}</p>
                      {/* Package name */}
                      <div><label className="text-[10px]" style={{ color: textMuted }}>Package Name</label>
                        <input value={invMeta.packageName} onChange={e => setInvMeta({ ...invMeta, packageName: e.target.value })} placeholder="e.g. Starter, Professional, Enterprise..." className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} /></div>
                      {/* Line items */}
                      {invItems.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex gap-2 items-end">
                            <div className="flex-1"><input value={item.description} onChange={e => { const n = [...invItems]; n[idx].description = e.target.value; setInvItems(n); }} placeholder="Description" className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} /></div>
                            <select value={item.type || 'custom'} onChange={e => { const n = [...invItems]; n[idx].type = e.target.value as InvoiceItem['type']; setInvItems(n); }} className="px-1 py-1.5 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }}>
                              <option value="package">📦 Pkg</option><option value="addon">➕ Add-on</option><option value="monthly">🔄 Monthly</option><option value="custom">🔧 Custom</option>
                            </select>
                            {invItems.length > 1 && <button onClick={() => setInvItems(invItems.filter((_, i) => i !== idx))} className="text-red-400 text-xs px-1">✕</button>}
                          </div>
                          <div className="flex gap-2">
                            <input type="number" value={item.quantity || ''} onChange={e => { const n = [...invItems]; n[idx].quantity = +e.target.value; n[idx].amount = n[idx].quantity * n[idx].rate; setInvItems(n); }} placeholder="Qty" className="w-16 px-2 py-1 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                            <input type="number" value={item.rate || ''} onChange={e => { const n = [...invItems]; n[idx].rate = +e.target.value; n[idx].amount = n[idx].quantity * n[idx].rate; setInvItems(n); }} placeholder="Rate $" className="flex-1 px-2 py-1 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                            <span className="text-xs text-cyan-glow w-20 text-right pt-1">${(item.quantity * item.rate).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => setInvItems([...invItems, { description: '', quantity: 1, rate: 0, amount: 0, type: 'addon' }])} className="text-xs text-cyan-glow hover:underline">+ Add line item</button>
                      {/* Tax & Due date */}
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={invMeta.autoTax} onChange={e => setInvMeta({ ...invMeta, autoTax: e.target.checked })} className="w-3 h-3 rounded" /><span className="text-[10px] text-white">Auto TX Tax ({TX_TAX_RATE}%)</span></label>
                      </div>
                      <div><label className="text-[10px]" style={{ color: textMuted }}>Due Date</label><input type="date" value={invMeta.dueDate} onChange={e => setInvMeta({ ...invMeta, dueDate: e.target.value })} className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} /></div>
                      <div><label className="text-[10px]" style={{ color: textMuted }}>Notes (payment terms, scope, etc.)</label>
                        <textarea value={invMeta.note} onChange={e => setInvMeta({ ...invMeta, note: e.target.value })} placeholder="e.g. 50% upfront deposit. Remaining due on delivery..." rows={3} className="w-full px-2 py-1.5 rounded text-xs text-white resize-none" style={{ background: bgInput, border: `1px solid ${borderLight}` }} /></div>
                      {/* Totals preview */}
                      {(() => {
                        const sub = invItems.reduce((a, i) => a + i.quantity * i.rate, 0);
                        const tx = invMeta.autoTax ? calcTax(sub) : { taxAmount: 0, total: sub };
                        return (
                          <div className="pt-2 border-t space-y-1" style={{ borderColor: borderLight }}>
                            <div className="flex justify-between text-xs"><span style={{ color: textMuted }}>Subtotal</span><span className="text-white">${sub.toLocaleString()}</span></div>
                            <div className="flex justify-between text-xs"><span style={{ color: textMuted }}>Tax ({invMeta.autoTax ? `${TX_TAX_RATE}% TX` : '0%'})</span><span className="text-white">${tx.taxAmount.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm font-bold"><span className="text-white">Total</span><span className="text-cyan-glow">${tx.total.toLocaleString()}</span></div>
                          </div>
                        );
                      })()}
                      {/* Actions: Save Draft / Send */}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setShowInvForm(false)} className="px-3 py-2 rounded-lg text-xs border" style={{ borderColor: borderLight, color: textSecondary }}>Cancel</button>
                        <button onClick={() => {
                          const items = invItems.map(i => ({ ...i, amount: i.quantity * i.rate }));
                          const sub = items.reduce((a, i) => a + i.amount, 0);
                          const tx = invMeta.autoTax ? calcTax(sub) : { taxAmount: 0, total: sub };
                          createInvoice({ clientId: c.id, packageName: invMeta.packageName || undefined, items, subtotal: sub, taxRate: invMeta.autoTax ? TX_TAX_RATE : 0, taxAmount: tx.taxAmount, total: tx.total, status: 'draft', note: invMeta.note || undefined, dueDate: invMeta.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] });
                          setShowInvForm(false); setInvItems([{ description: '', quantity: 1, rate: 0, amount: 0, type: 'package' }]); setInvMeta({ clientId: '', note: '', dueDate: '', packageName: '', autoTax: true }); reload();
                        }} disabled={!invItems[0]?.description || !invItems[0]?.rate} className="flex-1 py-2 rounded-lg text-xs font-medium border disabled:opacity-40 hover:bg-white/5" style={{ borderColor: border, color: textSecondary }}>💾 Save Draft</button>
                        <button onClick={() => {
                          const items = invItems.map(i => ({ ...i, amount: i.quantity * i.rate }));
                          const sub = items.reduce((a, i) => a + i.amount, 0);
                          const tx = invMeta.autoTax ? calcTax(sub) : { taxAmount: 0, total: sub };
                          const inv = createInvoice({ clientId: c.id, packageName: invMeta.packageName || undefined, items, subtotal: sub, taxRate: invMeta.autoTax ? TX_TAX_RATE : 0, taxAmount: tx.taxAmount, total: tx.total, status: 'sent', note: invMeta.note || undefined, dueDate: invMeta.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] });
                          emailInvoiceToClient(inv, settings.email);
                          setShowInvForm(false); setInvItems([{ description: '', quantity: 1, rate: 0, amount: 0, type: 'package' }]); setInvMeta({ clientId: '', note: '', dueDate: '', packageName: '', autoTax: true }); reload();
                        }} disabled={!invItems[0]?.description || !invItems[0]?.rate} className="flex-1 py-2 rounded-lg text-xs font-medium bg-cyan-glow text-midnight disabled:opacity-40">📧 Send Invoice</button>
                      </div>
                    </div>
                  )}

                  {ci.length > 0 && <p className="text-xs font-semibold text-white pt-2">Invoices</p>}
                  {ci.map(inv => (
                    <div key={inv.id} className="p-3 rounded-lg border" style={{ borderColor: borderLight, background: bgCard }}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className="text-[13px] text-white font-medium">{inv.invoiceNumber} — ${inv.total.toLocaleString()}</p>
                          <p className="text-[10px]" style={{ color: textMuted }}>{inv.packageName ? `📦 ${inv.packageName} • ` : ''}{inv.items.length} items • Tax: ${inv.taxRate || 0}%</p>
                        </div>
                        <select value={inv.status} onChange={e => { updateInvoiceStatus(inv.id, e.target.value as Invoice['status']); reload(); }} className="text-[10px] rounded px-1 py-0.5 border" style={{ background: 'transparent', borderColor: borderLight, color: textSecondary }}>
                          {['draft','sent','paid','overdue'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {editInvId === inv.id ? (
                        <div className="mt-2 space-y-2 pt-2 border-t" style={{ borderColor: borderLight }}>
                          <textarea defaultValue={inv.note || ''} onBlur={e => { updateInvoice(inv.id, { note: e.target.value }); reload(); }} placeholder="Edit notes..." rows={2} className="w-full px-2 py-1.5 rounded text-xs text-white resize-none" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                          <button onClick={() => setEditInvId(null)} className="text-[10px] text-cyan-glow">Done editing</button>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => downloadInvoice(inv)} className="text-[10px] text-cyan-glow hover:underline">📥 Download</button>
                          <button onClick={() => { emailInvoiceToClient(inv, settings.email); alert('Invoice emailed to client!'); }} className="text-[10px] text-green-400 hover:underline">📧 Email</button>
                          <button onClick={() => setEditInvId(inv.id)} className="text-[10px] hover:underline" style={{ color: textSecondary }}>✏️ Edit</button>
                          <button onClick={() => { if (confirm('Delete invoice?')) { deleteInvoice(inv.id); reload(); } }} className="text-[10px] text-red-400 hover:underline ml-auto">Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {clients.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: border, color: textMuted }}>No clients registered yet.</div>}
    </div>
  );
}
