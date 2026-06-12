import { type Activity } from '../../utils/storage';
import { bgCard, border, borderLight, textSecondary, textMuted, fmt } from './types';

interface Props {
  activities: Activity[];
}

export default function AdminActivityTab({ activities }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-white">Activity Log</h3>
        <span className="text-[11px]" style={{ color: textMuted }}>{activities.length} entries</span>
      </div>
      {activities.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: border, color: textMuted }}>No activity yet. All actions across the platform will be logged here.</div>}
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        {activities.map((a, i) => {
          const icons: Record<string, string> = { lead: '👤', submission: '📝', chat: '💬', order: '📦', invoice: '📄', payment: '💰', client: '🏢', system: '⚙️' };
          const colors: Record<string, string> = { lead: '#f59e0b', submission: '#a78bfa', chat: '#60a5fa', order: '#00e5ff', invoice: '#34d399', payment: '#22c55e', client: '#06b6d4', system: '#6b7094' };
          return (
            <div key={a.id} className={`px-4 py-3 flex items-center gap-3 ${i > 0 ? 'border-t' : ''}`} style={{ borderColor: borderLight }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${colors[a.type]}10`, border: `1px solid ${colors[a.type]}20` }}>
                <span className="text-sm">{icons[a.type] || '📌'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white"><span className="font-semibold">{a.action}</span></p>
                <p className="text-[12px] truncate" style={{ color: textSecondary }}>{a.detail}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px]" style={{ color: textMuted }}>{fmt(a.timestamp)}</p>
                {a.email && <p className="text-[10px]" style={{ color: textMuted }}>{a.email}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
