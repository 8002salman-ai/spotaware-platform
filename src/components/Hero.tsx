import { motion } from 'framer-motion';

interface HeroProps {
  onPortalOpen: () => void;
}

export default function Hero({ onPortalOpen }: HeroProps) {
  const scrollToWork = () => {
    document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[100dvh] flex flex-col items-center justify-center px-4 sm:px-5 pt-20 pb-24 sm:pb-28 overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-20 -right-20 w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.15) 0%, transparent 70%)' }}
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-20 w-[250px] h-[250px] md:w-[400px] md:h-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.2) 0%, transparent 70%)' }}
          animate={{ x: [0, -15, 0], y: [0, 20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,229,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.4) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-glow/20"
            style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{ y: [0, -30, 0], opacity: [0.1, 0.4, 0.1] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel neon-border mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-glow animate-pulse" />
          <span className="text-xs font-medium tracking-wider text-charcoal-light uppercase">
            Now accepting Q1 projects
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-[2.1rem] leading-[1.1] sm:text-[2.6rem] md:text-7xl md:leading-[1.05] font-bold tracking-tight mb-5"
          style={{ color: 'var(--t-primary, #eaecf4)' }}
        >
          We build digital
          <br />
          <span className="text-gradient">products that feel</span>
          <br />
          alive.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-gray-medium text-[1rem] sm:text-[1.08rem] md:text-xl max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Premium web experiences, mobile-first design, and intelligent interfaces — crafted for brands that demand more.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onPortalOpen}
            className="group relative w-full sm:w-auto px-8 py-4 rounded-2xl bg-cyan-glow font-display font-semibold text-sm tracking-wide overflow-hidden transition-all duration-300 hover:shadow-[0_0_35px_rgba(51,133,255,0.32)]"
            style={{ color: 'var(--t-bg)', boxShadow: `0 0 30px color-mix(in srgb, var(--ta) 20%, transparent)` }}
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              <span>Start a Project</span>
              <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>→</motion.span>
            </span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute inset-0 animate-[shimmer_2s_infinite]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
            </div>
          </button>

          <button
            onClick={scrollToWork}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl glass-panel neon-border font-display font-medium text-sm tracking-wide text-charcoal hover:bg-surface-card/60 hover:border-cyan-glow/30 transition-all duration-300"
          >
            View Our Work
          </button>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-medium font-medium">Explore</span>
          <div className="w-5 h-8 rounded-full border border-gray-soft flex items-start justify-center p-1">
            <motion.div
              className="w-1 h-2 rounded-full bg-cyan-glow/50"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
