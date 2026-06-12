import { useState } from 'react';
import {
  type Lead, type ChatSession,
  deleteChatSession,
} from '../../utils/storage';
import { deleteChatSessionInSupabase } from '../../utils/supabaseData';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { bgCard, bgElevated, border, borderLight, textSecondary, textMuted, statusColor, fmt } from './types';

interface Props {
  chats: ChatSession[];
  leads: Lead[];
  setTab: (tab: 'leads') => void;
  reload: () => void;
}

export default function AdminChatsTab({ chats, leads, setTab, reload }: Props) {
  const [selChat, setSelChat] = useState<ChatSession | null>(null);

  return (
    <div className="space-y-4">
      {chats.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: border, color: textMuted }}>No chats yet. Conversations appear when visitors use SpotBot.</div>}
      {chats.map(c => {
        const cLead = leads.find(l => l.email.toLowerCase() === c.email.toLowerCase());
        const isOpen = selChat?.id === c.id;
        return (
          <div key={c.id} className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: isOpen ? 'rgba(0,229,255,0.3)' : border }}>
            <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => setSelChat(isOpen ? null : c)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: bgElevated, border: `1px solid ${border}` }}>💬</div>
                <div>
                  <p className="text-[14px] font-medium text-white">{c.email}</p>
                  <p className="text-[11px]" style={{ color: textMuted }}>{c.messages.length} messages • {fmt(c.lastMessageAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cLead && <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusColor(cLead.status)}`}>{cLead.status}</span>}
                <span className="text-xs" style={{ color: textMuted }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>
            {isOpen && (
              <div className="border-t" style={{ borderColor: borderLight }}>
                <div className="p-4 space-y-2 max-h-72 overflow-y-auto" style={{ background: '#1e2034' }}>
                  {c.messages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-xl text-[12px] ${m.role === 'user' ? 'bg-cyan-glow/10 text-cyan-glow/90 rounded-br-sm' : 'rounded-bl-sm'}`}
                        style={m.role !== 'user' ? { background: bgElevated, color: textSecondary, border: `1px solid ${borderLight}` } : undefined}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 flex gap-2 border-t" style={{ borderColor: borderLight, background: bgElevated }}>
                  <a href={`mailto:${c.email}`} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20">📧 Email</a>
                  <button onClick={() => { setTab('leads'); }} className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-white/5" style={{ borderColor: borderLight, color: textSecondary }}>👤 View Lead</button>
                  <button onClick={() => { if (isSupabaseAuthEnabled()) { void deleteChatSessionInSupabase(c.id).then(() => { setSelChat(null); reload(); }); } else { deleteChatSession(c.id); setSelChat(null); void reload(); } }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 ml-auto">Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
