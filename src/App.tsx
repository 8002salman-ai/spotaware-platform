import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustStrip from './components/TrustStrip';
import Services from './components/Services';
import Portfolio from './components/Portfolio';
import Process from './components/Process';
import Testimonials from './components/Testimonials';
import Pricing from './components/Pricing';
import ProjectBrief from './components/ProjectBrief';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';
import StickyBar from './components/StickyBar';
import PortalReveal from './components/PortalReveal';
import ChatAgent from './components/ChatAgent';
import ThemeSwitcher from './components/ThemeSwitcher';

export default function App() {
  const [portalOpen, setPortalOpen] = useState(false);

  const handlePortalOpen = useCallback(() => setPortalOpen(true), []);
  const handlePortalComplete = useCallback(() => {
    setPortalOpen(false);
    setTimeout(() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  return (
    <div className="relative min-h-screen bg-surface overflow-x-hidden">
      <PortalReveal isOpen={portalOpen} onComplete={handlePortalComplete} />
      <ThemeSwitcher />
      <Navbar />
      <main>
        <Hero onPortalOpen={handlePortalOpen} />
        <TrustStrip />
        <div className="max-w-6xl mx-auto px-4 sm:px-5"><div className="h-[1px] bg-gradient-to-r from-transparent via-gray-soft/50 to-transparent" /></div>
        <Services />
        <Pricing />
        <div className="max-w-6xl mx-auto px-4 sm:px-5"><div className="h-[1px] bg-gradient-to-r from-transparent via-gray-soft/50 to-transparent" /></div>
        <Process />
        <ProjectBrief />
        <div className="max-w-6xl mx-auto px-4 sm:px-5"><div className="h-[1px] bg-gradient-to-r from-transparent via-gray-soft/50 to-transparent" /></div>
        <Testimonials />
        <Portfolio />
        <FinalCTA />
      </main>
      <Footer />
      <StickyBar />
      <ChatAgent />
      {/* Ambient gradient orbs — Skywork-style colored glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top-left blue glow */}
        <motion.div className="absolute -top-40 -left-24 w-[500px] h-[300px] rounded-full opacity-[0.08]"
          style={{ background: `radial-gradient(ellipse, color-mix(in srgb, var(--ta, #3385ff) 40%, transparent) 0%, transparent 70%)`, filter: 'blur(80px)' }}
          animate={{ y: [0, 30, 0], x: [0, 20, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
        {/* Bottom-left amber glow */}
        <motion.div className="absolute -bottom-20 -left-16 w-[400px] h-[250px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(ellipse, rgba(255,172,75,0.35) 0%, transparent 70%)', filter: 'blur(80px)' }}
          animate={{ y: [0, -25, 0], x: [0, 15, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
        {/* Top-right violet glow */}
        <motion.div className="absolute -top-24 -right-10 w-[450px] h-[280px] rounded-full opacity-[0.05]"
          style={{ background: `radial-gradient(ellipse, color-mix(in srgb, var(--tv, #7357ff) 30%, transparent) 0%, transparent 70%)`, filter: 'blur(80px)' }}
          animate={{ y: [0, 40, 0], x: [0, -20, 0] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
    </div>
  );
}
