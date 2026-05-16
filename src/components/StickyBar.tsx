import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function StickyBar() {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    const h = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const scrollTo = (id: string) => { setActiveTab(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setTimeout(() => setActiveTab(null), 1000); };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="fixed bottom-0 left-0 right-0 z-40 md:hidden safe-bottom">
          <div className="mx-3 mb-3 rounded-2xl glass-strong premium-shadow-lg">
            <div className="flex items-center justify-around py-2.5 px-2">
              {[{ id: 'portfolio', label: 'Work', icon: '◆' }, { id: 'pricing', label: 'Pricing', icon: '$' }, { id: 'project-brief', label: 'Brief', icon: '✎' }].map((item) => (
                <button key={item.id} onClick={() => scrollTo(item.id)}
                  className={`flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-all duration-300 ${activeTab === item.id ? 'bg-cyan-glow text-midnight' : 'text-charcoal-light'}`}>
                  <span className="text-base">{item.icon}</span>
                  <span className="text-[10px] font-medium tracking-wider uppercase">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
