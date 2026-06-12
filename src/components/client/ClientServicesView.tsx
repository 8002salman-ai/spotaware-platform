import { motion, AnimatePresence } from 'framer-motion';
import { bgCard, bgIn, bd, tSec, tMut, SERVICES } from './types';

interface Props {
  orderService: string;
  setOrderService: (v: string) => void;
  orderNotes: string;
  setOrderNotes: (v: string) => void;
  handlePlaceOrder: () => void;
}

export default function ClientServicesView({ orderService, setOrderService, orderNotes, setOrderNotes, handlePlaceOrder }: Props) {
  return (
    <div className="max-w-4xl space-y-8">
      <div className="text-center"><h2 className="font-display text-2xl font-bold text-white">Our Services</h2><p className="text-[15px] mt-2" style={{ color: tSec }}>Select a service to place an order</p></div>
      {SERVICES.map(cat => (
        <div key={cat.cat}>
          <h3 className="font-display font-semibold text-white text-lg mb-4">{cat.cat}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cat.items.map(svc => (
              <div key={svc.name} className={`rounded-xl p-5 border cursor-pointer transition-all ${orderService === svc.name ? 'border-cyan-glow/50 ring-1 ring-cyan-glow/20' : 'hover:border-cyan-glow/20'}`} style={{ background: bgCard, borderColor: orderService === svc.name ? undefined : bd }} onClick={() => setOrderService(svc.name)}>
                <div className="flex items-start justify-between"><div><p className="font-semibold text-white text-[15px]">{svc.name}</p><p className="text-[13px] mt-1" style={{ color: tSec }}>{svc.desc}</p></div>{orderService === svc.name && <span className="w-6 h-6 rounded-full bg-cyan-glow flex items-center justify-center text-midnight text-xs">✓</span>}</div>
                <div className="flex items-center gap-3 mt-3"><span className="text-cyan-glow font-bold text-lg">{svc.price > 0 ? `$${svc.price.toLocaleString()}` : 'Addon'}</span><span className="text-xs" style={{ color: tMut }}>⏱ {svc.time}</span></div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* Order form */}
      <AnimatePresence>
        {orderService && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border p-5 sticky bottom-4" style={{ background: bgCard, borderColor: bd }}>
            <h4 className="font-semibold text-white mb-3">Place Order: {orderService}</h4>
            <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Add project notes, requirements, references..." rows={3} className="w-full px-4 py-3 rounded-xl text-[13px] text-white focus:outline-none resize-none mb-3 placeholder:text-[#4a4f6a]" style={{ background: bgIn, border: `1px solid ${bd}` }} />
            <div className="flex gap-3">
              <button onClick={() => setOrderService('')} className="px-4 py-2.5 rounded-xl text-xs font-medium border transition-colors hover:text-white" style={{ borderColor: bd, color: tSec }}>Cancel</button>
              <button onClick={handlePlaceOrder} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-cyan-glow text-midnight hover:bg-cyan-soft transition-colors">Place Order →</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
