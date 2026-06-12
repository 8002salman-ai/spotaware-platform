import { type SupportTicket, createTicket, addTicketMessage, getClientTickets } from '../../utils/storage';
import {
  createSupportTicketInSupabase,
  addSupportMessageInSupabase,
  fetchClientSupport,
  notifyAdminInSupabase,
} from '../../utils/supabaseData';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { useState } from 'react';
import { bgCard, bgEl, bgIn, bdL, bd, tSec, tMut, fmt } from './types';

interface Props {
  tickets: SupportTicket[];
  setTickets: (t: SupportTicket[]) => void;
  session: { id: string; name: string; email: string } | null;
  loadPortalData: (clientId: string) => Promise<void>;
}

export default function ClientSupportView({ tickets, setTickets, session, loadPortalData }: Props) {
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketReply, setTicketReply] = useState('');
  const [selTicket, setSelTicket] = useState<SupportTicket | null>(null);

  const pColors: Record<string, string> = { low: 'text-gray-400', medium: 'text-blue-400', high: 'text-amber-400', urgent: 'text-red-400' };
  const sColors: Record<string, string> = { open: 'bg-amber-500/15 text-amber-400 border-amber-500/20', in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/20', waiting_client: 'bg-violet-500/15 text-violet-400 border-violet-500/20', resolved: 'bg-green-500/15 text-green-400 border-green-500/20', closed: 'bg-gray-500/15 text-gray-400 border-gray-500/20' };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-white">Support</h2>
      </div>
      {/* New ticket form */}
      <div className="rounded-xl border p-4" style={{ background: bgCard, borderColor: bd }}>
        <p className="text-xs font-semibold text-white mb-3">🎧 Create New Ticket</p>
        <div className="space-y-2">
          <input value={ticketSubject} onChange={e => setTicketSubject(e.target.value)} placeholder="Subject — e.g. Logo revision needed" className="w-full px-4 py-2.5 rounded-xl text-[13px] text-white focus:outline-none placeholder:text-[#4a4f6a]" style={{ background: bgIn, border: `1px solid ${bd}` }} />
          <textarea value={ticketMsg} onChange={e => setTicketMsg(e.target.value)} placeholder="Describe your issue or request..." rows={3} className="w-full px-4 py-2.5 rounded-xl text-[13px] text-white focus:outline-none resize-none placeholder:text-[#4a4f6a]" style={{ background: bgIn, border: `1px solid ${bd}` }} />
          <button onClick={() => {
            if (!ticketSubject || !ticketMsg || !session) return;
            if (isSupabaseAuthEnabled()) {
              void createSupportTicketInSupabase({
                clientId: session.id,
                subject: ticketSubject,
                content: ticketMsg,
              }).then(async () => {
                await notifyAdminInSupabase({
                  type: 'client',
                  title: 'New Support Ticket',
                  message: `${session.name} (${session.email}) opened support ticket: ${ticketSubject}. ${ticketMsg}`,
                });
                await loadPortalData(session.id);
              });
            } else {
              createTicket(session.id, ticketSubject, ticketMsg);
            }
            setTicketSubject(''); setTicketMsg('');
            if (!isSupabaseAuthEnabled()) setTickets(getClientTickets(session.id));
          }} disabled={!ticketSubject || !ticketMsg} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-cyan-glow text-midnight hover:bg-cyan-soft disabled:opacity-40 transition-colors">Submit Ticket</button>
        </div>
      </div>
      {/* Ticket list */}
      {tickets.map(t => {
        const isOpen = selTicket?.id === t.id;
        return (
          <div key={t.id} className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: isOpen ? 'rgba(0,229,255,0.3)' : bd }}>
            <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => setSelTicket(isOpen ? null : t)}>
              <div>
                <p className="text-[14px] font-medium text-white">{t.subject}</p>
                <p className="text-[11px]" style={{ color: tMut }}>{t.messages.length} messages • {fmt(t.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${pColors[t.priority]}`}>●</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${sColors[t.status]}`}>{t.status.replace('_', ' ')}</span>
              </div>
            </div>
            {isOpen && (
              <div className="border-t p-4" style={{ borderColor: bdL }}>
                <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                  {t.messages.map(m => (
                    <div key={m.id} className={`p-3 rounded-xl text-[13px] ${m.by === 'client' ? 'bg-cyan-glow/5 border border-cyan-glow/10 ml-6' : 'border mr-6'}`} style={m.by !== 'client' ? { borderColor: bdL, background: bgEl } : undefined}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium" style={{ color: m.by === 'client' ? '#67f0ff' : tSec }}>{m.by === 'client' ? '👤 You' : '🛡 Support'}</span>
                        <span className="text-[10px]" style={{ color: tMut }}>{fmt(m.timestamp)}</span>
                      </div>
                      <p style={{ color: tSec }}>{m.content}</p>
                    </div>
                  ))}
                </div>
                {t.status !== 'closed' && (
                  <div className="flex gap-2">
                    <input value={ticketReply} onChange={e => setTicketReply(e.target.value)} placeholder="Reply..." className="flex-1 px-3 py-2 rounded-xl text-[13px] text-white focus:outline-none placeholder:text-[#4a4f6a]" style={{ background: bgIn, border: `1px solid ${bdL}` }} />
                    <button onClick={() => {
                      if (!ticketReply.trim()) return;
                      if (isSupabaseAuthEnabled()) {
                        void addSupportMessageInSupabase(t.id, session!.id, ticketReply, 'client').then(async () => {
                          await notifyAdminInSupabase({
                            type: 'chat',
                            title: 'Client Support Reply',
                            message: `${session!.name} (${session!.email}) replied on ticket "${t.subject}": ${ticketReply}`,
                            entityId: t.id,
                          });
                          setTicketReply('');
                          await loadPortalData(session!.id);
                          const refreshed = await fetchClientSupport(session!.id);
                          setSelTicket(refreshed.tickets.find(x => x.id === t.id) || null);
                        });
                        return;
                      }
                      addTicketMessage(t.id, ticketReply, 'client');
                      setTicketReply('');
                      setTickets(getClientTickets(session!.id));
                      setSelTicket(getClientTickets(session!.id).find(x => x.id === t.id) || null);
                    }} className="px-4 py-2 rounded-xl text-xs font-medium bg-cyan-glow text-midnight">Send</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {tickets.length === 0 && <div className="rounded-xl p-10 text-center border" style={{ background: bgCard, borderColor: bd, color: tMut }}>No tickets yet. Create one above if you need help.</div>}
    </div>
  );
}
