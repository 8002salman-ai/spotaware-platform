import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import {
  getLeads, getChatSessions, getProjectSubmissions, getDashboardStats,
  verifyAdminLogin, setAdminAuth, getAdminSession,
  getSettings, saveSettings,
  getAdminUsers, createLocalOwner, resetLocalOwner, addAdminUser, updateAdminUser,
  getClients, getOrders, getInvoices,
  type Lead, type ChatSession, type ProjectSubmission, type SiteSettings, type AdminUser,
  type ClientUser, type Order, type Invoice, type InvoiceItem,
  getFullDashboardStats, getActivities, type Activity,
  getTickets, type SupportTicket,
  checkOverdueInstallments, checkOverdueDeadlines,
  addNotification,
} from '../utils/storage';
import { hydrateSupabasePortalSession, isSupabaseAuthEnabled, isOAuthReturnInProgress, waitForSupabasePortalSession, supabaseSignIn, supabaseSignOut, supabaseSignInWithGoogle, supabaseSendPasswordReset } from '../utils/auth';
import {
  fetchAdminSnapshot,
  fetchActivityLogsInSupabase,
  createAdminUserInSupabase,
} from '../utils/supabaseData';
import { getSupabase } from '../utils/supabase';

import { type Tab } from './admin/types';
import { bg, bgCard, bgElevated, bgInput, border, borderLight, textSecondary, textMuted } from './admin/types';
import AdminDashboardTab from './admin/AdminDashboardTab';
import AdminLeadsTab from './admin/AdminLeadsTab';
import AdminSubmissionsTab from './admin/AdminSubmissionsTab';
import AdminChatsTab from './admin/AdminChatsTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminClientsTab from './admin/AdminClientsTab';
import AdminSupportTab from './admin/AdminSupportTab';
import AdminActivityTab from './admin/AdminActivityTab';


function buildSupabaseStats(snapshot: { leads: Lead[]; submissions: ProjectSubmission[]; chats: ChatSession[]; clients: ClientUser[]; orders: Order[]; invoices: Invoice[] }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const paidInvoices = snapshot.invoices.filter(i => i.status === 'paid');
  const pendingInvoices = snapshot.invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const convertedLeads = snapshot.leads.filter(l => l.status === 'converted').length;
  const conversionRate = snapshot.leads.length > 0 ? Math.round((convertedLeads / snapshot.leads.length) * 100) : 0;

  return {
    leads: { total: snapshot.leads.length, new: snapshot.leads.filter(l => l.status === 'new').length, today: snapshot.leads.filter(l => new Date(l.timestamp) >= today).length, week: snapshot.leads.filter(l => new Date(l.timestamp).getTime() >= (today.getTime() - (7 * 86400000))).length },
    submissions: { total: snapshot.submissions.length, new: snapshot.submissions.filter(s => s.status === 'new').length, today: snapshot.submissions.filter(s => new Date(s.timestamp) >= today).length },
    chats: { total: snapshot.chats.length, messages: snapshot.chats.reduce((a, c) => a + c.messages.length, 0) },
    clients: { total: snapshot.clients.length },
    orders: { total: snapshot.orders.length, active: snapshot.orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length, onHold: snapshot.orders.filter(o => o.onHold).length, completed: snapshot.orders.filter(o => o.status === 'completed').length },
    invoices: { total: snapshot.invoices.length, pending: pendingInvoices.length, overdue: snapshot.invoices.filter(i => i.status === 'overdue').length, pendingAmount: pendingInvoices.reduce((a, i) => a + i.total, 0) },
    revenue: { total: paidInvoices.reduce((a, i) => a + i.total, 0), month: paidInvoices.filter(i => new Date(i.paidAt || i.createdAt) >= monthAgo).reduce((a, i) => a + i.total, 0) },
    conversionRate,
  };
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [isAuth, setIsAuth] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localSetupMode, setLocalSetupMode] = useState(false);
  const [localResetMode, setLocalResetMode] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(() => isOAuthReturnInProgress());
  const [authHydrating, setAuthHydrating] = useState(() => isSupabaseAuthEnabled() && isOAuthReturnInProgress());
  const oauthLoadingRef = useRef(oauthLoading);
  const authHydratingRef = useRef(authHydrating);
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [submissions, setSubmissions] = useState<ProjectSubmission[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [, setStats] = useState(getDashboardStats());

  const [settings, setSettings] = useState<SiteSettings>(getSettings());
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');
  // User management
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'viewer'>('admin');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editPass, setEditPass] = useState('');
  // Clients & Invoices
  const [clients, setClients2] = useState<ClientUser[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [selClientId, setSelClientId] = useState<string | null>(null);
  const [selAdminOrder, setSelAdminOrder] = useState<Order | null>(null);
  const [adminUpdateMsg, setAdminUpdateMsg] = useState('');
  const [showInvForm, setShowInvForm] = useState(false);
  const [invItems, setInvItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, rate: 0, amount: 0, type: 'package' as const }]);
  const [invMeta, setInvMeta] = useState({ clientId: '', note: '', dueDate: '', packageName: '', autoTax: true });
  const [editInvId, setEditInvId] = useState<string | null>(null);
  const [dlItem, setDlItem] = useState('');
  const [dlDate, setDlDate] = useState('');
  const [holdMsg, setHoldMsg] = useState('');
  const [holdType, setHoldType] = useState<'payment_overdue' | 'client_delay' | 'admin_pause'>('payment_overdue');
  const [instCount, setInstCount] = useState(3);
  // Activity & enhanced stats
  const [activities, setActivities2] = useState<Activity[]>([]);
  const [fullStats, setFullStats] = useState(getFullDashboardStats());
  const [liveNotice, setLiveNotice] = useState('');
  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
  const [selTicketId, setSelTicketId] = useState<string | null>(null);
  const [adminTicketReply, setAdminTicketReply] = useState('');
  // New order for client
  const [showNewOrder, setShowNewOrder] = useState<string | null>(null); // clientId
  const [newOrd, setNewOrd] = useState({ service: '', pkg: '', price: 0, notes: '', installments: 1 });

  useEffect(() => {
    const initAuth = async () => {
      if (isSupabaseAuthEnabled()) {
        const oauthReturn = isOAuthReturnInProgress();
        setAuthHydrating(oauthReturn);
        setOauthLoading(oauthReturn);
        const session = await waitForSupabasePortalSession();
        if (session && ['owner', 'admin', 'viewer'].includes(session.role)) {
          setIsAuth(true);
          setCurrentUser({ id: session.id, email: session.email, role: session.role });
          setOauthLoading(false);
          setAuthHydrating(false);
        } else if (session) {
          await supabaseSignOut();
          setLoginError('Access denied: admin role required.');
          setOauthLoading(false);
          setAuthHydrating(false);
        } else {
          setOauthLoading(false);
          setAuthHydrating(false);
        }
        return;
      }

      const session = getAdminSession();
      if (session) {
        setIsAuth(true); setCurrentUser(session);
        // Auto-check overdue on login
        const held = checkOverdueInstallments();
        const deadlines = checkOverdueDeadlines();
        if (held > 0 || deadlines > 0) {
          addNotification('Auto-Check', `${held} orders held for overdue payments, ${deadlines} deadlines overdue`, 'warning');
        }
      }
      setAuthHydrating(false);
    };

    void initAuth();
  }, []);

  useEffect(() => {
    if (!isSupabaseAuthEnabled()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (event === 'SIGNED_OUT' && (oauthLoadingRef.current || authHydratingRef.current)) {
        return;
      }
      if (event === 'SIGNED_OUT') {
        setIsAuth(false);
        setCurrentUser(null);
        setOauthLoading(false);
        setAuthHydrating(false);
        return;
      }
      if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') return;

      setAuthHydrating(true);
      const hydration = authSession
        ? hydrateSupabasePortalSession(authSession)
        : waitForSupabasePortalSession();
      const session = await Promise.race([
        hydration,
        new Promise<null>((resolve) => window.setTimeout(() => {
          resolve(null);
        }, 9000)),
      ]);
      if (!session) {
        setLoginError('Signed in, but profile/session hydration timed out. Please refresh once or try again.');
        setOauthLoading(false);
        setAuthHydrating(false);
        return;
      }
      if (!['owner', 'admin', 'viewer'].includes(session.role)) {
        await supabaseSignOut();
        setLoginError('Access denied: admin role required.');
        setOauthLoading(false);
        setAuthHydrating(false);
        return;
      }
      setIsAuth(true);
      setCurrentUser({ id: session.id, email: session.email, role: session.role });
      setLoginError('');
      setOauthLoading(false);
      setAuthHydrating(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => { if (isAuth) void reload(); }, [isAuth, tab]);

  useEffect(() => {
    oauthLoadingRef.current = oauthLoading;
  }, [oauthLoading]);

  useEffect(() => {
    authHydratingRef.current = authHydrating;
  }, [authHydrating]);

  useEffect(() => {
    if (!isAuth || !isSupabaseAuthEnabled()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel('admin-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => { setLiveNotice('New lead activity detected'); void reload(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => { setLiveNotice('New project brief activity detected'); void reload(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => { setLiveNotice('Support ticket updated'); void reload(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { setLiveNotice('Order update received'); void reload(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => { setLiveNotice('Invoice update received'); void reload(); })
      .subscribe();

    const clearTimer = setInterval(() => setLiveNotice(''), 6000);
    return () => {
      clearInterval(clearTimer);
      void supabase.removeChannel(channel);
    };
  }, [isAuth]);

  const reload = async () => {
    if (isSupabaseAuthEnabled()) {
      const snap = await fetchAdminSnapshot();
      setLeads(snap.leads);
      setSubmissions(snap.submissions);
      setChats(snap.chats);
      setUsers(snap.adminUsers);
      setClients2(snap.clients);
      setAllOrders(snap.orders);
      setAllInvoices(snap.invoices);
      setAllTickets(snap.tickets);
      setStats(getDashboardStats());
      setSettings(getSettings());
      setActivities2(await fetchActivityLogsInSupabase());
      setFullStats(buildSupabaseStats(snap));
      return;
    }

    setLeads(getLeads()); setSubmissions(getProjectSubmissions()); setChats(getChatSessions());
    setStats(getDashboardStats()); setSettings(getSettings()); setUsers(getAdminUsers());
    setClients2(getClients()); setAllOrders(getOrders()); setAllInvoices(getInvoices());
    setActivities2(getActivities()); setFullStats(getFullDashboardStats());
    setAllTickets(getTickets());
  };

  const handleLogin = async () => {
    if (isSupabaseAuthEnabled()) {
      const { session, error } = await supabaseSignIn(loginEmail, loginPass);
      if (!session) {
        setLoginError(error || 'Invalid email or password');
        return;
      }
      if (!['owner', 'admin', 'viewer'].includes(session.role)) {
        setLoginError('This account is not allowed in Admin Panel.');
        return;
      }
      setIsAuth(true);
      setCurrentUser({ id: session.id, email: session.email, role: session.role });
      setLoginError('');
      return;
    }

    const user = verifyAdminLogin(loginEmail, loginPass);
    if (user) { setAdminAuth(user); setIsAuth(true); setCurrentUser({ id: user.id, email: user.email, role: user.role }); setLoginError(''); }
    else {
      const hasLocalAdmins = getAdminUsers().length > 0;
      setLoginError(hasLocalAdmins ? 'Invalid local email/password. You can reset the local owner below, or use Supabase login on live.' : 'No local admin exists yet. Create a local owner first or configure Supabase.');
      setLocalSetupMode(true);
      setLocalResetMode(hasLocalAdmins);
    }
  };

  const handleCreateLocalOwner = () => {
    if (!loginEmail.trim() || !loginPass.trim()) {
      setLoginError('Enter email and password to create the first local owner.');
      return;
    }
    if (isSupabaseAuthEnabled()) {
      setLoginError('Supabase is configured. Create admin users through Supabase instead.');
      return;
    }
    const owner = localResetMode
      ? resetLocalOwner(loginEmail.trim().toLowerCase(), loginPass)
      : createLocalOwner(loginEmail.trim().toLowerCase(), loginPass);
    if (!owner) {
      setLoginError('Local owner already exists. Login with that account.');
      return;
    }
    setAdminAuth(owner);
    setIsAuth(true);
    setCurrentUser({ id: owner.id, email: owner.email, role: owner.role });
    setLocalSetupMode(false);
    setLocalResetMode(false);
    setLoginError('');
  };

  const handleLogout = async () => {
    if (isSupabaseAuthEnabled()) {
      await supabaseSignOut();
    } else {
      setAdminAuth(null);
    }
    setIsAuth(false);
    setCurrentUser(null);
    onClose();
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    setOauthLoading(true);
    const { error } = await supabaseSignInWithGoogle('admin');
    if (error) {
      setOauthLoading(false);
      setLoginError(error);
      return;
    }
    window.setTimeout(() => {
      if (!isOAuthReturnInProgress()) {
        setOauthLoading(false);
        setLoginError('Google sign-in did not continue. Please click Continue with Google again.');
      }
    }, 5000);
  };

  const handleForgotPassword = async () => {
    if (!loginEmail.trim()) {
      setLoginError('Enter your email first to reset password.');
      return;
    }
    setResetState('sending');
    const { error } = await supabaseSendPasswordReset(loginEmail.trim(), 'admin');
    if (error) {
      setResetState('error');
      setLoginError(error);
      return;
    }
    setResetState('sent');
    setLoginError('');
  };

  const handleSaveSettings = () => { saveSettings(settings); setSaved(true); setTimeout(() => setSaved(false), 3000); };

  const handleTestEmail = async () => {
    if (!settings.email.serviceId || !settings.email.publicKey || !settings.email.templateIdLead) return;
    setTestEmail('sending');
    try {
      const ejs = await import('@emailjs/browser');
      await ejs.send(settings.email.serviceId, settings.email.templateIdLead, { to_email: settings.email.adminEmail, from_email: 'test@spotaware.dev', message: 'Test email — settings are working!', client_email: 'test@spotaware.dev' }, settings.email.publicKey);
      setTestEmail('ok');
    } catch { setTestEmail('fail'); }
    setTimeout(() => setTestEmail('idle'), 3000);
  };

  const handleAddUser = async () => {
    if (isSupabaseAuthEnabled()) {
      if (!newUserEmail || !newUserPass) return;
      const { error } = await createAdminUserInSupabase({
        email: newUserEmail,
        password: newUserPass,
        role: newUserRole,
      });
      if (error) {
        alert(error);
        return;
      }
      setNewUserEmail('');
      setNewUserPass('');
      await reload();
      return;
    }
    if (!newUserEmail || !newUserPass) return;
    const u = addAdminUser(newUserEmail, newUserPass, newUserRole);
    if (!u) { alert('User with this email already exists'); return; }
    setNewUserEmail(''); setNewUserPass(''); setUsers(getAdminUsers());
  };

  const handleUpdatePassword = (userId: string) => {
    if (isSupabaseAuthEnabled()) {
      alert('Password changes are managed via Supabase Auth.');
      return;
    }
    if (!editPass) return;
    updateAdminUser(userId, { password: editPass });
    setEditPass(''); setEditingUser(null); setUsers(getAdminUsers());
  };

  // ── LOGIN ──
  if (!isAuth && authHydrating) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(4,5,10,0.92)', backdropFilter: 'blur(12px)' }}>
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm rounded-2xl p-8 border text-center" style={{ background: bgCard, borderColor: border }}>
          <div className="w-12 h-12 rounded-full border-2 border-cyan-glow/40 border-t-cyan-glow animate-spin mx-auto mb-4" />
          <h2 className="font-display text-lg font-bold text-white">Preparing admin portal</h2>
          <p className="text-xs mt-2" style={{ color: textSecondary }}>Waiting for session and profile hydration...</p>
        </motion.div>
      </motion.div>
    );
  }

  if (!isAuth) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(4,5,10,0.92)', backdropFilter: 'blur(12px)' }}>
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm rounded-2xl p-8 border" style={{ background: bgCard, borderColor: border }}>
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-cyan-glow/10 border border-cyan-glow/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔐</span>
            </div>
            <h2 className="font-display text-xl font-bold text-white">Admin Login</h2>
            <p className="text-sm mt-1" style={{ color: textSecondary }}>SpotAware.dev Dashboard</p>
          </div>
          <div className="space-y-4">
            {oauthLoading && (
              <div className="rounded-xl border px-4 py-3 text-xs text-cyan-glow bg-cyan-glow/10 border-cyan-glow/20">
                Signing in with Google...
              </div>
            )}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Email</label>
              <input type="email" value={loginEmail} onChange={e => { setLoginEmail(e.target.value); setLoginError(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="ayaz@spotaware.dev" autoFocus
                className="w-full px-4 py-3 rounded-xl text-[14px] text-white focus:outline-none placeholder:text-[#4a4f6a] transition-colors"
                style={{ background: bgInput, border: `1px solid ${loginError ? '#ef4444' : border}` }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={loginPass} onChange={e => { setLoginPass(e.target.value); setLoginError(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-16 rounded-xl text-[14px] text-white focus:outline-none placeholder:text-[#4a4f6a] transition-colors"
                  style={{ background: bgInput, border: `1px solid ${loginError ? '#ef4444' : border}` }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs transition-colors hover:text-white" style={{ color: textSecondary }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
            <button disabled={oauthLoading} onClick={handleLogin} className="w-full py-3.5 rounded-xl bg-cyan-glow text-midnight font-display font-semibold text-sm hover:bg-cyan-soft transition-colors disabled:opacity-60">Login →</button>
            {!isSupabaseAuthEnabled() && localSetupMode && (
              <button disabled={oauthLoading} onClick={handleCreateLocalOwner} className="w-full py-3 rounded-xl border text-sm font-medium transition-colors hover:bg-white/5 text-cyan-glow disabled:opacity-60" style={{ borderColor: border }}>
                {localResetMode ? 'Reset Local Owner To This Login' : 'Create Local Owner Account'}
              </button>
            )}
            <button disabled={oauthLoading} onClick={handleGoogleLogin} className="w-full py-3.5 rounded-xl border text-sm font-medium transition-colors hover:bg-white/5 text-white flex items-center justify-center gap-2.5 disabled:opacity-60" style={{ borderColor: border }}>
              <svg className="w-4.5 h-4.5" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.657 29.193 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.053 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.053 6.053 29.27 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.193l-6.19-5.238C29.143 35.091 26.715 36 24 36c-5.173 0-9.628-3.327-11.286-7.946l-6.522 5.025C9.507 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.058 2.994-3.115 5.347-5.894 6.87l.003-.002 6.19 5.238C35.164 40.38 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              <span>Continue with Google</span>
            </button>
            {isSupabaseAuthEnabled() && (
              <button onClick={handleForgotPassword} disabled={resetState === 'sending'} className="w-full py-2 text-xs transition-colors hover:text-white disabled:opacity-50" style={{ color: textSecondary }}>
                {resetState === 'sending' ? 'Sending reset email...' : 'Forgot password?'}
              </button>
            )}
            {isSupabaseAuthEnabled() && resetState === 'sent' && (
              <p className="text-green-400 text-xs text-center">Reset password email sent. Please check your inbox.</p>
            )}
            <button onClick={onClose} className="w-full py-2 text-sm transition-colors hover:text-white" style={{ color: textSecondary }}>Cancel</button>
          </div>
          <div className="mt-4 p-3 rounded-xl border" style={{ background: bgElevated, borderColor: borderLight }}>
            <p className="text-[11px]" style={{ color: textMuted }}>
              Sign in with your authenticated Supabase admin account.
            </p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── DASHBOARD ──
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] overflow-hidden flex flex-col" style={{ background: bg }}>
      {/* Header */}
      <header className="px-4 md:px-6 py-4 flex items-center justify-between flex-shrink-0 border-b" style={{ background: bgCard, borderColor: borderLight }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-glow/10 border border-cyan-glow/20 flex items-center justify-center"><span className="text-cyan-glow text-sm font-bold">S</span></div>
          <div>
            <h1 className="font-display font-bold text-white text-lg">Admin Panel</h1>
            <p className="text-[11px]" style={{ color: textMuted }}>{currentUser?.email} • {currentUser?.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} className="px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:text-white" style={{ color: textSecondary }}>↻ Refresh</button>
          <button onClick={handleLogout} className="px-4 py-2 rounded-lg text-xs font-medium bg-cyan-glow text-midnight hover:bg-cyan-soft transition-colors">Logout</button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: textSecondary }}>✕</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 md:px-6 flex gap-1 overflow-x-auto flex-shrink-0 border-b" style={{ background: bgCard, borderColor: borderLight }}>
        {([
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'leads', label: `Leads (${leads.length})`, icon: '👥' },
          { id: 'submissions', label: `Briefs (${submissions.length})`, icon: '📝' },
          { id: 'chats', label: `Chats (${chats.length})`, icon: '💬' },
          { id: 'settings', label: 'Settings', icon: '⚙️' },
          { id: 'users', label: 'Users', icon: '🔑' },
          { id: 'clients', label: `Clients (${clients.length})`, icon: '🏢' },
          { id: 'support', label: `Support${allTickets.filter(t=>t.status!=='closed'&&t.status!=='resolved').length > 0 ? ` (${allTickets.filter(t=>t.status!=='closed'&&t.status!=='resolved').length})` : ''}`, icon: '🎧' },
          { id: 'activity', label: 'Activity', icon: '📋' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-3 text-[13px] font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-cyan-glow text-white' : 'border-transparent hover:text-white'}`} style={tab !== t.id ? { color: textSecondary } : undefined}>
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {liveNotice && (
          <div className="mb-4 rounded-xl border px-4 py-2 text-[12px] bg-cyan-glow/10 text-cyan-glow border-cyan-glow/20">
            {liveNotice}
          </div>
        )}
        {tab === 'dashboard' && (
          <AdminDashboardTab
            fullStats={fullStats}
            leads={leads}
            activities={activities}
            settings={settings}
            currentUser={currentUser}
            setTab={setTab}
            reload={reload}
          />
        )}
        {tab === 'leads' && (
          <AdminLeadsTab
            leads={leads}
            chats={chats}
            submissions={submissions}
            clients={clients}
            reload={reload}
          />
        )}
        {tab === 'submissions' && (
          <AdminSubmissionsTab
            submissions={submissions}
            leads={leads}
            clients={clients}
            setTab={() => setTab('leads')}
            reload={reload}
          />
        )}
        {tab === 'chats' && (
          <AdminChatsTab
            chats={chats}
            leads={leads}
            setTab={() => setTab('leads')}
            reload={reload}
          />
        )}
        {tab === 'settings' && (
          <AdminSettingsTab
            settings={settings}
            setSettings={setSettings}
            saved={saved}
            testEmail={testEmail}
            handleSaveSettings={handleSaveSettings}
            handleTestEmail={handleTestEmail}
          />
        )}
        {tab === 'users' && (
          <AdminUsersTab
            users={users}
            setUsers={setUsers}
            newUserEmail={newUserEmail}
            setNewUserEmail={setNewUserEmail}
            newUserPass={newUserPass}
            setNewUserPass={setNewUserPass}
            newUserRole={newUserRole}
            setNewUserRole={setNewUserRole}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            editPass={editPass}
            setEditPass={setEditPass}
            handleAddUser={handleAddUser}
            handleUpdatePassword={handleUpdatePassword}
          />
        )}
        {tab === 'clients' && (
          <AdminClientsTab
            clients={clients}
            allOrders={allOrders}
            allInvoices={allInvoices}
            selClientId={selClientId}
            setSelClientId={setSelClientId}
            selAdminOrder={selAdminOrder}
            setSelAdminOrder={setSelAdminOrder}
            adminUpdateMsg={adminUpdateMsg}
            setAdminUpdateMsg={setAdminUpdateMsg}
            showInvForm={showInvForm}
            setShowInvForm={setShowInvForm}
            invItems={invItems}
            setInvItems={setInvItems}
            invMeta={invMeta}
            setInvMeta={setInvMeta}
            editInvId={editInvId}
            setEditInvId={setEditInvId}
            dlItem={dlItem}
            setDlItem={setDlItem}
            dlDate={dlDate}
            setDlDate={setDlDate}
            holdMsg={holdMsg}
            setHoldMsg={setHoldMsg}
            holdType={holdType}
            setHoldType={setHoldType}
            instCount={instCount}
            setInstCount={setInstCount}
            showNewOrder={showNewOrder}
            setShowNewOrder={setShowNewOrder}
            newOrd={newOrd}
            setNewOrd={setNewOrd}
            settings={settings}
            reload={reload}
          />
        )}
        {tab === 'support' && (
          <AdminSupportTab
            allTickets={allTickets}
            clients={clients}
            selTicketId={selTicketId}
            setSelTicketId={setSelTicketId}
            adminTicketReply={adminTicketReply}
            setAdminTicketReply={setAdminTicketReply}
            currentUser={currentUser}
            reload={reload}
          />
        )}
        {tab === 'activity' && (
          <AdminActivityTab activities={activities} />
        )}

      </div>
    </motion.div>
  );
}
