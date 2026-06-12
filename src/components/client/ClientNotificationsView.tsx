import { type AppNotification, getNotifications, markAllNotifsRead } from '../../utils/storage';
import { markAllNotificationsReadInSupabase } from '../../utils/supabaseData';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { bgCard, bd, tSec, tMut, fmt } from './types';

interface Props {
  notifs: AppNotification[];
  setNotifs: (n: AppNotification[]) => void;
  session: { id: string; name: string; email: string } | null;
  loadPortalData: (clientId: string) => Promise<void>;
}

export default function ClientNotificationsView({ notifs, setNotifs, session, loadPortalData }: Props) {
  const icons: Record<string, string> = { info: 'ℹ️', warning: '⚠️', success: '✅', error: '❌' };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-white">Notifications</h2>
        {notifs.some(n => !n.read) && <button onClick={() => {
          if (!session?.id) return;
          if (isSupabaseAuthEnabled()) {
            void markAllNotificationsReadInSupabase(session.id).then(() => loadPortalData(session.id));
            return;
          }
          markAllNotifsRead(session.id);
          setNotifs(getNotifications(session.id));
        }} className="text-xs text-cyan-glow hover:underline">Mark all read</button>}
      </div>
      {notifs.map(n => (
        <div key={n.id} className={`rounded-xl p-4 border flex items-start gap-3 ${!n.read ? 'border-cyan-glow/20' : ''}`} style={{ background: !n.read ? '#262940' : bgCard, borderColor: n.read ? bd : undefined }}>
          <span className="text-lg mt-0.5">{icons[n.type]}</span>
          <div className="flex-1">
            <p className="text-[14px] font-medium text-white">{n.title}</p>
            <p className="text-[12px] mt-0.5" style={{ color: tSec }}>{n.message}</p>
            <p className="text-[10px] mt-1" style={{ color: tMut }}>{fmt(n.createdAt)}</p>
          </div>
          {!n.read && <span className="w-2 h-2 rounded-full bg-cyan-glow flex-shrink-0 mt-2" />}
        </div>
      ))}
      {notifs.length === 0 && <div className="rounded-xl p-10 text-center border" style={{ background: bgCard, borderColor: bd, color: tMut }}>No notifications yet.</div>}
    </div>
  );
}
