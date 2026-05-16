import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface Project { title: string; category: string; description: string; tech: string[]; metrics: string; gradient: string; accentColor: string; pattern: 'grid' | 'dots' | 'lines' | 'circles'; }

const projects: Project[] = [
  { title: 'Nexus Finance', category: 'FinTech Platform', description: 'A next-generation banking dashboard with real-time portfolio tracking and AI-powered insights.', tech: ['Next.js', 'TypeScript', 'WebSocket', 'D3.js'], metrics: '3x faster load · 40% more engagement', gradient: 'from-cyan-400/15 via-blue-500/10 to-transparent', accentColor: 'rgb(0, 229, 255)', pattern: 'grid' },
  { title: 'HealthSync Pro', category: 'HealthTech App', description: 'Patient management with telemedicine, scheduling, and health record visualization.', tech: ['React', 'Node.js', 'PostgreSQL', 'WebRTC'], metrics: '99.9% uptime · 60k+ active users', gradient: 'from-emerald-400/10 via-teal-400/8 to-transparent', accentColor: 'rgb(52, 211, 153)', pattern: 'dots' },
  { title: 'Luminary AI', category: 'AI Platform', description: 'Enterprise AI content platform with NLP, automated workflows, and team collaboration.', tech: ['Next.js', 'Python', 'OpenAI', 'Redis'], metrics: 'Series A funded · 200% MoM growth', gradient: 'from-violet-400/15 via-purple-400/8 to-transparent', accentColor: 'rgb(167, 139, 250)', pattern: 'lines' },
  { title: 'CartFlow', category: 'E-Commerce Platform', description: 'Premium headless commerce with 3D product views and instant checkout.', tech: ['React', 'Shopify API', 'Three.js', 'Stripe'], metrics: '45% conversion lift · 2s load time', gradient: 'from-amber-400/10 via-orange-400/8 to-transparent', accentColor: 'rgb(251, 191, 36)', pattern: 'circles' },
];

function PatternSVG({ pattern, color }: { pattern: string; color: string }) {
  const patterns: Record<string, React.ReactNode> = {
    grid: <><defs><pattern id="gp" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke={color} strokeWidth="0.5" /></pattern></defs><rect width="100%" height="100%" fill="url(#gp)" /></>,
    dots: <><defs><pattern id="dp" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1.5" fill={color} /></pattern></defs><rect width="100%" height="100%" fill="url(#dp)" /></>,
    lines: <><defs><pattern id="lp" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="20" stroke={color} strokeWidth="0.5" /></pattern></defs><rect width="100%" height="100%" fill="url(#lp)" /></>,
    circles: <><defs><pattern id="cp" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="12" fill="none" stroke={color} strokeWidth="0.5" /></pattern></defs><rect width="100%" height="100%" fill="url(#cp)" /></>,
  };
  return <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">{patterns[pattern]}</svg>;
}

export default function Portfolio() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section className="py-16 md:py-24 px-5" id="portfolio">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-glow font-semibold">Selected Work</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white mt-3 tracking-tight">Portfolio</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p, i) => (
            <motion.button key={p.title} initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
              onClick={() => setSelected(i)} className="group text-left rounded-2xl overflow-hidden premium-shadow bg-surface-card border border-gray-soft/30 hover:border-cyan-glow/20 transition-all">
              <div className={`relative h-40 md:h-48 bg-gradient-to-br ${p.gradient} overflow-hidden`}>
                <PatternSVG pattern={p.pattern} color={p.accentColor} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-110" style={{ borderColor: `${p.accentColor}50`, background: `${p.accentColor}10` }}>
                    <span className="font-display text-lg font-bold" style={{ color: p.accentColor }}>{p.title[0]}</span>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <span className="text-[10px] uppercase tracking-[0.15em] text-gray-medium">{p.category}</span>
                <h3 className="font-display text-lg font-semibold text-white mt-1">{p.title}</h3>
                <p className="text-gray-medium text-sm mt-1">{p.metrics}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected !== null && (
          <motion.div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="absolute inset-0 bg-midnight/80 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <motion.div className="relative z-10 w-full max-w-lg bg-surface-card rounded-t-3xl md:rounded-3xl overflow-hidden premium-shadow-lg max-h-[90dvh] overflow-y-auto border border-gray-soft/30"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
              <div className="flex justify-center pt-3 md:hidden"><div className="w-10 h-1 rounded-full bg-gray-soft" /></div>
              <div className={`relative h-48 md:h-56 bg-gradient-to-br ${projects[selected].gradient} overflow-hidden`}>
                <PatternSVG pattern={projects[selected].pattern} color={projects[selected].accentColor} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl border-2 flex items-center justify-center" style={{ borderColor: projects[selected].accentColor, boxShadow: `0 0 30px ${projects[selected].accentColor}20` }}>
                    <span className="font-display text-2xl font-bold" style={{ color: projects[selected].accentColor }}>{projects[selected].title[0]}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full glass-strong flex items-center justify-center text-white text-sm">✕</button>
              </div>
              <div className="p-6">
                <span className="text-[10px] uppercase tracking-[0.15em] text-cyan-glow font-semibold">{projects[selected].category}</span>
                <h3 className="font-display text-2xl font-bold text-white mt-1 mb-3">{projects[selected].title}</h3>
                <p className="text-gray-medium text-sm leading-relaxed mb-5">{projects[selected].description}</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {projects[selected].tech.map((t) => <span key={t} className="px-3 py-1 rounded-full text-[11px] font-medium bg-surface border border-gray-soft/30 text-charcoal-light">{t}</span>)}
                </div>
                <div className="p-4 rounded-xl bg-surface border border-gray-soft/20 mb-5">
                  <span className="text-[10px] uppercase tracking-wider text-gray-medium">Impact</span>
                  <p className="text-sm font-medium text-white mt-1">{projects[selected].metrics}</p>
                </div>
                <button className="w-full py-3.5 rounded-xl bg-cyan-glow text-midnight font-display font-semibold text-sm hover:bg-cyan-soft transition-colors">Discuss Similar Project →</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
