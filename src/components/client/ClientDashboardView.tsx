import { type Order, type Invoice } from '../../utils/storage';
import { type View, bgCard, bdL, bd, tSec, tMut } from './types';

interface Props {
  session: { id: string; name: string; email: string } | null;
  orders: Order[];
  invoices: Invoice[];
  setView: (v: View) => void;
  setSelOrder: (o: Order | null) => void;
}

export default function ClientDashboardView({ session, orders, invoices, setView, setSelOrder }: Props) {
  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'completed');
  const holdOrders = orders.filter(o => o.onHold);
  const paidTotal = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.total, 0);
  const pendingInvs = invoices.filter(i => i.status !== 'paid');
  const nextPayment = orders.flatMap(o => (o.installments || []).filter(i => i.status === 'pending')).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  return (
    <div className="max-w-4xl space-y-5">
      {/* Welcome */}
      <div className="rounded-xl p-5 border" style={{ background: bgCard, borderColor: bd }}>
        <h2 className="font-display text-xl font-bold text-white">Welcome back, {session?.name?.split(' ')[0]} 👋</h2>
        <p className="text-[13px] mt-1" style={{ color: tSec }}>Here's your project overview</p>
      </div>

      {/* Alert banners */}
      {holdOrders.length > 0 && (
        <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/20">
          <p className="text-[13px] text-red-400 font-medium">⚠️ {holdOrders.length} project{holdOrders.length > 1 ? 's' : ''} on hold — <button onClick={() => { setSelOrder(holdOrders[0]); setView('order-detail'); }} className="underline">View details</button></p>
        </div>
      )}
      {nextPayment && (
        <div className="rounded-xl p-4 border" style={{ background: '#2a2d44', borderColor: '#f59e0b30' }}>
          <p className="text-[13px] text-amber-400 font-medium">💳 Next payment: <span className="text-white">${nextPayment.amount}</span> due <span className="text-white">{nextPayment.dueDate}</span> — {nextPayment.label}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Active Projects', v: activeOrders.length, icon: '📦', color: '#00e5ff', click: () => setView('orders') },
          { l: 'Completed', v: completedOrders.length, icon: '✅', color: '#34d399', click: () => setView('orders') },
          { l: 'Pending Invoices', v: pendingInvs.length, icon: '📄', color: '#f59e0b', click: () => setView('invoices') },
          { l: 'Total Invested', v: `$${paidTotal.toLocaleString()}`, icon: '💰', color: '#a78bfa', click: () => setView('invoices') },
        ].map(s => (
          <button key={s.l} onClick={s.click} className="rounded-xl p-4 border text-left hover:border-cyan-glow/20 transition-all" style={{ background: bgCard, borderColor: bd }}>
            <div className="flex items-center justify-between mb-2"><span className="text-lg">{s.icon}</span><span className="w-2 h-2 rounded-full" style={{ background: s.color, opacity: 0.6 }} /></div>
            <p className="font-display text-2xl font-bold text-white">{s.v}</p>
            <p className="text-[11px] mt-0.5" style={{ color: tMut }}>{s.l}</p>
          </button>
        ))}
      </div>

      {/* Active orders with progress */}
      {activeOrders.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: bdL }}>
            <span className="text-[13px] font-semibold text-white">🚀 Active Projects</span>
            <button onClick={() => setView('orders')} className="text-[11px] text-cyan-glow hover:underline">View all →</button>
          </div>
          {activeOrders.map(o => (
            <div key={o.id} className={`px-4 py-3 flex items-center justify-between border-b cursor-pointer hover:bg-white/[0.02] ${o.onHold ? 'bg-red-500/5' : ''}`} style={{ borderColor: bdL }} onClick={() => { setSelOrder(o); setView('order-detail'); }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-medium text-white truncate">{o.service}</p>
                  {o.onHold && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">HOLD</span>}
                </div>
                <p className="text-[11px]" style={{ color: tMut }}>${o.totalPaid || 0} / ${o.price} paid</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: bdL }}><div className="h-full rounded-full bg-cyan-glow transition-all" style={{ width: `${o.progress}%` }} /></div>
                <span className="text-[12px] font-semibold text-cyan-glow w-8 text-right">{o.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setView('services')} className="py-4 rounded-xl bg-cyan-glow/8 border border-cyan-glow/15 text-cyan-glow font-medium text-[14px] hover:bg-cyan-glow/12 transition-colors">🛒 Order New Service</button>
        <button onClick={() => setView('invoices')} className="py-4 rounded-xl border font-medium text-[14px] hover:bg-white/[0.02] transition-colors" style={{ borderColor: bd, color: tSec }}>📄 View Invoices</button>
      </div>
    </div>
  );
}
