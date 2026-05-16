import { motion } from 'framer-motion';

const stats = [
  { number: '120+', label: 'Projects Shipped' },
  { number: '40+', label: 'Global Clients' },
  { number: '99%', label: 'Client Retention' },
  { number: '4.9★', label: 'Average Rating' },
];

const clientTypes = ['Startups', 'FinTech', 'HealthTech', 'E-Commerce', 'AI Companies', 'Enterprise'];

export default function TrustStrip() {
  return (
    <section className="py-12 px-5">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.6 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-panel rounded-2xl p-5 text-center premium-shadow">
              <div className="font-display text-2xl md:text-3xl font-bold text-gradient mb-1">{stat.number}</div>
              <div className="text-[11px] md:text-xs uppercase tracking-wider text-gray-medium font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }} className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.15em] text-gray-medium font-medium mr-2">Trusted by</span>
          {clientTypes.map((type) => (
            <span key={type} className="px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide text-charcoal-light bg-surface-card border border-gray-soft/40">{type}</span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
