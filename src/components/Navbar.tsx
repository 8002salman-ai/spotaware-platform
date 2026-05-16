import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import Logo from './Logo';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const scrollTo = (id: string) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  const openClientPortal = () => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('open-client-portal')); };

  const navLinks = [
    { label: 'Services', id: 'services' },
    { label: 'Pricing', id: 'pricing' },
    { label: 'Work', id: 'portfolio' },
    { label: 'Process', id: 'process' },
  ];

  return (
    <>
      <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-2' : 'py-3'}`}>
        <div className={`mx-3 md:mx-auto md:max-w-6xl rounded-2xl px-4 md:px-5 py-3 transition-all duration-500 ${scrolled ? 'glass-strong premium-shadow' : ''}`}>
          <div className="flex items-center justify-between">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <Logo size="sm" animate />
            </button>

            {/* Desktop */}
            <div className="hidden md:flex items-center gap-7">
              {navLinks.map(l => (
                <button key={l.id} onClick={() => scrollTo(l.id)} className="text-[14px] text-gray-medium hover:text-white transition-all hover:-translate-y-0.5 font-medium">{l.label}</button>
              ))}
              <button onClick={openClientPortal} className="group flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-glow/20 hover:border-cyan-glow/40 transition-all">
                <svg className="w-4 h-4 text-cyan-glow/60 group-hover:text-cyan-glow transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                <span className="text-[13px] font-medium text-cyan-glow/60 group-hover:text-cyan-glow transition-colors">Portal</span>
              </button>
              <button onClick={() => scrollTo('contact')} className="px-5 py-2.5 rounded-xl bg-cyan-glow text-midnight text-[14px] font-semibold hover:bg-cyan-soft hover:shadow-[0_0_24px_rgba(51,133,255,0.28)] transition-all">
                Start Project
              </button>
            </div>

            {/* Mobile right side */}
            <div className="md:hidden flex items-center gap-2.5">
              <motion.button onClick={openClientPortal} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cyan-glow/25 bg-cyan-glow/5">
                <svg className="w-4 h-4 text-cyan-glow/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                <span className="text-[12px] font-semibold text-cyan-glow/70">Portal</span>
              </motion.button>

              {/* Hamburger — bigger */}
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-11 h-11 rounded-xl glass-panel flex items-center justify-center">
                <div className="flex flex-col gap-[6px]">
                  <motion.div animate={menuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }} transition={{ duration: 0.25 }} className="w-5 h-[2px] bg-white rounded-full origin-center" />
                  <motion.div animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }} transition={{ duration: 0.2 }} className="w-5 h-[2px] bg-white rounded-full" />
                  <motion.div animate={menuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }} transition={{ duration: 0.25 }} className="w-5 h-[2px] bg-white rounded-full origin-center" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu — slide from top like SpotBot */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 md:hidden">
            <motion.div className="absolute inset-0 bg-midnight/70 backdrop-blur-md" onClick={() => setMenuOpen(false)} 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              initial={{ opacity: 0, y: -30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-20 left-3 right-3 rounded-2xl premium-shadow-lg overflow-hidden border border-gray-soft/40"
              style={{ background: '#222438' }}
            >
              {/* Menu header */}
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#353850', background: '#282b42' }}>
                <span className="text-[13px] font-semibold text-white">Menu</span>
                <button onClick={() => setMenuOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5">
                  <span className="text-[#6b7094] text-sm">✕</span>
                </button>
              </div>

              <div className="p-4 space-y-1">
                {navLinks.map((link, i) => (
                  <motion.button key={link.id}
                    initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.05 }}
                    onClick={() => scrollTo(link.id)}
                    className="flex items-center justify-between w-full py-3.5 px-4 rounded-xl text-left text-white font-display font-medium text-[15px] hover:bg-white/5 transition-colors">
                    {link.label}
                    <span className="text-[#6b7094] text-[13px]">→</span>
                  </motion.button>
                ))}

                <motion.button initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                  onClick={openClientPortal}
                  className="flex items-center gap-3 w-full py-3.5 px-4 rounded-xl hover:bg-cyan-glow/5 transition-colors mt-1">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-cyan-glow/25 bg-cyan-glow/5">
                    <svg className="w-4.5 h-4.5 text-cyan-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-cyan-glow font-display font-medium text-[15px] block">Client Portal</span>
                    <span className="text-[11px]" style={{ color: '#6b7094' }}>Login or Sign up</span>
                  </div>
                </motion.button>
              </div>

              <div className="p-4 pt-2 border-t" style={{ borderColor: '#353850' }}>
                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  onClick={() => scrollTo('contact')}
                  className="w-full py-3.5 rounded-xl bg-cyan-glow text-midnight font-display font-bold text-[15px]">
                  Start a Project →
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
