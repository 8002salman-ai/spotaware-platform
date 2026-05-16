import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

export default function PortalReveal({ isOpen, onComplete }: { isOpen: boolean; onComplete: () => void }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => { document.body.style.overflow = ''; onComplete(); }, 1800);
      return () => { clearTimeout(timer); document.body.style.overflow = ''; };
    }
  }, [isOpen, onComplete]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[100] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <motion.div className="absolute inset-0 bg-midnight" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          {[0, 1, 2, 3].map((i) => (
            <motion.div key={i} className="absolute rounded-full border border-cyan-glow/30" style={{ width: `${120 + i * 80}px`, height: `${120 + i * 80}px` }}
              initial={{ scale: 0, rotate: 0, opacity: 0 }} animate={{ scale: [0, 1.2, 1], rotate: [0, 180 + i * 45], opacity: [0, 0.8, 0.3] }} exit={{ scale: 3, opacity: 0 }}
              transition={{ duration: 1.2, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }} />
          ))}
          <motion.div className="absolute w-20 h-20 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.5) 0%, rgba(167,139,250,0.2) 50%, transparent 70%)' }}
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 2, 15], opacity: [0, 1, 0] }} transition={{ duration: 1.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }} />
          <motion.div className="absolute z-10 text-center" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.95] }} transition={{ duration: 1.8, times: [0, 0.3, 0.7, 1] }}>
            <div className="flex items-baseline justify-center gap-0">
              <span className="font-display text-3xl font-extrabold text-white tracking-wider">SPOT</span>
              <span className="font-display text-3xl font-extrabold tracking-wider" style={{ background: 'linear-gradient(135deg, #00e5ff, #67f0ff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AWARE</span>
              <span className="font-display text-3xl tracking-wider" style={{ color: 'rgba(0,229,255,0.3)', fontWeight: 300 }}>.</span>
              <span className="font-display text-3xl tracking-wider" style={{ color: 'rgba(0,229,255,0.4)', fontWeight: 400 }}>dev</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
