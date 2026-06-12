export type View = 'dashboard' | 'orders' | 'order-detail' | 'services' | 'invoices' | 'invoice-detail' | 'profile' | 'support' | 'ticket-detail' | 'notifications';

export const bg = 'var(--t-bg,#0f1923)';
export const bgCard = 'var(--t-card,#152230)';
export const bgEl = 'var(--t-el,#1a2d3d)';
export const bgIn = 'var(--t-in,#1f3344)';
export const bd = 'var(--t-bd,#264055)';
export const bdL = 'var(--t-bdl,#1e3548)';
export const tSec = 'var(--t-sec,#8ab4d0)';
export const tMut = 'var(--t-mut,#4d7a96)';

export const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  review: { label: 'In Review', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  revision: { label: 'Revision', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  completed: { label: 'Completed', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  on_hold: { label: 'On Hold', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  draft: { label: 'Draft', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  sent: { label: 'Sent', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  paid: { label: 'Paid', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  overdue: { label: 'Overdue', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export const fmt = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Services catalog
export const SERVICES = [
  { cat: 'Web Development', items: [
    { name: 'Landing Page', desc: 'Single page, conversion focused', price: 497, time: '5-7 days' },
    { name: 'Business Website', desc: 'Up to 10 pages, CMS, SEO', price: 1497, time: '10-14 days' },
    { name: 'Web Application', desc: 'Custom app, auth, database', price: 3997, time: '3-6 weeks' },
    { name: 'E-commerce Store', desc: 'Full store, payments, inventory', price: 2997, time: '2-4 weeks' },
    { name: 'Website Redesign', desc: 'Modern refresh, speed, mobile', price: 997, time: '1-3 weeks' },
  ]},
  { cat: 'Design & Branding', items: [
    { name: 'UI/UX Design', desc: 'Complete design system, prototypes', price: 1497, time: '1-2 weeks' },
    { name: 'Logo & Brand Kit', desc: 'Logo, colors, typography, guidelines', price: 297, time: '3-5 days' },
    { name: 'Custom Illustrations', desc: 'Brand illustrations pack', price: 397, time: '5-7 days' },
  ]},
  { cat: 'Add-on Services', items: [
    { name: 'SEO Optimization', desc: 'On-page, technical, speed audit', price: 497, time: '1 week' },
    { name: 'Analytics Setup', desc: 'GA4, heatmaps, conversion tracking', price: 197, time: '2-3 days' },
    { name: 'Monthly Maintenance', desc: 'Updates, backups, monitoring', price: 197, time: 'Monthly' },
    { name: 'Rush Delivery', desc: '50% faster delivery', price: 0, time: '+30% cost' },
    { name: 'API Integration', desc: '3rd party API connections', price: 497, time: '3-5 days' },
    { name: 'Email System', desc: 'Transactional + marketing emails', price: 397, time: '3-5 days' },
  ]},
];
