import { motion } from 'framer-motion';

export default function FinalCTA() {
  return (
    <section className="py-20 md:py-32 px-5" id="contact">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-surface-card via-surface-card to-midnight-light" />
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(0,229,255,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(167,139,250,0.08) 0%, transparent 50%)` }} />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
          <div className="relative z-10 p-8 md:p-16 text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-soft/30 text-[10px] uppercase tracking-[0.15em] text-gray-medium font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow animate-pulse" />Ready when you are
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
              Let's build something<br /><span className="text-gradient">extraordinary.</span>
            </h2>
            <p className="text-gray-medium text-[15px] md:text-lg max-w-md mx-auto mb-8 leading-relaxed">
              Every great product starts with a conversation. Tell us your vision — we'll show you the path.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="group w-full sm:w-auto px-8 py-4 rounded-2xl bg-cyan-glow text-midnight font-display font-semibold text-sm hover:bg-cyan-soft transition-all">
                <span className="flex items-center justify-center gap-2">Start Your Project <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>→</motion.span></span>
              </button>
              <button className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-gray-soft/40 text-gray-medium font-display font-medium text-sm hover:border-gray-soft hover:text-white transition-all">
                hello@spotaware.dev
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
