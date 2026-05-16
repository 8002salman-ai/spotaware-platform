import { motion } from 'framer-motion';
import { useState } from 'react';

const testimonials = [
  { quote: "They didn't just build our product — they elevated it. The attention to detail is unmatched.", name: 'Sarah Chen', role: 'CEO, Nexus Finance', avatar: 'SC' },
  { quote: "Working with SpotAware felt like having a co-founder who actually cares about design.", name: 'Marcus Reid', role: 'Founder, Luminary AI', avatar: 'MR' },
  { quote: "Our conversion rate jumped 45% after launch. The ROI speaks for itself.", name: 'Priya Sharma', role: 'CTO, CartFlow', avatar: 'PS' },
  { quote: "Fast, clean, and premium. They shipped our MVP in 6 weeks and it felt production-ready.", name: 'James Walker', role: 'VP Product, HealthSync', avatar: 'JW' },
];

export default function Testimonials() {
  const [active, setActive] = useState(0);

  return (
    <section className="py-16 md:py-24 px-5">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-glow font-semibold">Client Words</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white mt-3 tracking-tight">Testimonials</h2>
        </motion.div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-2 md:overflow-visible md:pb-0" style={{ scrollbarWidth: 'none' }}>
          {testimonials.map((t, i) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
              onClick={() => setActive(i)}
              className={`flex-shrink-0 w-[85vw] md:w-auto snap-center rounded-2xl p-6 cursor-pointer transition-all duration-300 premium-shadow ${active === i ? 'bg-surface-card neon-border' : 'glass-panel'}`}>
              <div className="mb-5">
                <span className="text-cyan-glow text-2xl font-display leading-none">"</span>
                <p className="text-charcoal text-[15px] md:text-base leading-relaxed mt-1">{t.quote}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-glow/15 to-violet-accent/15 flex items-center justify-center border border-gray-soft/30">
                  <span className="text-xs font-semibold text-charcoal-light">{t.avatar}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-[11px] text-gray-medium">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center gap-2 mt-6 md:hidden">
          {testimonials.map((_, i) => (
            <button key={i} onClick={() => setActive(i)} className={`w-2 h-2 rounded-full transition-all duration-300 ${active === i ? 'bg-cyan-glow w-6' : 'bg-gray-soft'}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
