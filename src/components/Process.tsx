import { motion } from 'framer-motion';

const steps = [
  { n: '01', title: 'Discovery', desc: 'We listen & understand your vision', icon: '🔍', color: '#00e5ff' },
  { n: '02', title: 'Design', desc: 'Premium UI/UX crafted for you', icon: '✨', color: '#a78bfa' },
  { n: '03', title: 'Develop', desc: 'Clean code, pixel-perfect build', icon: '⚡', color: '#34d399' },
  { n: '04', title: 'Deliver', desc: 'Launch, optimize & support', icon: '🚀', color: '#f59e0b' },
];

export default function Process() {
  return (
    <section className="py-14 md:py-20 px-4" id="process">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8 md:mb-10">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-glow font-semibold">How We Work</span>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white mt-2 tracking-tight">Simple. Clear. <span className="text-gradient">Effective.</span></h2>
        </motion.div>

        {/* Desktop: Horizontal timeline */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-[38px] left-[10%] right-[10%] h-[2px]" style={{ background: 'linear-gradient(90deg, #00e5ff20, #a78bfa30, #34d39930, #f59e0b20)' }} />
            
            <div className="grid grid-cols-4 gap-6">
              {steps.map((s, i) => (
                <motion.div key={s.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                  className="text-center relative">
                  {/* Circle node */}
                  <motion.div 
                    className="w-[76px] h-[76px] rounded-full mx-auto mb-5 flex items-center justify-center relative"
                    style={{ background: `${s.color}10`, border: `2px solid ${s.color}30` }}
                    whileHover={{ scale: 1.08 }}
                  >
                    <span className="text-3xl">{s.icon}</span>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-midnight" style={{ background: s.color }}>{s.n}</div>
                  </motion.div>
                  <h3 className="font-display font-bold text-white text-[17px] mb-1">{s.title}</h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: '#9da2be' }}>{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: Compact vertical */}
        <div className="md:hidden space-y-2">
          {steps.map((s, i) => (
            <motion.div key={s.n} initial={{ opacity: 0, x: -15 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="flex items-center gap-4 p-4 rounded-xl border transition-all" style={{ borderColor: 'var(--t-bdl)', background: 'var(--t-card)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative" style={{ background: `${s.color}12`, border: `1.5px solid ${s.color}25` }}>
                <span className="text-xl">{s.icon}</span>
                <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-midnight" style={{ background: s.color }}>{s.n}</span>
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-[15px]">{s.title}</h3>
                <p className="text-[13px]" style={{ color: '#9da2be' }}>{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
