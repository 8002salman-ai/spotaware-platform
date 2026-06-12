import {
  type ClientUser, type SupportTicket,
  updateTicketStatus, addTicketMessage, addNotification,
} from '../../utils/storage';
import {
  updateSupportTicketStatusInSupabase,
  addSupportMessageInSupabase,
  createActivityLogInSupabase,
} from '../../utils/supabaseData';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { bgCard, bgElevated, bgInput, border, borderLight, textSecondary, textMuted, fmt } from './types';

interface Props {
  allTickets: SupportTicket[];
  clients: ClientUser[];
  selTicketId: string | null;
  setSelTicketId: (id: string | null) => void;
  adminTicketReply: string;
  setAdminTicketReply: (v: string) => void;
  currentUser: { id: string; email: string; role: string } | null;
  reload: () => void;
}

export default function AdminSupportTab({ allTickets, clients, selTicketId, setSelTicketId, adminTicketReply, setAdminTicketReply, currentUser, reload }: Props) {
  const sColors: Record<string, string> = { open: 'bg-amber-500/15 text-amber-400 border-amber-500/20', in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/20', waiting_client: 'bg-violet-500/15 text-violet-400 border-violet-500/20', resolved: 'bg-green-500/15 text-green-400 border-green-500/20', closed: 'bg-gray-500/15 text-gray-400 border-gray-500/20' };
  const pColors: Record<string, string> = { low: '#6b7094', medium: '#60a5fa', high: '#f59e0b', urgent: '#ef4444' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-white">🎧 Support Tickets</h3>
        <span className="text-[11px]" style={{ color: textMuted }}>{allTickets.length} total • {allTickets.filter(t => t.status === 'open').length} open</span>
      </div>
      {allTickets.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: border, color: textMuted }}>No tickets yet. Tickets appear when clients submit support requests.</div>}
      {allTickets.map(t => {
        const isOpen = selTicketId === t.id;
        const client = clients.find(c => c.id === t.clientId);
        return (
          <div key={t.id} className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: isOpen ? 'rgba(0,229,255,0.3)' : border }}>
            <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => setSelTicketId(isOpen ? null : t.id)}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 rounded-full" style={{ background: pColors[t.priority] }} />
                <div>
                  <p className="text-[14px] font-medium text-white">{t.subject}</p>
                  <p className="text-[11px]" style={{ color: textMuted }}>{client?.name || client?.email || 'Unknown'} • {t.messages.length} msgs • {fmt(t.updatedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={t.status} onChange={e => { e.stopPropagation(); const nextStatus = e.target.value as SupportTicket['status']; if (isSupabaseAuthEnabled()) { void updateSupportTicketStatusInSupabase(t.id, nextStatus).then(async () => { await createActivityLogInSupabase({ actionType: 'system', actionLabel: 'Support Status', detail: `Ticket ${t.subject} -> ${nextStatus}`, entityId: t.id, actorId: currentUser?.id, actorEmail: currentUser?.email }); reload(); }); } else { updateTicketStatus(t.id, nextStatus); void reload(); } if (nextStatus === 'resolved') { addNotification('Ticket Resolved', `Your ticket "${t.subject}" has been resolved.`, 'success', t.clientId); } }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium border cursor-pointer ${sColors[t.status]}`} style={{ background: 'transparent' }}>
                  <option value="open">Open</option><option value="in_progress">In Progress</option><option value="waiting_client">Waiting Client</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                </select>
              </div>
            </div>
            {isOpen && (
              <div className="border-t p-4" style={{ borderColor: borderLight }}>
                <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                  {t.messages.map(m => (
                    <div key={m.id} className={`p-3 rounded-xl text-[13px] ${m.by === 'admin' ? 'bg-cyan-glow/5 border border-cyan-glow/10 ml-6' : 'border mr-6'}`} style={m.by !== 'admin' ? { borderColor: borderLight, background: bgElevated } : undefined}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium" style={{ color: m.by === 'admin' ? '#67f0ff' : textSecondary }}>{m.by === 'admin' ? '🛡 You' : '👤 Client'}</span>
                        <span className="text-[10px]" style={{ color: textMuted }}>{fmt(m.timestamp)}</span>
                      </div>
                      <p style={{ color: textSecondary }}>{m.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={adminTicketReply} onChange={e => setAdminTicketReply(e.target.value)} placeholder="Reply to client..." className="flex-1 px-3 py-2 rounded-xl text-[13px] text-white focus:outline-none placeholder:text-[#4a4f6a]" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                  <button onClick={() => {
                    if (!adminTicketReply.trim()) return;
                    if (isSupabaseAuthEnabled()) {
                      void addSupportMessageInSupabase(t.id, t.clientId, adminTicketReply, 'admin').then(() => {
                        void createActivityLogInSupabase({
                          actionType: 'chat',
                          actionLabel: 'Support Reply',
                          detail: `Admin replied on ticket: ${t.subject}`,
                          entityId: t.id,
                          actorId: currentUser?.id,
                          actorEmail: currentUser?.email,
                        });
                        addNotification('Support Reply', `New reply on your ticket: "${t.subject}"`, 'info', t.clientId);
                        setAdminTicketReply('');
                        reload();
                      });
                      return;
                    }
                    addTicketMessage(t.id, adminTicketReply, 'admin');
                    addNotification('Support Reply', `New reply on your ticket: "${t.subject}"`, 'info', t.clientId);
                    setAdminTicketReply(''); void reload();
                  }} className="px-4 py-2 rounded-xl text-xs font-medium bg-cyan-glow text-midnight">Send</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
