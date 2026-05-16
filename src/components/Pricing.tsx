import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const bgEl = 'var(--t-el,#1a2d3d)'; const bgIn = 'var(--t-in,#1f3344)'; const bd = 'var(--t-bd,#264055)'; const bdL = 'var(--t-bdl,#1e3548)'; const tSec = 'var(--t-sec,#8ab4d0)'; const tMut = 'var(--t-mut,#4d7a96)';

interface Plan { name: string; tag: string; price: number; oldPrice: number; delivery: string; features: string[]; popular?: boolean; }
interface Addon { name: string; price: number; type: 'fixed' | 'percent' | 'monthly'; }

const plans: Plan[] = [
  { name: 'Starter', tag: 'Landing pages & MVPs', price: 497, oldPrice: 799, delivery: '5-7 days',
    features: ['Single page website', 'Mobile responsive', 'Animations & CTA', 'Contact form + SEO', '2 revisions • 30-day support'] },
  { name: 'Professional', tag: 'Full websites', price: 1497, oldPrice: 2499, delivery: '10-14 days', popular: true,
    features: ['Up to 5 pages', 'Custom UI/UX design', 'CMS + Blog', 'Analytics + Speed opt.', '5 revisions • 60-day support'] },
  { name: 'Enterprise', tag: 'Web applications', price: 3997, oldPrice: 5999, delivery: '3-6 weeks',
    features: ['Full-stack app', 'Auth + Database + API', 'Admin dashboard', 'Real-time features', 'Unlimited revisions • 90-day'] },
];

const addons: Addon[] = [
  { name: 'Logo & Brand Kit', price: 297, type: 'fixed' },
  { name: 'E-commerce', price: 697, type: 'fixed' },
  { name: 'Illustrations', price: 397, type: 'fixed' },
  { name: 'SEO Package', price: 497, type: 'fixed' },
  { name: 'Analytics Setup', price: 197, type: 'fixed' },
  { name: 'Rush Delivery', price: 30, type: 'percent' },
  { name: 'Maintenance', price: 197, type: 'monthly' },
];

const INST = [
  { n: 1, label: 'Full', fee: 0 }, { n: 2, label: '2×', fee: 0 }, { n: 3, label: '3×', fee: 0 },
  { n: 4, label: '4×', fee: 20 }, { n: 5, label: '5×', fee: 20 }, { n: 6, label: '6×', fee: 20 },
];

export default function Pricing() {
  const [sel, setSel] = useState<number | null>(null);
  const [selAddons, setSelAddons] = useState<string[]>([]);
  const [inst, setInst] = useState(1);

  const plan = sel !== null ? plans[sel] : null;
  const toggle = (n: string) => setSelAddons(p => p.includes(n) ? p.filter(a => a !== n) : [...p, n]);

  const base = plan?.price || 0;
  const rush = selAddons.includes('Rush Delivery') ? Math.round(base * 0.3) : 0;
  const fixedTotal = addons.filter(a => selAddons.includes(a.name) && a.type === 'fixed').reduce((s, a) => s + a.price, 0);
  const monthly = addons.filter(a => selAddons.includes(a.name) && a.type === 'monthly').reduce((s, a) => s + a.price, 0);
  const subtotal = base + rush + fixedTotal;
  const io = INST.find(o => o.n === inst)!;
  const fee = io.fee > 0 ? Math.round(subtotal * io.fee / 100) : 0;
  const total = subtotal + fee;
  const perInst = inst > 1 ? Math.round(total / inst * 100) / 100 : total;

  return (
    <section className="py-14 md:py-24 px-4" id="pricing">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8 md:mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-400/10 border border-green-400/20 mb-3">
            <span className="text-[10px] uppercase tracking-wider text-green-400 font-semibold">💰 Flexible Payments Available</span>
          </span>
          <h2 className="font-display text-2xl md:text-5xl font-bold text-white tracking-tight">Choose Your <span className="text-gradient">Plan</span></h2>
        </motion.div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5 mb-6">
          {plans.map((p, i) => {
            const active = sel === i;
            return (
              <motion.div key={p.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                onClick={() => { setSel(active ? null : i); setSelAddons([]); setInst(1); }}
                className={`relative rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden ${
                  active ? 'ring-2 ring-cyan-glow/60 shadow-[0_0_30px_rgba(0,229,255,0.1)]' :
                  p.popular ? 'ring-1 ring-cyan-glow/20' : 'border border-gray-soft/30'}`}
              >
                {p.popular && <div className="bg-gradient-to-r from-cyan-glow to-violet-accent py-1 text-center"><span className="text-[9px] uppercase tracking-wider font-bold text-midnight">Most Popular</span></div>}
                {active && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-glow flex items-center justify-center z-10"><span className="text-midnight text-[10px] font-bold">✓</span></div>}

                <div className="p-4 md:p-5 bg-surface-card">
                  {/* Name + Price row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display text-lg font-bold text-white">{p.name}</h3>
                      <p className="text-[11px]" style={{ color: tMut }}>{p.tag}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-display text-2xl md:text-3xl font-bold text-white">${p.price.toLocaleString()}</span>
                      <span className="text-xs line-through ml-1.5" style={{ color: tMut }}>${p.oldPrice.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Delivery + Installment badge */}
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: bdL }}>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/15">⚡ {p.delivery}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-400/10 text-green-400 border border-green-400/15">💳 3× ${Math.round(p.price / 3)}/mo free</span>
                  </div>

                  {/* Features — compact */}
                  <ul className="space-y-1.5">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-[12px] md:text-[13px]" style={{ color: tSec }}>
                        <span className="text-cyan-glow text-[8px]">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Configurator */}
        <AnimatePresence>
          {sel !== null && plan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: bd, background: '#222438' }}>
                {/* Config Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: bdL, background: bgEl }}>
                  <span className="font-display font-bold text-white text-[15px]">📦 {plan.name} — ${plan.price.toLocaleString()}</span>
                  <button onClick={() => setSel(null)} className="text-xs hover:text-white transition-colors" style={{ color: tMut }}>✕ Close</button>
                </div>

                <div className="p-4 md:p-5">
                  {/* Row 1: Addons (horizontal scroll on mobile) */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-white mb-2">Add-ons</p>
                    <div className="flex flex-wrap gap-1.5">
                      {addons.map(a => {
                        const on = selAddons.includes(a.name);
                        const priceLabel = a.type === 'percent' ? `+30%` : a.type === 'monthly' ? `$${a.price}/mo` : `$${a.price}`;
                        return (
                          <button key={a.name} onClick={() => toggle(a.name)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${on ? 'border-cyan-glow/40 bg-cyan-glow/10 text-cyan-glow' : 'hover:border-gray-soft/60'}`}
                            style={!on ? { borderColor: bdL, color: tSec } : undefined}>
                            {on ? '✓ ' : ''}{a.name} <span className={on ? 'text-cyan-glow/70' : ''} style={!on ? { color: tMut } : undefined}>{priceLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 2: Payment + Summary side by side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Payment Plan */}
                    <div>
                      <p className="text-xs font-semibold text-white mb-2">Payment Plan</p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {INST.map(o => (
                          <button key={o.n} onClick={() => setInst(o.n)}
                            className={`py-2 rounded-lg text-center border transition-all ${inst === o.n ? 'border-cyan-glow/40 bg-cyan-glow/8' : ''}`}
                            style={inst !== o.n ? { borderColor: bdL, background: bgIn } : undefined}>
                            <span className="text-[12px] font-semibold text-white block">{o.label}</span>
                            <span className={`text-[9px] ${o.fee > 0 ? 'text-amber-400' : 'text-green-400'}`}>{o.fee > 0 ? `+${o.fee}%` : 'Free'}</span>
                          </button>
                        ))}
                      </div>
                      {fee > 0 && <p className="text-[10px] text-amber-400/70 mt-1.5">⚠ +${fee} fee on 4+ installments</p>}
                    </div>

                    {/* Live Summary */}
                    <div className="rounded-xl p-4 border" style={{ background: bgEl, borderColor: bdL }}>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[12px]"><span style={{ color: tSec }}>📦 {plan.name}</span><span className="text-white">${base.toLocaleString()}</span></div>
                        {addons.filter(a => selAddons.includes(a.name)).map(a => (
                          <div key={a.name} className="flex justify-between text-[12px]">
                            <span style={{ color: tSec }}>{a.type === 'monthly' ? '🔄' : '➕'} {a.name}</span>
                            <span className="text-white">{a.type === 'percent' ? `$${rush}` : a.type === 'monthly' ? `$${a.price}/mo` : `$${a.price}`}</span>
                          </div>
                        ))}
                        {fee > 0 && <div className="flex justify-between text-[12px]"><span className="text-amber-400">Installment fee</span><span className="text-amber-400">+${fee}</span></div>}
                        <div className="flex justify-between pt-2 mt-1 border-t" style={{ borderColor: bdL }}>
                          <span className="text-white font-bold text-[14px]">Total</span>
                          <div className="text-right">
                            <span className="text-cyan-glow font-bold text-lg">${total.toLocaleString()}</span>
                            {inst > 1 && <span className="block text-[11px] text-cyan-glow/70">{inst}× ${perInst.toLocaleString()}</span>}
                            {monthly > 0 && <span className="block text-[11px] text-violet-400">+ ${monthly}/mo</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <button onClick={() => {
                    const detail = {
                      plan: plan.name, price: plan.price, delivery: plan.delivery,
                      addons: addons.filter(a => selAddons.includes(a.name)).map(a => ({
                        name: a.name, price: a.type === 'percent' ? rush : a.price, type: a.type
                      })),
                      installments: inst, installmentFee: fee, total, perInstallment: perInst, monthly,
                    };
                    window.dispatchEvent(new CustomEvent('pricing-selected', { detail }));
                    document.getElementById('project-brief')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                    className="w-full mt-4 py-3.5 rounded-xl bg-cyan-glow text-midnight font-display font-bold text-[14px] hover:bg-cyan-soft transition-colors shadow-[0_0_25px_rgba(0,229,255,0.12)]">
                    Get Started with {plan.name} →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom note */}
        <p className="text-center text-[11px]" style={{ color: tMut }}>
          💳 Up to 3 installments free • 4+ installments 20% fee • 🔒 100% satisfaction guarantee • 📞 Free consultation
        </p>
      </div>
    </section>
  );
}
