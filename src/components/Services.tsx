import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const services = [
  {
    icon: '🎯', title: 'Landing Pages', shortDesc: 'High-converting single pages',
    fullDesc: 'Stunning, conversion-focused landing pages that capture leads and drive action.',
    details: ['Custom responsive design', 'Mobile-first optimization', 'Hero with strong CTA', 'Features showcase', 'Testimonials section', 'Contact form integration', 'SEO optimization', 'Analytics setup'],
    technologies: ['React', 'Next.js', 'Tailwind CSS', 'Framer Motion'],
    startingPrice: '$497', timeline: '5-7 days', gradient: 'from-cyan-glow/10 to-blue-500/5',
  },
  {
    icon: '🌐', title: 'Multi-page Websites', shortDesc: 'Complete brand presence online',
    fullDesc: 'Full websites that establish your brand authority with multiple pages working together.',
    details: ['Up to 10 custom pages', 'Premium UI/UX design', 'Blog/CMS integration', 'Advanced animations', 'Newsletter setup', 'Advanced SEO', 'Speed optimization', 'SSL & security'],
    technologies: ['React', 'Next.js', 'Headless CMS', 'TypeScript'],
    startingPrice: '$1,497', timeline: '10-14 days', gradient: 'from-violet-accent/10 to-purple-500/5',
  },
  {
    icon: '⚡', title: 'Web Applications', shortDesc: 'Custom features & functionality',
    fullDesc: 'Powerful custom web applications with auth, databases, and complex functionality.',
    details: ['Custom architecture', 'User authentication', 'Database design', 'Admin dashboard', 'API development', 'Real-time features', 'Cloud deployment', 'Security best practices'],
    technologies: ['React', 'Node.js', 'PostgreSQL', 'AWS/Vercel'],
    startingPrice: '$3,997', timeline: '3-6 weeks', gradient: 'from-emerald-500/10 to-teal-500/5',
  },
  {
    icon: '🛒', title: 'E-commerce Stores', shortDesc: 'Online stores that sell 24/7',
    fullDesc: 'Complete online stores with beautiful showcases, secure checkout, optimized for conversions.',
    details: ['Custom storefront', 'Product catalog', 'Shopping cart & checkout', 'Payment integration', 'Inventory management', 'Order tracking', 'Customer accounts', 'Mobile shopping'],
    technologies: ['Shopify', 'Stripe', 'React', 'Headless Commerce'],
    startingPrice: '$2,997', timeline: '2-4 weeks', gradient: 'from-amber-500/10 to-orange-500/5',
  },
];

export default function Services() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const scrollToBrief = () => document.getElementById('project-brief')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="py-16 md:py-24 px-5" id="services">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-glow font-semibold">What We Build</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white mt-3 tracking-tight">Our Services</h2>
          <p className="text-gray-medium text-[15px] md:text-lg max-w-md mx-auto mt-4">Premium digital products tailored to your goals. Tap any service to explore.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}>
              <motion.div
                onClick={() => setExpanded(expanded === i ? null : i)}
                className={`cursor-pointer rounded-2xl overflow-hidden transition-all duration-500 premium-shadow ${expanded === i ? 'ring-1 ring-cyan-glow/30 shadow-[0_0_30px_rgba(0,229,255,0.08)]' : 'glass-panel hover:border-gray-soft/50'}`}
                layout
              >
                <div className={`p-5 bg-gradient-to-br ${s.gradient}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-card/80 flex items-center justify-center text-xl border border-gray-soft/30">{s.icon}</div>
                      <div>
                        <h3 className="font-display font-bold text-white text-base">{s.title}</h3>
                        <p className="text-gray-medium text-sm">{s.shortDesc}</p>
                      </div>
                    </div>
                    <motion.div animate={{ rotate: expanded === i ? 45 : 0 }} className="w-7 h-7 rounded-full bg-gray-soft/30 flex items-center justify-center text-gray-medium text-sm">+</motion.div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="px-3 py-1 rounded-full bg-surface-card/80 text-xs font-semibold text-cyan-glow border border-gray-soft/30">From {s.startingPrice}</span>
                    <span className="px-3 py-1 rounded-full bg-surface-card/60 text-xs text-gray-medium border border-gray-soft/20">⏱ {s.timeline}</span>
                  </div>
                </div>

                <AnimatePresence>
                  {expanded === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                      <div className="p-5 pt-0 border-t border-gray-soft/20">
                        <p className="text-charcoal-light text-[15px] leading-relaxed mt-4 mb-4">{s.fullDesc}</p>
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-3 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-cyan-glow/10 flex items-center justify-center text-[10px] text-cyan-glow">✓</span>Included
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {s.details.map((d, idx) => (
                              <motion.div key={d} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="flex items-center gap-2 text-[14px] text-charcoal-light">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow flex-shrink-0" />{d}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {s.technologies.map((t) => <span key={t} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface border border-gray-soft/30 text-gray-medium">{t}</span>)}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }} className="w-full py-3 rounded-xl bg-cyan-glow text-midnight font-display font-semibold text-sm hover:bg-cyan-soft transition-colors">
                          See Pricing →
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mt-8">
          <p className="text-sm text-gray-medium">Also available: <span className="text-white font-medium">Redesign & Upgrade</span> ($997+)</p>
          <button onClick={scrollToBrief} className="mt-3 text-sm text-cyan-glow font-medium hover:underline">See all in Project Brief →</button>
        </motion.div>
      </div>
    </section>
  );
}
