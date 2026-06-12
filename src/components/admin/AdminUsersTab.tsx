import { motion } from 'framer-motion';
import { type AdminUser, getAdminUsers, updateAdminUser, deleteAdminUser } from '../../utils/storage';
import { isSupabaseAuthEnabled } from '../../utils/auth';
import { bgCard, bgElevated, bgInput, border, borderLight, textSecondary, textMuted } from './types';

interface Props {
  users: AdminUser[];
  setUsers: (users: AdminUser[]) => void;
  newUserEmail: string;
  setNewUserEmail: (v: string) => void;
  newUserPass: string;
  setNewUserPass: (v: string) => void;
  newUserRole: 'admin' | 'viewer';
  setNewUserRole: (v: 'admin' | 'viewer') => void;
  editingUser: string | null;
  setEditingUser: (v: string | null) => void;
  editPass: string;
  setEditPass: (v: string) => void;
  handleAddUser: () => void;
  handleUpdatePassword: (userId: string) => void;
}

export default function AdminUsersTab({
  users, setUsers,
  newUserEmail, setNewUserEmail,
  newUserPass, setNewUserPass,
  newUserRole, setNewUserRole,
  editingUser, setEditingUser,
  editPass, setEditPass,
  handleAddUser, handleUpdatePassword,
}: Props) {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: borderLight }}><h3 className="font-semibold text-white">Admin Users</h3><p className="text-xs mt-1" style={{ color: textMuted }}>Manage who can access this panel</p></div>
        <div className="divide-y" style={{ borderColor: borderLight }}>
          {users.map(u => (
            <div key={u.id} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border" style={{ background: bgElevated, borderColor: border, color: textSecondary }}>{u.email[0].toUpperCase()}</div>
                  <div>
                    <p className="text-[14px] font-medium text-white">{u.email}</p>
                    <p className="text-xs" style={{ color: textMuted }}>{u.role === 'owner' ? '👑 Owner' : u.role === 'admin' ? '🛡 Admin' : '👁 Viewer'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (isSupabaseAuthEnabled()) return; setEditingUser(editingUser === u.id ? null : u.id); setEditPass(''); }} disabled={isSupabaseAuthEnabled()} className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:text-white disabled:opacity-40 disabled:cursor-not-allowed" style={{ borderColor: border, color: textSecondary }}>
                    {editingUser === u.id ? 'Cancel' : 'Edit'}
                  </button>
                  {u.role !== 'owner' && !isSupabaseAuthEnabled() && (
                    <button onClick={() => { if (confirm(`Delete ${u.email}?`)) { deleteAdminUser(u.id); setUsers(getAdminUsers()); } }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10">Delete</button>
                  )}
                </div>
              </div>
              {editingUser === u.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 pt-4 border-t overflow-hidden" style={{ borderColor: borderLight }}>
                  <div className="flex gap-2">
                    <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="New password" className="flex-1 px-3 py-2 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} />
                    <button onClick={() => handleUpdatePassword(u.id)} disabled={!editPass} className="px-4 py-2 rounded-lg text-xs font-medium bg-cyan-glow text-midnight disabled:opacity-40">Update</button>
                  </div>
                  {u.role !== 'owner' && (
                    <div className="mt-3">
                      <label className="text-xs mb-1 block" style={{ color: textSecondary }}>Role</label>
                      <select value={u.role} onChange={e => { updateAdminUser(u.id, { role: e.target.value as 'admin' | 'viewer' }); setUsers(getAdminUsers()); }} className="px-3 py-2 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }}>
                        <option value="admin">Admin</option><option value="viewer">Viewer</option>
                      </select>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Add User */}
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: borderLight }}><h3 className="font-semibold text-white">Add New User</h3></div>
        <div className="p-5 space-y-4">
          {isSupabaseAuthEnabled() && (
            <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: borderLight, color: textMuted, background: bgElevated }}>
              Creates a real Supabase Auth user. Requires <code className="text-cyan-glow">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel env vars.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Email</label><input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="user@email.com" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
            <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Password</label><input type="password" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} placeholder="••••••" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
          </div>
          <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Role</label>
            <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as 'admin' | 'viewer')} className="px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }}>
              <option value="admin">🛡 Admin — Full access</option><option value="viewer">👁 Viewer — Read only</option>
            </select></div>
          <button onClick={handleAddUser} disabled={!newUserEmail || !newUserPass} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-cyan-glow text-midnight hover:bg-cyan-soft disabled:opacity-40 transition-colors">Add User</button>
        </div>
      </div>
    </div>
  );
}
