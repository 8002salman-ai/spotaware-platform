import { useState } from 'react';
import {
  type Lead, type ProjectSubmission, type ClientUser,
  updateSubmissionStatus, deleteSubmission,
} from '../../utils/storage';
import {
  updateSubmissionStatusInSupabase,
  deleteSubmissionInSupabase,
} from '../../utils/supabaseData';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { bgCard, bgElevated, border, borderLight, textSecondary, textMuted, statusColor, fmt } from './types';

interface Props {
  submissions: ProjectSubmission[];
  leads: Lead[];
  clients: ClientUser[];
  setTab: (tab: 'leads') => void;
  reload: () => void;
}

export default function AdminSubmissionsTab({ submissions, leads, clients, setTab, reload }: Props) {
  const [selSub, setSelSub] = useState<ProjectSubmission | null>(null);

  return (
    <div className="space-y-4">
      {submissions.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: border, color: textMuted }}>No submissions yet. Briefs appear when visitors fill the Project Brief form.</div>}
      {submissions.map(s => {
        const sLead = leads.find(l => l.email.toLowerCase() === s.email.toLowerCase());
        const sClient = clients.find(c => c.email.toLowerCase() === s.email.toLowerCase());
        const isOpen = selSub?.id === s.id;
        return (
          <div key={s.id} className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: isOpen ? 'rgba(0,229,255,0.3)' : border }}>
            <div className="p-4 cursor-pointer" onClick={() => setSelSub(isOpen ? null : s)}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-white text-[15px]">{s.name}</p>
                  <p className="text-[12px]" style={{ color: textMuted }}>{s.email}{s.company ? ` • ${s.company}` : ''} • {fmt(s.timestamp)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {sClient && <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/15 text-green-400 border border-green-500/20">👤 Client</span>}
                  <select value={s.status} onChange={e => { e.stopPropagation(); if (isSupabaseAuthEnabled()) { void updateSubmissionStatusInSupabase(s.id, e.target.value as ProjectSubmission['status']).then(() => reload()); } else { updateSubmissionStatus(s.id, e.target.value as ProjectSubmission['status']); void reload(); } }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium border cursor-pointer ${statusColor(s.status)}`} style={{ background: 'transparent' }}>
                    <option value="new">New</option><option value="reviewed">Reviewed</option><option value="proposal_sent">Proposal Sent</option><option value="converted">Converted</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-1 rounded text-[11px] font-medium bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/15">📦 {s.projectType}</span>
                <span className="px-2 py-1 rounded text-[11px] border" style={{ borderColor: borderLight, color: textSecondary }}>💰 {s.budget}</span>
                <span className="px-2 py-1 rounded text-[11px] border" style={{ borderColor: borderLight, color: textSecondary }}>⏱ {s.timeline}</span>
                <span className="px-2 py-1 rounded text-[11px] border" style={{ borderColor: borderLight, color: textSecondary }}>🏢 {s.industry}</span>
              </div>
            </div>
            {isOpen && (
              <div className="border-t p-4 space-y-3" style={{ borderColor: borderLight, background: bgElevated }}>
                {/* Full details */}
                {s.features.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-white mb-1.5">Features Requested:</p>
                    <div className="flex flex-wrap gap-1">{s.features.map(f => <span key={f} className="px-2 py-0.5 rounded text-[11px] bg-violet-500/10 text-violet-400 border border-violet-500/15">{f}</span>)}</div>
                  </div>
                )}
                {s.description && (
                  <div className="p-3 rounded-lg border" style={{ borderColor: borderLight, background: bgCard }}>
                    <p className="text-xs font-medium text-white mb-1">Client Notes & Pricing:</p>
                    <p className="text-[12px] whitespace-pre-wrap" style={{ color: textSecondary }}>{s.description}</p>
                  </div>
                )}
                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <a href={`mailto:${s.email}?subject=Your SpotAware Project Brief — ${s.projectType}&body=Hi ${s.name},%0D%0A%0D%0AThanks for your interest in our ${s.projectType} package!`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20">📧 Reply to Client</a>
                  <a href={`https://wa.me/?text=Hi ${s.name}! Thanks for your project brief for ${s.projectType}...`} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">📱 WhatsApp</a>
                  <button onClick={() => { if (isSupabaseAuthEnabled()) { void updateSubmissionStatusInSupabase(s.id, 'proposal_sent').then(() => reload()); } else { updateSubmissionStatus(s.id, 'proposal_sent'); void reload(); } }} className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-white/5" style={{ borderColor: borderLight, color: textSecondary }}>📄 Mark Proposal Sent</button>
                  <button onClick={() => { if(confirm('Delete submission?')){ if (isSupabaseAuthEnabled()) { void deleteSubmissionInSupabase(s.id).then(() => { setSelSub(null); reload(); }); } else { deleteSubmission(s.id); setSelSub(null); void reload(); } }}} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 ml-auto">Delete</button>
                </div>
                {/* Lead link */}
                {sLead && (
                  <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: borderLight }}>
                    <span className="text-[11px]" style={{ color: textMuted }}>Lead status:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusColor(sLead.status)}`}>{sLead.status}</span>
                    <button onClick={() => { setTab('leads'); }} className="text-[11px] text-cyan-glow hover:underline ml-auto">View in Leads →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
