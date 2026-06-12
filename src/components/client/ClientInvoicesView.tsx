import { type Invoice } from '../../utils/storage';
import { downloadInvoice } from '../../utils/invoice';
import { type View, bgCard, bgEl, bdL, bd, tSec, tMut, statusMap, fmt } from './types';

interface Props {
  view: View;
  invoices: Invoice[];
  selInvoice: Invoice | null;
  setSelInvoice: (inv: Invoice | null) => void;
  setView: (v: View) => void;
}

export default function ClientInvoicesView({ view, invoices, selInvoice, setSelInvoice, setView }: Props) {
  if (view === 'invoices') {
    return (
      <div className="max-w-4xl space-y-4">
        {invoices.map(inv => (
          <div key={inv.id} className="rounded-xl p-5 border cursor-pointer hover:border-cyan-glow/30 transition-colors" style={{ background: bgCard, borderColor: bd }} onClick={() => { setSelInvoice(inv); setView('invoice-detail'); }}>
            <div className="flex items-center justify-between mb-2">
              <div><p className="font-semibold text-white">{inv.invoiceNumber}</p><p className="text-xs" style={{ color: tMut }}>{fmt(inv.createdAt)} • Due: {inv.dueDate}</p></div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${statusMap[inv.status]?.color}`}>{statusMap[inv.status]?.label}</span>
            </div>
            <p className="text-cyan-glow font-bold text-lg">${inv.total.toLocaleString()}</p>
          </div>
        ))}
        {invoices.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: bd, color: tMut }}>No invoices yet</div>}
      </div>
    );
  }

  if (view === 'invoice-detail' && selInvoice) {
    return (
      <div className="max-w-2xl space-y-6">
        <button onClick={() => setView('invoices')} className="text-xs hover:text-white transition-colors" style={{ color: tSec }}>← Back to invoices</button>
        <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }} id="invoice-print">
          <div className="p-6 border-b" style={{ borderColor: bdL }}>
            <div className="flex items-center justify-between mb-6">
              <div><p className="font-display font-bold text-white text-xl">SpotAware.dev</p><p className="text-xs" style={{ color: tMut }}>Premium Digital Studio</p></div>
              <div className="text-right"><p className="font-display font-bold text-white text-lg">{selInvoice.invoiceNumber}</p><span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${statusMap[selInvoice.status]?.color}`}>{statusMap[selInvoice.status]?.label}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div><p className="text-xs uppercase" style={{ color: tMut }}>Date</p><p className="text-white">{fmt(selInvoice.createdAt)}</p></div>
              <div><p className="text-xs uppercase" style={{ color: tMut }}>Due Date</p><p className="text-white">{selInvoice.dueDate}</p></div>
            </div>
          </div>
          <div className="p-6">
            <table className="w-full mb-6">
              <thead><tr className="border-b" style={{ borderColor: bdL }}>
                {['Item', 'Qty', 'Rate', 'Amount'].map(h => <th key={h} className="py-2 text-left text-xs uppercase" style={{ color: tMut }}>{h}</th>)}
              </tr></thead>
              <tbody>{selInvoice.items.map((it, i) => (
                <tr key={i} className="border-b" style={{ borderColor: bdL }}>
                  <td className="py-3 text-[14px] text-white">{it.description}</td>
                  <td className="py-3 text-[14px]" style={{ color: tSec }}>{it.quantity}</td>
                  <td className="py-3 text-[14px]" style={{ color: tSec }}>${it.rate.toLocaleString()}</td>
                  <td className="py-3 text-[14px] text-white font-medium">${it.amount.toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="flex justify-end">
              <div className="w-48 space-y-2">
                <div className="flex justify-between text-[13px]"><span style={{ color: tSec }}>Subtotal</span><span className="text-white">${selInvoice.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-[13px]"><span style={{ color: tSec }}>Tax ({selInvoice.taxRate || 0}% TX)</span><span className="text-white">${selInvoice.taxAmount?.toFixed(2) || '0.00'}</span></div>
                <div className="flex justify-between text-[15px] font-bold pt-2 border-t" style={{ borderColor: bdL }}><span className="text-white">Total</span><span className="text-cyan-glow">${selInvoice.total.toLocaleString()}</span></div>
              </div>
            </div>
            {selInvoice.note && <div className="mt-6 p-4 rounded-xl border" style={{ background: bgEl, borderColor: bdL }}><p className="text-xs uppercase mb-1" style={{ color: tMut }}>Note</p><p className="text-[14px]" style={{ color: tSec }}>{selInvoice.note}</p></div>}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => downloadInvoice(selInvoice)} className="flex-1 py-3 rounded-xl bg-cyan-glow/10 border border-cyan-glow/20 text-cyan-glow font-medium text-[14px] hover:bg-cyan-glow/15 transition-colors">📥 Download PDF</button>
          <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl border font-medium text-[14px] hover:bg-white/[0.02] transition-colors" style={{ borderColor: bd, color: tSec }}>🖨 Print</button>
        </div>
      </div>
    );
  }

  return null;
}
