import { motion } from 'framer-motion';
import Logo from './Logo';

export default function Footer() {
  const quickLinks = [
    { label: 'Work', id: 'portfolio' },
    { label: 'Pricing', id: 'pricing' },
    { label: 'Brief', id: 'project-brief' },
    { label: 'Contact', id: 'contact' },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="py-10 px-5 pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 py-6 border-t border-gray-soft/30">
            <div>
              <div className="mb-2"><Logo size="sm" /></div>
              <p className="text-gray-medium text-xs">Premium digital products. Crafted with precision.</p>
            </div>
            <div className="flex items-center gap-6">
              {quickLinks.map((link) => (
                <button key={link.id} onClick={() => scrollTo(link.id)} className="text-xs text-gray-medium hover:text-white transition-colors font-medium">
                  {link.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 pt-4 border-t border-gray-soft/20">
            <p className="text-[11px] text-gray-medium">© 2025 SpotAware.dev. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="/client" className="text-[11px] text-cyan-glow/70 hover:text-cyan-glow transition-colors font-medium">Client Portal</a>
              <a href="/admin" className="text-[11px] text-gray-medium/40 hover:text-cyan-glow transition-colors">Admin</a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
