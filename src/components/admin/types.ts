export type Tab = 'dashboard' | 'leads' | 'submissions' | 'chats' | 'settings' | 'users' | 'clients' | 'activity' | 'support';

// Re-export color constants used by tab components
export const bg = 'var(--t-bg,#0f1923)';
export const bgCard = 'var(--t-card,#152230)';
export const bgElevated = 'var(--t-el,#1a2d3d)';
export const bgInput = 'var(--t-in,#1f3344)';
export const border = 'var(--t-bd,#264055)';
export const borderLight = 'var(--t-bdl,#1e3548)';
export const textSecondary = 'var(--t-sec,#8ab4d0)';
export const textMuted = 'var(--t-mut,#4d7a96)';

export function statusColor(s: string): string {
  const m: Record<string, string> = {
    new: 'bg-cyan-glow/15 text-cyan-400 border-cyan-glow/30',
    contacted: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    reviewed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    proposal_sent: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    converted: 'bg-green-500/15 text-green-400 border-green-500/30',
  };
  return m[s] || 'bg-gray-500/15 text-gray-400 border-gray-500/30';
}

export function fmt(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
