import { type Order, type OrderNote, getOrderNotes, addOrderNote } from '../../utils/storage';
import { addOrderUpdateInSupabase, fetchClientOrders, notifyAdminInSupabase } from '../../utils/supabaseData';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { addOrderUpdate, getClientOrders } from '../../utils/storage';
import { type View, bgCard, bgEl, bgIn, bdL, bd, tSec, tMut, statusMap, fmt } from './types';
import { useState, useEffect } from 'react';

interface Props {
  view: View;
  orders: Order[];
  selOrder: Order | null;
  setSelOrder: (o: Order | null) => void;
  setView: (v: View) => void;
  updateMsg: string;
  setUpdateMsg: (v: string) => void;
  session: { id: string; name: string; email: string } | null;
  loadPortalData: (clientId: string) => Promise<void>;
}

export default function ClientOrdersView({ view, orders, selOrder, setSelOrder, setView, updateMsg, setUpdateMsg, session, loadPortalData }: Props) {
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (selOrder) { setNotes(getOrderNotes(selOrder.id)); }
  }, [selOrder]);

  const handleSendUpdate = async () => {
    if (!updateMsg.trim() || !selOrder) return;
    if (isSupabaseAuthEnabled()) {
      await addOrderUpdateInSupabase(selOrder.id, updateMsg, 'client');
      await notifyAdminInSupabase({
        type: 'order',
        title: 'Client Project Message',
        message: `${session?.name} (${session?.email}) sent a message on ${selOrder.service}: ${updateMsg}`,
        entityId: selOrder.id,
      });
    } else {
      addOrderUpdate(selOrder.id, updateMsg, 'client');
    }
    setUpdateMsg('');
    await loadPortalData(session!.id);
    const refreshedOrders = isSupabaseAuthEnabled() ? await fetchClientOrders(session!.id) : getClientOrders(session!.id);
    setSelOrder(refreshedOrders.find(o => o.id === selOrder.id) || null);
  };

  if (view === 'orders') {
    return (
      <div className="max-w-4xl space-y-4">
        {orders.map(o => (
          <div key={o.id} className="rounded-xl p-5 border cursor-pointer hover:border-cyan-glow/30 transition-colors" style={{ background: bgCard, borderColor: bd }} onClick={() => { setSelOrder(o); setView('order-detail'); }}>
            <div className="flex items-center justify-between mb-3">
              <div><p className="font-semibold text-white">{o.service}</p><p className="text-[13px]" style={{ color: tSec }}>{o.package} • ${o.price.toLocaleString()}</p></div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${statusMap[o.status]?.color}`}>{statusMap[o.status]?.label}</span>
            </div>
            <div className="flex items-center gap-3"><div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: bdL }}><div className="h-full rounded-full bg-cyan-glow transition-all" style={{ width: `${o.progress}%` }} /></div><span className="text-xs text-cyan-glow font-medium">{o.progress}%</span></div>
            <p className="text-xs mt-2" style={{ color: tMut }}>{fmt(o.createdAt)}{o.dueDate ? ` • Due: ${o.dueDate}` : ''}</p>
          </div>
        ))}
        {orders.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: bd, color: tMut }}>No orders yet. <button onClick={() => setView('services')} className="text-cyan-glow underline ml-1">Browse services</button></div>}
      </div>
    );
  }

  if (view === 'order-detail' && selOrder) {
    return (
      <>
        <div className="max-w-2xl space-y-6">
          <button onClick={() => setView('orders')} className="text-xs hover:text-white transition-colors" style={{ color: tSec }}>← Back to orders</button>
          <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }}>
            <div className="p-5 border-b" style={{ borderColor: bdL }}>
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-white text-lg">{selOrder.service}</h3><span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusMap[selOrder.status]?.color}`}>{statusMap[selOrder.status]?.label}</span></div>
              <p className="text-[14px]" style={{ color: tSec }}>{selOrder.package}</p>
              <div className="flex items-center gap-4 mt-3"><span className="text-cyan-glow font-bold text-lg">${selOrder.price.toLocaleString()}</span>{selOrder.dueDate && <span className="text-xs" style={{ color: tMut }}>Due: {selOrder.dueDate}</span>}</div>
            </div>
            <div className="p-5 space-y-4">
              {/* Progress */}
              <div className="flex items-center gap-3"><span className="text-xs font-medium" style={{ color: tSec }}>Progress</span><div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: bdL }}><div className="h-full rounded-full bg-cyan-glow transition-all" style={{ width: `${selOrder.progress}%` }} /></div><span className="text-sm text-cyan-glow font-bold">{selOrder.progress}%</span></div>

              {/* Hold Banner */}
              {selOrder.onHold && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-[14px] font-semibold text-red-400">⚠️ Project On Hold</p>
                  <p className="text-[13px] text-red-400/80 mt-1">{selOrder.holdMessage}</p>
                  {selOrder.holdReason === 'payment_overdue' && <p className="text-[12px] text-red-400/60 mt-2">Please complete your pending payment to resume work.</p>}
                  {selOrder.holdReason === 'client_delay' && <p className="text-[12px] text-red-400/60 mt-2">Note: Your payment schedule remains unchanged regardless of project delays.</p>}
                </div>
              )}

              {/* Payment Status */}
              <div className="p-4 rounded-xl border" style={{ background: bgEl, borderColor: bdL }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white">💰 Payment Status</span>
                  <span className="text-xs text-cyan-glow font-semibold">${selOrder.totalPaid || 0} / ${selOrder.price} paid</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: bdL }}><div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${selOrder.price > 0 ? (selOrder.totalPaid || 0) / selOrder.price * 100 : 0}%` }} /></div>
                {selOrder.paymentPlan === 'installment' && selOrder.installments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium" style={{ color: tMut }}>Flexible Payment Plan:</p>
                    {selOrder.installments.map(inst => (
                      <div key={inst.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg border" style={{ borderColor: bdL, background: bgCard }}>
                        <div>
                          <span className="text-[13px] text-white">{inst.label}</span>
                          <span className="text-[11px] ml-2" style={{ color: tMut }}>Due: {inst.dueDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-white">${inst.amount}</span>
                          {inst.status === 'paid' ? <span className="text-[10px] text-green-400 font-medium">✓ Paid</span> :
                           inst.status === 'overdue' ? <span className="text-[10px] text-red-400 font-medium">⚠ Overdue</span> :
                           <span className="text-[10px] font-medium" style={{ color: tMut }}>Pending</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Deadlines */}
              {(selOrder.clientDeadlines || []).length > 0 && (
                <div className="p-4 rounded-xl border" style={{ background: bgEl, borderColor: bdL }}>
                  <p className="text-xs font-medium text-white mb-2">📋 Items Requested From You</p>
                  {selOrder.clientDeadlines.map(dl => (
                    <div key={dl.id} className={`flex items-center justify-between py-2 border-t ${dl.status === 'overdue' ? 'bg-red-500/5' : ''}`} style={{ borderColor: bdL }}>
                      <div>
                        <p className={`text-[13px] ${dl.status === 'overdue' ? 'text-red-400' : dl.status === 'received' ? 'text-green-400' : 'text-white'}`}>{dl.item}</p>
                        <p className="text-[11px]" style={{ color: tMut }}>Due: {dl.dueDate}</p>
                      </div>
                      {dl.status === 'received' ? <span className="text-[11px] text-green-400">✓ Received</span> :
                       dl.status === 'overdue' ? <span className="text-[11px] text-red-400">⚠ Overdue — Project paused</span> :
                       <span className="text-[11px]" style={{ color: tMut }}>Waiting</span>}
                    </div>
                  ))}
                  <p className="text-[10px] mt-2" style={{ color: tMut }}>⚠ Late submissions may pause your project. Payment schedule remains unchanged.</p>
                </div>
              )}

              {selOrder.notes && <div className="p-4 rounded-xl border" style={{ background: bgEl, borderColor: bdL }}><p className="text-xs uppercase mb-1" style={{ color: tMut }}>Your Notes</p><p className="text-[14px]" style={{ color: tSec }}>{selOrder.notes}</p></div>}
            </div>
          </div>
          {/* Updates */}
          <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: bdL }}><h4 className="font-semibold text-white">Updates & Messages</h4></div>
            <div className="p-5 space-y-3 max-h-64 overflow-y-auto">
              {selOrder.updates.length === 0 && <p className="text-center text-[13px] py-4" style={{ color: tMut }}>No updates yet</p>}
              {selOrder.updates.map(u => (
                <div key={u.id} className={`p-3 rounded-xl border ${u.by === 'system' ? 'mx-4' : u.by === 'admin' ? 'ml-0 mr-8' : 'ml-8 mr-0'}`}
                  style={{
                    background: u.by === 'system' ? 'rgba(251,191,36,0.05)' : u.by === 'admin' ? bgEl : 'rgba(0,229,255,0.05)',
                    borderColor: u.by === 'system' ? 'rgba(251,191,36,0.15)' : u.by === 'admin' ? bdL : 'rgba(0,229,255,0.15)'
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium" style={{ color: u.by === 'system' ? '#fbbf24' : u.by === 'admin' ? tSec : '#67f0ff' }}>
                      {u.by === 'system' ? '🔔 System' : u.by === 'admin' ? '🛡 SpotAware Team' : '👤 You'}
                    </span>
                    <span className="text-[10px]" style={{ color: tMut }}>{fmt(u.timestamp)}</span>
                  </div>
                  <p className="text-[13px]" style={{ color: u.by === 'system' ? '#fbbf24' : tSec }}>{u.message}</p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex gap-2" style={{ borderColor: bdL }}>
              <input value={updateMsg} onChange={e => setUpdateMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendUpdate()} placeholder="Send a message..." className="flex-1 px-4 py-2.5 rounded-xl text-[13px] text-white focus:outline-none placeholder:text-[#4a4f6a]" style={{ background: bgIn, border: `1px solid ${bd}` }} />
              <button onClick={handleSendUpdate} disabled={!updateMsg.trim()} className="px-4 py-2.5 rounded-xl text-xs font-medium bg-cyan-glow text-midnight disabled:opacity-40">Send</button>
            </div>
          </div>
        </div>

        {/* Notes section (appended below in same view) */}
        {notes.length >= 0 && (
          <div className="max-w-2xl mt-6">
            <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }}>
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: bdL }}>
                <span className="text-xs font-semibold text-white">📌 Project Notes</span>
              </div>
              <div className="p-4 space-y-2">
                {notes.filter(n => n.pinned).map(n => (
                  <div key={n.id} className="p-3 rounded-lg border-l-2 border-amber-400" style={{ background: bgEl }}>
                    <p className="text-[12px] text-white">{n.content}</p>
                    <p className="text-[10px] mt-1" style={{ color: tMut }}>📌 {n.by === 'client' ? 'You' : 'Team'} • {fmt(n.timestamp)}</p>
                  </div>
                ))}
                {notes.filter(n => !n.pinned).map(n => (
                  <div key={n.id} className="p-3 rounded-lg border" style={{ borderColor: bdL, background: bgEl }}>
                    <p className="text-[12px]" style={{ color: tSec }}>{n.content}</p>
                    <p className="text-[10px] mt-1" style={{ color: tMut }}>{n.by === 'client' ? 'You' : 'Team'} • {fmt(n.timestamp)}</p>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 px-3 py-2 rounded-lg text-[12px] text-white focus:outline-none placeholder:text-[#4a4f6a]" style={{ background: bgIn, border: `1px solid ${bdL}` }} />
                  <button onClick={() => { if (!newNote.trim() || !selOrder) return; addOrderNote(selOrder.id, newNote, 'client'); setNewNote(''); setNotes(getOrderNotes(selOrder.id)); }} className="px-3 py-2 rounded-lg text-xs font-medium bg-cyan-glow text-midnight">Add</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
