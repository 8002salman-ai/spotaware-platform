import { useState } from 'react';
import {
  type Lead, type ChatSession, type ProjectSubmission, type ClientUser,
  updateLeadStatus, deleteLead, convertLeadToClient,
} from '../../utils/storage';
import {
  updateLeadStatusInSupabase,
  deleteLeadInSupabase,
} from '../../utils/supabaseData';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { bgCard, bgElevated, border, borderLight, textSecondary, textMuted, statusColor, fmt } from './types';

interface Props {
  leads: Lead[];
  chats: ChatSession[];
  submissions: ProjectSubmission[];
  clients: ClientUser[];
  setTab: (tab: 'leads') => void;
  reload: () => void;
}

export default function AdminLeadsTab({ leads, chats, submissions, clients, setTab, reload }: Props) {
  const [selClientId, setSelClientId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {leads.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: border, color: textMuted }}>No leads yet. They appear when visitors use chatbot or submit forms.</div>}
      {leads.map(l => {
        const lChats = chats.filter(c => c.email.toLowerCase() === l.email.toLowerCase());
        const lSubs = submissions.filter(s => s.email.toLowerCase() === l.email.toLowerCase());
        const lClient = clients.find(c => c.email.toLowerCase() === l.email.toLowerCase());
        const isOpen = selClientId === l.id;
        return (
          <div key={l.id} className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: isOpen ? 'rgba(0,229,255,0.3)' : border }}>
            <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => setSelClientId(isOpen ? null : l.id)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: bgElevated, border: `1px solid ${border}`, color: textSecondary }}>{l.email[0].toUpperCase()}</div>
                <div>
                  <p className="text-[14px] font-medium text-white">{l.name || l.email}</p>
                  <p className="text-[11px]" style={{ color: textMuted }}>{l.email} • {l.source} • {fmt(l.timestamp)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {lChats.length > 0 && <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/20">💬 {lChats.reduce((a,c)=>a+c.messages.length,0)} msgs</span>}
                {lSubs.length > 0 && <span className="px-2 py-0.5 rounded text-[10px] bg-violet-500/15 text-violet-400 border border-violet-500/20">📝 {lSubs.length} brief</span>}
                {lClient && <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/15 text-green-400 border border-green-500/20">👤 Client</span>}
                <select value={l.status} onChange={e => { e.stopPropagation(); if (isSupabaseAuthEnabled()) { void updateLeadStatusInSupabase(l.id, e.target.value as Lead['status']).then(() => reload()); } else { updateLeadStatus(l.id, e.target.value as Lead['status']); void reload(); } }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium border cursor-pointer ${statusColor(l.status)}`} style={{ background: 'transparent' }}>
                  <option value="new">New</option><option value="contacted">Contacted</option><option value="converted">Converted</option>
                </select>
              </div>
            </div>
            {isOpen && (
              <div className="border-t p-4 space-y-3" style={{ borderColor: borderLight, background: bgElevated }}>
                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <a href={`mailto:${l.email}`} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20">📧 Email</a>
                  <a href={`https://wa.me/?text=Hi! Following up from SpotAware.dev...`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">📱 WhatsApp</a>
                  <button onClick={() => { if (isSupabaseAuthEnabled()) { void updateLeadStatusInSupabase(l.id, 'contacted').then(() => reload()); } else { updateLeadStatus(l.id, 'contacted'); void reload(); } }} className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-white/5" style={{ borderColor: borderLight, color: textSecondary }}>✓ Mark Contacted</button>
                  <button onClick={() => {
                    const client = convertLeadToClient(l.id);
                    if (client) { alert(`Client account created for ${l.email}\nPassword: Welcome123`); reload(); }
                    else { alert('Already a client or error'); }
                  }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">🎉 Convert to Client</button>
                  <button onClick={() => { if(confirm('Delete lead?')){ if (isSupabaseAuthEnabled()) { void deleteLeadInSupabase(l.id).then(() => reload()); } else { deleteLead(l.id); void reload(); } }}} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 ml-auto">Delete</button>
                </div>
                {/* Chat history */}
                {lChats.length > 0 && (
                  <div className="rounded-xl border p-3" style={{ borderColor: borderLight, background: bgCard }}>
                    <p className="text-xs font-semibold text-white mb-2">💬 Chat History ({lChats.reduce((a,c)=>a+c.messages.length,0)} messages)</p>
                    {lChats.map(c => (
                      <div key={c.id} className="space-y-1 max-h-40 overflow-y-auto">
                        {c.messages.slice(-6).map(m => (
                          <div key={m.id} className={`text-[11px] px-2 py-1 rounded ${m.role === 'user' ? 'bg-cyan-glow/5 text-cyan-glow/80 ml-8' : 'mr-8'}`} style={m.role !== 'user' ? { color: textSecondary } : undefined}>
                            <span className="font-medium">{m.role === 'user' ? '👤' : '🤖'}</span> {m.content.slice(0, 120)}{m.content.length > 120 ? '...' : ''}
                          </div>
                        ))}
                        {c.messages.length > 6 && <p className="text-[10px] text-center" style={{ color: textMuted }}>... {c.messages.length - 6} more messages</p>}
                      </div>
                    ))}
                  </div>
                )}
                {/* Submissions */}
                {lSubs.length > 0 && (
                  <div className="rounded-xl border p-3" style={{ borderColor: borderLight, background: bgCard }}>
                    <p className="text-xs font-semibold text-white mb-2">📝 Project Briefs</p>
                    {lSubs.map(s => (
                      <div key={s.id} className="p-2 rounded-lg border mb-1" style={{ borderColor: borderLight }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-white font-medium">{s.projectType} • {s.budget} • {s.timeline}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-medium border ${statusColor(s.status)}`}>{s.status}</span>
                        </div>
                        {s.description && <p className="text-[11px] mt-1" style={{ color: textMuted }}>{s.description.slice(0, 150)}</p>}
                        <p className="text-[10px] mt-1" style={{ color: textMuted }}>Industry: {s.industry} • {fmt(s.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {lChats.length === 0 && lSubs.length === 0 && <p className="text-xs text-center py-3" style={{ color: textMuted }}>No chat or submission data for this lead</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
