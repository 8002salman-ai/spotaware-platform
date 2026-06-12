import { type Lead, type Activity } from '../../utils/storage';
import { type Tab, bgCard, border, borderLight, textSecondary, textMuted, statusColor, fmt } from './types';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { createActivityLogInSupabase } from '../../utils/supabaseData';
import { exportAllData, clearAllData, logActivity, checkOverdueInstallments, checkOverdueDeadlines } from '../../utils/storage';

interface FullStats {
  revenue: { total: number; month: number };
  orders: { active: number; onHold: number; completed: number; total: number };
  conversionRate: number;
  leads: { total: number; new: number; today: number; week: number };
  submissions: { total: number; new: number; today: number };
  chats: { total: number; messages: number };
  clients: { total: number };
  invoices: { total: number; pending: number; overdue: number; pendingAmount: number };
}

interface Props {
  fullStats: FullStats;
  leads: Lead[];
  activities: Activity[];
  settings: { whatsapp: { phoneNumber: string } };
  currentUser: { id: string; email: string; role: string } | null;
  setTab: (tab: Tab) => void;
  reload: () => void;
}

export default function AdminDashboardTab({ fullStats, leads, activities, settings, currentUser, setTab, reload }: Props) {
  return (
    <div className="space-y-5">
      {/* Row 1: Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Total Revenue', v: `$${fullStats.revenue.total.toLocaleString()}`, s: `$${fullStats.revenue.month.toLocaleString()} this month`, tab: 'clients' as Tab, color: '#34d399', icon: '💰' },
          { l: 'Active Projects', v: fullStats.orders.active, s: `${fullStats.orders.onHold} on hold`, tab: 'clients' as Tab, color: '#00e5ff', icon: '📦' },
          { l: 'Conversion Rate', v: `${fullStats.conversionRate}%`, s: `${fullStats.leads.total} total leads`, tab: 'leads' as Tab, color: '#a78bfa', icon: '📊' },
          { l: 'Pending Invoices', v: fullStats.invoices.pending, s: `$${fullStats.invoices.pendingAmount.toLocaleString()} due`, tab: 'clients' as Tab, color: '#f59e0b', icon: '📄' },
        ].map(s => (
          <button key={s.l} onClick={() => setTab(s.tab)} className="rounded-xl p-4 border text-left hover:border-cyan-glow/20 transition-all group" style={{ background: bgCard, borderColor: border }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg">{s.icon}</span>
              <span className="w-2 h-2 rounded-full opacity-60" style={{ background: s.color }} />
            </div>
            <p className="font-display text-2xl md:text-3xl font-bold text-white">{s.v}</p>
            <p className="text-[11px] mt-1" style={{ color: textSecondary }}>{s.l}</p>
            <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>{s.s}</p>
          </button>
        ))}
      </div>

      {/* Row 2: Pipeline stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { l: 'New Leads', v: fullStats.leads.new, tab: 'leads' as Tab, c: '#f59e0b' },
          { l: 'Briefs', v: fullStats.submissions.new, tab: 'submissions' as Tab, c: '#a78bfa' },
          { l: 'Chats', v: fullStats.chats.total, tab: 'chats' as Tab, c: '#60a5fa' },
          { l: 'Clients', v: fullStats.clients.total, tab: 'clients' as Tab, c: '#34d399' },
          { l: 'Overdue', v: fullStats.invoices.overdue, tab: 'clients' as Tab, c: '#ef4444' },
          { l: 'Completed', v: fullStats.orders.completed, tab: 'clients' as Tab, c: '#22c55e' },
        ].map(s => (
          <button key={s.l} onClick={() => setTab(s.tab)} className="rounded-lg p-3 border text-center hover:bg-white/[0.02] transition-colors" style={{ background: bgCard, borderColor: borderLight }}>
            <p className="font-display text-xl font-bold" style={{ color: s.c }}>{s.v}</p>
            <p className="text-[10px]" style={{ color: textMuted }}>{s.l}</p>
          </button>
        ))}
      </div>

      {/* Row 3: Quick actions + Recent */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quick actions */}
        <div className="rounded-xl border p-4" style={{ background: bgCard, borderColor: border }}>
          <p className="text-xs font-semibold text-white mb-3">⚡ Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/${settings.whatsapp.phoneNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-lg bg-green-500/10 border border-green-500/15 text-green-400 text-xs font-medium text-center hover:bg-green-500/15 transition-colors">📱 WhatsApp</a>
            <button onClick={() => {
              const d = exportAllData();
              const b = new Blob([d]);
              const u = URL.createObjectURL(b);
              const a = document.createElement('a');
              a.href = u;
              a.download = `spotaware-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              if (isSupabaseAuthEnabled()) {
                void createActivityLogInSupabase({ actionType: 'system', actionLabel: 'Export', detail: 'Data exported from admin panel', actorId: currentUser?.id, actorEmail: currentUser?.email });
              } else {
                logActivity('system', 'export', 'Data exported');
              }
              void reload();
            }} className="p-3 rounded-lg border text-xs font-medium text-center hover:bg-white/[0.03] transition-colors" style={{ borderColor: borderLight, color: textSecondary }}>📥 Export Data</button>
            <button onClick={() => setTab('settings')} className="p-3 rounded-lg border text-xs font-medium text-center hover:bg-white/[0.03] transition-colors" style={{ borderColor: borderLight, color: textSecondary }}>⚙️ Settings</button>
            <button onClick={() => {
              const h = checkOverdueInstallments(); const d = checkOverdueDeadlines();
              alert(`Overdue check complete:\n${h} orders held for payment\n${d} deadlines marked overdue`);
              reload();
            }} className="p-3 rounded-lg border text-xs font-medium text-center hover:bg-white/[0.03] transition-colors" style={{ borderColor: borderLight, color: textSecondary }}>⏰ Check Overdue</button>
          </div>
        </div>

        {/* Recent leads */}
        <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: borderLight }}>
            <span className="text-xs font-semibold text-white">🔥 Recent Leads</span>
            <button onClick={() => setTab('leads')} className="text-[10px] text-cyan-glow hover:underline">View all →</button>
          </div>
          {leads.slice(0, 4).map(l => (
            <div key={l.id} className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: borderLight }}>
              <div><p className="text-[13px] font-medium text-white">{l.name || l.email}</p><p className="text-[10px]" style={{ color: textMuted }}>{l.source} • {fmt(l.timestamp)}</p></div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-medium border ${statusColor(l.status)}`}>{l.status}</span>
            </div>
          ))}
          {leads.length === 0 && <div className="px-4 py-8 text-center text-[12px]" style={{ color: textMuted }}>No leads yet</div>}
        </div>
      </div>

      {/* Row 4: Recent activity */}
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: borderLight }}>
          <span className="text-xs font-semibold text-white">📋 Recent Activity</span>
          <button onClick={() => setTab('activity')} className="text-[10px] text-cyan-glow hover:underline">View all →</button>
        </div>
        {activities.slice(0, 5).map(a => {
          const icons: Record<string, string> = { lead: '👤', submission: '📝', chat: '💬', order: '📦', invoice: '📄', payment: '💰', client: '🏢', system: '⚙️' };
          return (
            <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 border-b" style={{ borderColor: borderLight }}>
              <span className="text-sm">{icons[a.type] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white truncate"><span className="font-medium">{a.action}</span> — {a.detail}</p>
                <p className="text-[10px]" style={{ color: textMuted }}>{fmt(a.timestamp)}{a.email ? ` • ${a.email}` : ''}</p>
              </div>
            </div>
          );
        })}
        {activities.length === 0 && <div className="px-4 py-8 text-center text-[12px]" style={{ color: textMuted }}>No activity yet. Actions will be logged here.</div>}
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl p-4 border border-red-500/20 bg-red-500/5">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-semibold text-red-400">⚠ Danger Zone</p><p className="text-[10px] text-red-400/60">Permanent actions</p></div>
          <button onClick={() => {
            if (confirm('Delete ALL data? This cannot be undone.')) {
              clearAllData();
              if (isSupabaseAuthEnabled()) {
                void createActivityLogInSupabase({ actionType: 'system', actionLabel: 'Clear Data', detail: 'Local cache cleared', actorId: currentUser?.id, actorEmail: currentUser?.email });
              } else {
                logActivity('system', 'clear', 'All data cleared');
              }
              void reload();
            }
          }} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-red-500/80 hover:bg-red-500">Clear All Data</button>
        </div>
      </div>
    </div>
  );
}
