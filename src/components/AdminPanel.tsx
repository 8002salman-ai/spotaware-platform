import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import {
  getLeads, getChatSessions, getProjectSubmissions, getDashboardStats,
  updateLeadStatus, updateSubmissionStatus, deleteLead, deleteSubmission, deleteChatSession,
  verifyAdminLogin, setAdminAuth, getAdminSession,
  clearAllData, exportAllData, getSettings, saveSettings,
  getAdminUsers, createLocalOwner, resetLocalOwner, addAdminUser, updateAdminUser, deleteAdminUser,
  getClients, getOrders, getInvoices, updateOrder, addOrderUpdate, createInvoice, updateInvoiceStatus, deleteInvoice, updateInvoice, calcTax, TX_TAX_RATE,
  holdOrder, resumeOrder, markInstallmentPaid, addClientDeadline, markDeadlineReceived, markDeadlineOverdue,
  type Lead, type ChatSession, type ProjectSubmission, type SiteSettings, type AdminUser,
  type ClientUser, type Order, type Invoice, type InvoiceItem,
  getFullDashboardStats, getActivities, logActivity, type Activity,
  getTickets, updateTicketStatus, addTicketMessage, type SupportTicket,
  addNotification, convertLeadToClient, adminCreateOrder, checkOverdueInstallments, checkOverdueDeadlines,
} from '../utils/storage';
import { getAuthDebugEntries, hydrateSupabasePortalSession, isSupabaseAuthEnabled, isOAuthReturnInProgress, logAuthDebug, subscribeAuthDebug, waitForSupabasePortalSession, supabaseSignIn, supabaseSignOut, supabaseSignInWithGoogle, supabaseSendPasswordReset } from '../utils/auth';
import {
  fetchAdminSnapshot,
  updateLeadStatusInSupabase,
  updateSubmissionStatusInSupabase,
  addSupportMessageInSupabase,
  updateSupportTicketStatusInSupabase,
  deleteLeadInSupabase,
  deleteSubmissionInSupabase,
  deleteChatSessionInSupabase,
  fetchActivityLogsInSupabase,
  createActivityLogInSupabase,
  createAdminUserInSupabase,
  createAdminOrderInSupabase,
  updateOrderInSupabase,
  setupOrderInstallmentsInSupabase,
  markInstallmentPaidInSupabase,
} from '../utils/supabaseData';
import { getSupabase } from '../utils/supabase';
import { downloadInvoice, emailInvoiceToClient } from '../utils/invoice';

type Tab = 'dashboard' | 'leads' | 'submissions' | 'chats' | 'settings' | 'users' | 'clients' | 'activity' | 'support';

const MODELS = [
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 (Free)', free: true },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)', free: true },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)', free: true },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', free: true },
  { id: 'openrouter/auto', name: 'Auto (Best)', free: false },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', free: false },
  { id: 'openai/gpt-4o', name: 'GPT-4o', free: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', free: false },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', free: false },
];

// Colors
const bg = 'var(--t-bg,#0f1923)'; const bgCard = 'var(--t-card,#152230)'; const bgElevated = 'var(--t-el,#1a2d3d)'; const bgInput = 'var(--t-in,#1f3344)';
const border = 'var(--t-bd,#264055)'; const borderLight = 'var(--t-bdl,#1e3548)'; const textSecondary = 'var(--t-sec,#8ab4d0)'; const textMuted = 'var(--t-mut,#4d7a96)';

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
  const [authDebug, setAuthDebug] = useState<string[]>(() => getAuthDebugEntries());
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
  const [selChat, setSelChat] = useState<ChatSession | null>(null);
  const [selSub, setSelSub] = useState<ProjectSubmission | null>(null);
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
          logAuthDebug('Redirecting to portal');
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
    const unsubscribeDebug = subscribeAuthDebug(setAuthDebug);
    const supabase = getSupabase();
    if (!supabase) return () => unsubscribeDebug();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      setAuthDebug((prev) => [...prev, `${new Date().toLocaleTimeString('en-US', { hour12: false })} Auth listener fired: ${event}`].slice(-60));
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

      logAuthDebug(`Hydration event accepted: ${event}`);
      setAuthHydrating(true);
      const hydration = authSession
        ? hydrateSupabasePortalSession(authSession)
        : waitForSupabasePortalSession();
      const session = await Promise.race([
        hydration,
        new Promise<null>((resolve) => window.setTimeout(() => {
          logAuthDebug('Hydration timed out');
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
      logAuthDebug('Redirecting to portal');
      setLoginError('');
      setOauthLoading(false);
      setAuthHydrating(false);
    });

    return () => {
      unsubscribeDebug();
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

  const fmt = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const statusColor = (s: string) => {
    const m: Record<string, string> = { new: 'bg-cyan-glow/15 text-cyan-400 border-cyan-glow/30', contacted: 'bg-amber-500/15 text-amber-400 border-amber-500/30', reviewed: 'bg-blue-500/15 text-blue-400 border-blue-500/30', proposal_sent: 'bg-violet-500/15 text-violet-400 border-violet-500/30', converted: 'bg-green-500/15 text-green-400 border-green-500/30' };
    return m[s] || 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  };

  // ── LOGIN ──
  if (!isAuth && authHydrating) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(4,5,10,0.92)', backdropFilter: 'blur(12px)' }}>
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm rounded-2xl p-8 border text-center" style={{ background: bgCard, borderColor: border }}>
          <div className="w-12 h-12 rounded-full border-2 border-cyan-glow/40 border-t-cyan-glow animate-spin mx-auto mb-4" />
          <h2 className="font-display text-lg font-bold text-white">Preparing admin portal</h2>
          <p className="text-xs mt-2" style={{ color: textSecondary }}>Waiting for session and profile hydration...</p>
          {isSupabaseAuthEnabled() && authDebug.length > 0 && (
            <div className="mt-4 p-3 rounded-xl border text-left" style={{ background: bgElevated, borderColor: borderLight }}>
              <p className="text-[11px] font-semibold mb-1" style={{ color: textSecondary }}>OAuth debug timeline (temporary)</p>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {authDebug.slice(-8).map((entry, idx) => (
                  <p key={`${entry}-${idx}`} className="text-[10px]" style={{ color: textMuted }}>{entry}</p>
                ))}
              </div>
            </div>
          )}
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
          {isSupabaseAuthEnabled() && authDebug.length > 0 && (
            <div className="mt-4 p-3 rounded-xl border" style={{ background: bgElevated, borderColor: borderLight }}>
              <p className="text-[11px] font-semibold mb-1" style={{ color: textSecondary }}>OAuth debug timeline (temporary)</p>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {authDebug.slice(-8).map((entry, idx) => (
                  <p key={`${entry}-${idx}`} className="text-[10px]" style={{ color: textMuted }}>{entry}</p>
                ))}
              </div>
            </div>
          )}
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

        {/* ── Dashboard — Command Center ── */}
        {tab === 'dashboard' && (
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
        )}

        {/* ── Leads ── */}
        {tab === 'leads' && (
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
        )}

        {/* ── Submissions ── */}
        {tab === 'submissions' && (
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
        )}

        {/* ── Chats ── */}
        {tab === 'chats' && (
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
        )}

        {/* ── Settings ── */}
        {tab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            {/* Email */}
            <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
              <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: borderLight }}>
                <div className="flex items-center gap-3"><span className="text-xl">📧</span><div><h3 className="font-semibold text-white">Email Settings</h3><p className="text-xs" style={{ color: textMuted }}>EmailJS configuration</p></div></div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.email.enabled} onChange={e => setSettings({ ...settings, email: { ...settings.email, enabled: e.target.checked } })} className="w-4 h-4 rounded" /><span className="text-xs text-white">On</span></label>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-xl p-4 border" style={{ background: bgElevated, borderColor: borderLight }}>
                  <p className="text-xs font-semibold text-white mb-2">📘 Setup:</p>
                  <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: textSecondary }}>
                    <li>Go to <a href="https://emailjs.com" target="_blank" rel="noopener noreferrer" className="text-cyan-glow underline">emailjs.com</a></li><li>Add Gmail service → copy Service ID</li><li>Create templates → copy Template IDs</li><li>Account → copy Public Key</li><li>Paste below and save</li>
                  </ol>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[{ l: 'Service ID', v: settings.email.serviceId, k: 'serviceId', ph: 'service_xxx' }, { l: 'Public Key', v: settings.email.publicKey, k: 'publicKey', ph: 'xxx' }].map(f => (
                    <div key={f.k}><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>{f.l}</label>
                      <input value={f.v} onChange={e => setSettings({ ...settings, email: { ...settings.email, [f.k]: e.target.value } })} placeholder={f.ph} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[{ l: 'Template ID (Lead)', v: settings.email.templateIdLead, k: 'templateIdLead' }, { l: 'Template ID (Brief)', v: settings.email.templateIdBrief, k: 'templateIdBrief' }].map(f => (
                    <div key={f.k}><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>{f.l}</label>
                      <input value={f.v} onChange={e => setSettings({ ...settings, email: { ...settings.email, [f.k]: e.target.value } })} placeholder="template_xxx" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
                  ))}
                </div>
                <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Admin Email</label>
                  <input value={settings.email.adminEmail} onChange={e => setSettings({ ...settings, email: { ...settings.email, adminEmail: e.target.value } })} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
                <button onClick={handleTestEmail} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${testEmail === 'ok' ? 'bg-green-500/20 text-green-400' : testEmail === 'fail' ? 'bg-red-500/20 text-red-400' : 'border text-white hover:bg-white/5'}`} style={testEmail === 'idle' ? { borderColor: border } : undefined}>
                  {testEmail === 'sending' ? 'Sending...' : testEmail === 'ok' ? '✓ Sent!' : testEmail === 'fail' ? '✕ Failed' : '📤 Test Email'}
                </button>
              </div>
            </div>
            {/* AI */}
            <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
              <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: borderLight }}>
                <div className="flex items-center gap-3"><span className="text-xl">🤖</span><div><h3 className="font-semibold text-white">AI Chat Settings</h3><p className="text-xs" style={{ color: textMuted }}>OpenRouter API</p></div></div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.api.useCustomKey} onChange={e => setSettings({ ...settings, api: { ...settings.api, useCustomKey: e.target.checked } })} className="w-4 h-4 rounded" /><span className="text-xs text-white">Custom Key</span></label>
              </div>
              <div className="p-5 space-y-4">
                <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>AI Model</label>
                  <select value={settings.api.openrouterModel} onChange={e => setSettings({ ...settings, api: { ...settings.api, openrouterModel: e.target.value } })} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }}>
                    <optgroup label="🆓 Free">{MODELS.filter(m => m.free).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
                    <optgroup label="💳 Paid">{MODELS.filter(m => !m.free).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
                  </select></div>
                {settings.api.useCustomKey && (
                  <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>API Key</label>
                    <input type="password" value={settings.api.openrouterApiKey} onChange={e => setSettings({ ...settings, api: { ...settings.api, openrouterApiKey: e.target.value } })} placeholder="sk-or-v1-xxx" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white font-mono focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
                )}
                <div className="rounded-xl p-3 border" style={{ background: bgElevated, borderColor: borderLight }}>
                  <p className="text-[11px]" style={{ color: textMuted }}>
                    <strong className="text-white">SpotBot API status:</strong>{' '}
                    {settings.api.useCustomKey
                      ? (settings.api.openrouterApiKey.trim() ? '🟢 Custom key configured' : '🔴 Custom key enabled but empty')
                      : '🟡 No custom key (chat uses best-effort routing + local fallback)'}
                  </p>
                </div>
              </div>
            </div>
            {/* WhatsApp */}
            <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
              <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: borderLight }}>
                <div className="flex items-center gap-3"><span className="text-xl">📱</span><div><h3 className="font-semibold text-white">WhatsApp</h3><p className="text-xs" style={{ color: textMuted }}>Contact settings</p></div></div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.whatsapp.enabled} onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, enabled: e.target.checked } })} className="w-4 h-4 rounded" /><span className="text-xs text-white">On</span></label>
              </div>
              <div className="p-5 space-y-4">
                <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Phone Number</label>
                  <input value={settings.whatsapp.phoneNumber} onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, phoneNumber: e.target.value } })} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
                <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Welcome Message</label>
                  <textarea value={settings.whatsapp.welcomeMessage} onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, welcomeMessage: e.target.value } })} rows={2} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none resize-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
              </div>
            </div>
            {/* Backend / Infrastructure */}
            <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
              <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: borderLight }}>
                <div className="flex items-center gap-3"><span className="text-xl">🏗</span><div><h3 className="font-semibold text-white">Backend & Infrastructure</h3><p className="text-xs" style={{ color: textMuted }}>Supabase, Stripe, Deployment</p></div></div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.backend.useSupabase} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, useSupabase: e.target.checked } })} className="w-4 h-4 rounded" /><span className="text-xs text-white">Use Supabase</span></label>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-xl p-4 border" style={{ background: bgElevated, borderColor: borderLight }}>
                  <p className="text-xs font-semibold text-white mb-2">📘 Production Setup Checklist:</p>
                  <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: textSecondary }}>
                    <li>Create project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-cyan-glow underline">supabase.com</a> → Copy URL & Anon Key</li>
                    <li>Run <code className="text-cyan-glow/70 bg-cyan-glow/5 px-1 rounded">supabase-schema.sql</code> in SQL Editor</li>
                    <li>Create <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-cyan-glow underline">Stripe</a> account → Copy Publishable Key</li>
                    <li>Deploy to <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-cyan-glow underline">Vercel</a> via GitHub</li>
                    <li>Set env vars: <code className="text-cyan-glow/70 bg-cyan-glow/5 px-1 rounded">VITE_SUPABASE_URL</code>, <code className="text-cyan-glow/70 bg-cyan-glow/5 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>, <code className="text-cyan-glow/70 bg-cyan-glow/5 px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code></li>
                  </ol>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Supabase Project URL</label>
                    <input value={settings.backend.supabaseUrl} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, supabaseUrl: e.target.value } })} placeholder="https://xxxxx.supabase.co" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white font-mono focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
                  <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Supabase Anon Key</label>
                    <input type="password" value={settings.backend.supabaseAnonKey} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, supabaseAnonKey: e.target.value } })} placeholder="eyJhbGciOi..." className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white font-mono focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Stripe Publishable Key</label>
                    <input value={settings.backend.stripePublishableKey} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, stripePublishableKey: e.target.value } })} placeholder="pk_test_xxx" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white font-mono focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
                  <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Stripe Mode</label>
                    <select value={settings.backend.stripeMode} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, stripeMode: e.target.value as 'test' | 'live' } })} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }}>
                      <option value="test">🧪 Test Mode</option><option value="live">🟢 Live Mode</option>
                    </select></div>
                </div>
                <div className="rounded-xl p-3 border" style={{ background: bgElevated, borderColor: borderLight }}>
                  <p className="text-[11px]" style={{ color: textMuted }}>
                    <strong className="text-white">Current Mode:</strong> {settings.backend.useSupabase && settings.backend.supabaseUrl ? '🟢 Supabase (Production)' : '🟡 localStorage (Demo)'}<br/>
                    {settings.backend.stripePublishableKey ? `💳 Stripe: ${settings.backend.stripeMode === 'live' ? '🟢 Live' : '🧪 Test'}` : '💳 Stripe: Not configured'}
                  </p>
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: bgCard, borderColor: border }}>
              <p className="text-xs" style={{ color: saved ? '#34d399' : textMuted }}>{saved ? '✓ Saved!' : 'Save your changes'}</p>
              <button onClick={handleSaveSettings} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-cyan-glow text-midnight hover:bg-cyan-soft transition-colors">Save Settings</button>
            </div>
          </div>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
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
        )}
        {/* ── Clients Tab ── */}
        {tab === 'clients' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clients.map(c => {
                const co = allOrders.filter(o => o.clientId === c.id);
                const ci = allInvoices.filter(i => i.clientId === c.id);
                return (
                  <div key={c.id} className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: selClientId === c.id ? 'rgba(0,229,255,0.4)' : border }}>
                    <div className="p-4 cursor-pointer" onClick={() => setSelClientId(selClientId === c.id ? null : c.id)}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border" style={{ background: bgElevated, borderColor: border, color: textSecondary }}>{c.name[0]}</div>
                        <div><p className="text-[14px] font-medium text-white">{c.name}</p><p className="text-xs" style={{ color: textMuted }}>{c.email}{c.company ? ` • ${c.company}` : ''}</p></div>
                      </div>
                      <div className="flex gap-3 text-xs" style={{ color: textSecondary }}><span>📦 {co.length} orders</span><span>📄 {ci.length} invoices</span><span>${ci.filter(i => i.status === 'paid').reduce((a, i) => a + i.total, 0).toLocaleString()} paid</span></div>
                    </div>
                    {selClientId === c.id && (
                      <div className="border-t p-4 space-y-3" style={{ borderColor: borderLight, background: bgElevated }}>
                        <p className="text-xs font-semibold text-white">Orders</p>
                        {co.map(o => (
                          <div key={o.id} className={`p-3 rounded-lg border ${o.onHold ? 'border-red-500/30 bg-red-500/5' : ''}`} style={!o.onHold ? { borderColor: borderLight, background: bgCard } : undefined}>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[13px] text-white font-medium">{o.service} — ${o.price}</p>
                              <select value={o.status} onChange={e => { if (isSupabaseAuthEnabled()) { void updateOrderInSupabase(o.id, { status: e.target.value as Order['status'] }).then(() => reload()); } else { updateOrder(o.id, { status: e.target.value as Order['status'] }); void reload(); } }} className="text-[10px] rounded px-1 py-0.5 border" style={{ background: 'transparent', borderColor: borderLight, color: textSecondary }}>
                                {['pending','in_progress','review','revision','completed','cancelled','on_hold'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            {/* Hold Banner */}
                            {o.onHold && (
                              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 mb-2">
                                <p className="text-[11px] text-red-400 font-medium">⚠️ ON HOLD — {o.holdReason === 'payment_overdue' ? 'Payment Overdue' : o.holdReason === 'client_delay' ? 'Client Delay' : 'Paused'}</p>
                                {o.holdMessage && <p className="text-[10px] text-red-400/70 mt-0.5">{o.holdMessage}</p>}
                                <button onClick={() => { resumeOrder(o.id); reload(); }} className="mt-1.5 px-3 py-1 rounded text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/20">▶ Resume Project</button>
                              </div>
                            )}
                            {/* Progress */}
                            <div className="flex items-center gap-2 mb-2"><span className="text-xs" style={{ color: textMuted }}>Progress:</span><input type="range" min="0" max="100" value={o.progress} onChange={e => { const progress = parseInt(e.target.value); if (isSupabaseAuthEnabled()) { void updateOrderInSupabase(o.id, { progress }).then(() => reload()); } else { updateOrder(o.id, { progress }); void reload(); } }} className="flex-1 h-1" /><span className="text-xs text-cyan-glow">{o.progress}%</span></div>
                            {/* Payment Plan */}
                            <div className="p-2 rounded-lg mb-2 border" style={{ borderColor: borderLight, background: bgElevated }}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-medium text-white">💰 Payment: ${o.totalPaid || 0} / ${o.price}</span>
                                <span className="text-[10px]" style={{ color: textMuted }}>{o.paymentPlan === 'installment' ? `${o.installments.length} installments` : 'Full payment'}</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: borderLight }}><div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${o.price > 0 ? (o.totalPaid || 0) / o.price * 100 : 0}%` }} /></div>
                              {/* Installments */}
                              {o.installments.length > 0 && o.installments.map(inst => (
                                <div key={inst.id} className="flex items-center justify-between py-1 border-t" style={{ borderColor: borderLight }}>
                                  <span className="text-[10px]" style={{ color: textSecondary }}>{inst.label} — ${inst.amount} — Due: {inst.dueDate}</span>
                                  {inst.status === 'paid' ? <span className="text-[9px] text-green-400">✓ Paid</span> : (
                                    <button onClick={() => { if (isSupabaseAuthEnabled()) { void markInstallmentPaidInSupabase(o.id, inst.id).then(() => reload()); } else { markInstallmentPaid(o.id, inst.id); void reload(); } }} className="text-[9px] text-cyan-glow hover:underline">Mark Paid</button>
                                  )}
                                </div>
                              ))}
                              {/* Setup installments */}
                              {o.paymentPlan === 'full' && o.status !== 'completed' && (
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: borderLight }}>
                                  <select value={instCount} onChange={e => setInstCount(+e.target.value)} className="px-1 py-0.5 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }}>
                                    {[2,3,4,5,6].map(n => <option key={n} value={n}>{n} parts</option>)}
                                  </select>
                                  <button onClick={() => {
                                    const amt = Math.round(o.price / instCount * 100) / 100;
                                    const insts = Array.from({ length: instCount }, (_, i) => ({
                                      id: `inst_${Date.now()}_${i}`, amount: i === instCount - 1 ? o.price - amt * (instCount - 1) : amt,
                                      dueDate: new Date(Date.now() + (i + 1) * 15 * 86400000).toISOString().split('T')[0],
                                      status: 'pending' as const, label: `Installment ${i + 1} of ${instCount}`,
                                    }));
                                    if (isSupabaseAuthEnabled()) {
                                      void setupOrderInstallmentsInSupabase(o.id, o.price, instCount).then(() => reload());
                                    } else {
                                      updateOrder(o.id, { paymentPlan: 'installment', installments: insts }); void reload();
                                    }
                                  }} className="text-[10px] text-cyan-glow hover:underline">Setup Flex Payment</button>
                                </div>
                              )}
                            </div>
                            {/* Hold controls */}
                            {!o.onHold && o.status !== 'completed' && (
                              <div className="flex gap-1.5 mb-2">
                                <select value={holdType} onChange={e => setHoldType(e.target.value as typeof holdType)} className="px-1 py-0.5 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }}>
                                  <option value="payment_overdue">Payment Overdue</option><option value="client_delay">Client Delay</option><option value="admin_pause">Admin Pause</option>
                                </select>
                                <input value={holdMsg} onChange={e => setHoldMsg(e.target.value)} placeholder="Reason..." className="flex-1 px-2 py-0.5 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                                <button onClick={() => { holdOrder(o.id, holdType, holdMsg || 'Work paused'); setHoldMsg(''); reload(); }} className="px-2 py-0.5 rounded text-[10px] text-red-400 border border-red-500/20">⏸ Hold</button>
                              </div>
                            )}
                            {/* Client Deadlines */}
                            {(o.clientDeadlines || []).length > 0 && (
                              <div className="p-2 rounded-lg mb-2 border" style={{ borderColor: borderLight, background: bgElevated }}>
                                <span className="text-[10px] font-medium text-white">📋 Waiting from client:</span>
                                {o.clientDeadlines.map(dl => (
                                  <div key={dl.id} className="flex items-center justify-between py-1 border-t" style={{ borderColor: borderLight }}>
                                    <span className={`text-[10px] ${dl.status === 'overdue' ? 'text-red-400' : dl.status === 'received' ? 'text-green-400' : ''}`} style={dl.status === 'pending' ? { color: textSecondary } : undefined}>{dl.item} — {dl.dueDate}</span>
                                    <div className="flex gap-1">
                                      {dl.status === 'pending' && <><button onClick={() => { markDeadlineReceived(o.id, dl.id); reload(); }} className="text-[9px] text-green-400">✓ Got</button><button onClick={() => { markDeadlineOverdue(o.id, dl.id); reload(); }} className="text-[9px] text-red-400">⚠ Late</button></>}
                                      {dl.status === 'received' && <span className="text-[9px] text-green-400">✓</span>}
                                      {dl.status === 'overdue' && <span className="text-[9px] text-red-400">⏸ Holding</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Add deadline */}
                            <div className="flex gap-1.5 mb-2">
                              <input value={dlItem} onChange={e => setDlItem(e.target.value)} placeholder="Request item from client..." className="flex-1 px-2 py-1 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                              <input type="date" value={dlDate} onChange={e => setDlDate(e.target.value)} className="px-1 py-1 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                              <button onClick={() => { if (dlItem && dlDate) { addClientDeadline(o.id, dlItem, dlDate); setDlItem(''); setDlDate(''); reload(); } }} className="px-2 py-1 rounded text-[10px] bg-cyan-glow/20 text-cyan-glow">+</button>
                            </div>
                            {/* Message */}
                            <div className="flex gap-2">
                              <input value={selAdminOrder?.id === o.id ? adminUpdateMsg : ''} onFocus={() => setSelAdminOrder(o)} onChange={e => setAdminUpdateMsg(e.target.value)} placeholder="Send update..." className="flex-1 px-2 py-1 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                              <button onClick={() => { if (adminUpdateMsg.trim()) { addOrderUpdate(o.id, adminUpdateMsg, 'admin'); setAdminUpdateMsg(''); reload(); } }} className="px-2 py-1 rounded text-xs bg-cyan-glow text-midnight">Send</button>
                            </div>
                          </div>
                        ))}
                        {co.length === 0 && <p className="text-xs" style={{ color: textMuted }}>No orders</p>}

                        {/* Create Order for Client */}
                        {showNewOrder === c.id ? (
                          <div className="p-3 rounded-xl border space-y-2" style={{ borderColor: borderLight, background: bgCard }}>
                            <p className="text-xs font-semibold text-white">📦 New Order for {c.name}</p>
                            <input value={newOrd.service} onChange={e => setNewOrd({ ...newOrd, service: e.target.value })} placeholder="Service name — e.g. Business Website" className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                            <input value={newOrd.pkg} onChange={e => setNewOrd({ ...newOrd, pkg: e.target.value })} placeholder="Package details" className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                            <div className="flex gap-2">
                              <input type="number" value={newOrd.price || ''} onChange={e => setNewOrd({ ...newOrd, price: +e.target.value })} placeholder="Price $" className="flex-1 px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                              <select value={newOrd.installments} onChange={e => setNewOrd({ ...newOrd, installments: +e.target.value })} className="px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }}>
                                <option value={1}>Full Pay</option><option value={2}>2 parts</option><option value={3}>3 parts</option><option value={4}>4 parts</option><option value={6}>6 parts</option>
                              </select>
                            </div>
                            <textarea value={newOrd.notes} onChange={e => setNewOrd({ ...newOrd, notes: e.target.value })} placeholder="Notes..." rows={2} className="w-full px-2 py-1.5 rounded text-xs text-white resize-none" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                            <div className="flex gap-2">
                              <button onClick={() => setShowNewOrder(null)} className="px-3 py-1.5 rounded text-xs border" style={{ borderColor: borderLight, color: textSecondary }}>Cancel</button>
                              <button onClick={() => {
                                if (!newOrd.service || !newOrd.price) return;
                                if (isSupabaseAuthEnabled()) {
                                  void createAdminOrderInSupabase({
                                    clientId: c.id,
                                    service: newOrd.service,
                                    package: newOrd.pkg,
                                    price: newOrd.price,
                                    notes: newOrd.notes,
                                    installmentCount: newOrd.installments > 1 ? newOrd.installments : undefined,
                                  }).then(() => {
                                    setShowNewOrder(null); setNewOrd({ service: '', pkg: '', price: 0, notes: '', installments: 1 }); reload();
                                  });
                                } else {
                                  adminCreateOrder(c.id, newOrd.service, newOrd.pkg, newOrd.price, newOrd.notes, newOrd.installments > 1 ? newOrd.installments : undefined);
                                  setShowNewOrder(null); setNewOrd({ service: '', pkg: '', price: 0, notes: '', installments: 1 }); void reload();
                                }
                              }} disabled={!newOrd.service || !newOrd.price} className="flex-1 py-1.5 rounded text-xs font-medium bg-cyan-glow text-midnight disabled:opacity-40">Create Order</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setShowNewOrder(c.id)} className="w-full py-2 rounded-lg text-xs font-medium bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/15 hover:bg-cyan-glow/15 transition-colors">📦 + Create Order</button>
                        )}
                        
                        {/* Invoice Creator */}
                        {!showInvForm || invMeta.clientId !== c.id ? (
                          <button onClick={() => { setShowInvForm(true); setInvMeta({ clientId: c.id, note: '', dueDate: '', packageName: '', autoTax: true }); setInvItems([{ description: '', quantity: 1, rate: 0, amount: 0, type: 'package' }]); }} className="w-full py-2.5 rounded-lg text-xs font-medium border hover:bg-white/5" style={{ borderColor: border, color: textSecondary }}>+ Create Invoice</button>
                        ) : (
                          <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: borderLight, background: bgCard }}>
                            <p className="text-xs font-semibold text-white">📄 New Invoice — {c.name}</p>
                            {/* Package name */}
                            <div><label className="text-[10px]" style={{ color: textMuted }}>Package Name</label>
                              <input value={invMeta.packageName} onChange={e => setInvMeta({ ...invMeta, packageName: e.target.value })} placeholder="e.g. Starter, Professional, Enterprise..." className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} /></div>
                            {/* Line items */}
                            {invItems.map((item, idx) => (
                              <div key={idx} className="space-y-1">
                                <div className="flex gap-2 items-end">
                                  <div className="flex-1"><input value={item.description} onChange={e => { const n = [...invItems]; n[idx].description = e.target.value; setInvItems(n); }} placeholder="Description" className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} /></div>
                                  <select value={item.type || 'custom'} onChange={e => { const n = [...invItems]; n[idx].type = e.target.value as InvoiceItem['type']; setInvItems(n); }} className="px-1 py-1.5 rounded text-[10px] text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }}>
                                    <option value="package">📦 Pkg</option><option value="addon">➕ Add-on</option><option value="monthly">🔄 Monthly</option><option value="custom">🔧 Custom</option>
                                  </select>
                                  {invItems.length > 1 && <button onClick={() => setInvItems(invItems.filter((_, i) => i !== idx))} className="text-red-400 text-xs px-1">✕</button>}
                                </div>
                                <div className="flex gap-2">
                                  <input type="number" value={item.quantity || ''} onChange={e => { const n = [...invItems]; n[idx].quantity = +e.target.value; n[idx].amount = n[idx].quantity * n[idx].rate; setInvItems(n); }} placeholder="Qty" className="w-16 px-2 py-1 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                                  <input type="number" value={item.rate || ''} onChange={e => { const n = [...invItems]; n[idx].rate = +e.target.value; n[idx].amount = n[idx].quantity * n[idx].rate; setInvItems(n); }} placeholder="Rate $" className="flex-1 px-2 py-1 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                                  <span className="text-xs text-cyan-glow w-20 text-right pt-1">${(item.quantity * item.rate).toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                            <button onClick={() => setInvItems([...invItems, { description: '', quantity: 1, rate: 0, amount: 0, type: 'addon' }])} className="text-xs text-cyan-glow hover:underline">+ Add line item</button>
                            {/* Tax & Due date */}
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={invMeta.autoTax} onChange={e => setInvMeta({ ...invMeta, autoTax: e.target.checked })} className="w-3 h-3 rounded" /><span className="text-[10px] text-white">Auto TX Tax ({TX_TAX_RATE}%)</span></label>
                            </div>
                            <div><label className="text-[10px]" style={{ color: textMuted }}>Due Date</label><input type="date" value={invMeta.dueDate} onChange={e => setInvMeta({ ...invMeta, dueDate: e.target.value })} className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ background: bgInput, border: `1px solid ${borderLight}` }} /></div>
                            <div><label className="text-[10px]" style={{ color: textMuted }}>Notes (payment terms, scope, etc.)</label>
                              <textarea value={invMeta.note} onChange={e => setInvMeta({ ...invMeta, note: e.target.value })} placeholder="e.g. 50% upfront deposit. Remaining due on delivery..." rows={3} className="w-full px-2 py-1.5 rounded text-xs text-white resize-none" style={{ background: bgInput, border: `1px solid ${borderLight}` }} /></div>
                            {/* Totals preview */}
                            {(() => {
                              const sub = invItems.reduce((a, i) => a + i.quantity * i.rate, 0);
                              const tx = invMeta.autoTax ? calcTax(sub) : { taxAmount: 0, total: sub };
                              return (
                                <div className="pt-2 border-t space-y-1" style={{ borderColor: borderLight }}>
                                  <div className="flex justify-between text-xs"><span style={{ color: textMuted }}>Subtotal</span><span className="text-white">${sub.toLocaleString()}</span></div>
                                  <div className="flex justify-between text-xs"><span style={{ color: textMuted }}>Tax ({invMeta.autoTax ? `${TX_TAX_RATE}% TX` : '0%'})</span><span className="text-white">${tx.taxAmount.toFixed(2)}</span></div>
                                  <div className="flex justify-between text-sm font-bold"><span className="text-white">Total</span><span className="text-cyan-glow">${tx.total.toLocaleString()}</span></div>
                                </div>
                              );
                            })()}
                            {/* Actions: Save Draft / Send */}
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => setShowInvForm(false)} className="px-3 py-2 rounded-lg text-xs border" style={{ borderColor: borderLight, color: textSecondary }}>Cancel</button>
                              <button onClick={() => {
                                const items = invItems.map(i => ({ ...i, amount: i.quantity * i.rate }));
                                const sub = items.reduce((a, i) => a + i.amount, 0);
                                const tx = invMeta.autoTax ? calcTax(sub) : { taxAmount: 0, total: sub };
                                createInvoice({ clientId: c.id, packageName: invMeta.packageName || undefined, items, subtotal: sub, taxRate: invMeta.autoTax ? TX_TAX_RATE : 0, taxAmount: tx.taxAmount, total: tx.total, status: 'draft', note: invMeta.note || undefined, dueDate: invMeta.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] });
                                setShowInvForm(false); setInvItems([{ description: '', quantity: 1, rate: 0, amount: 0, type: 'package' }]); setInvMeta({ clientId: '', note: '', dueDate: '', packageName: '', autoTax: true }); reload();
                              }} disabled={!invItems[0]?.description || !invItems[0]?.rate} className="flex-1 py-2 rounded-lg text-xs font-medium border disabled:opacity-40 hover:bg-white/5" style={{ borderColor: border, color: textSecondary }}>💾 Save Draft</button>
                              <button onClick={() => {
                                const items = invItems.map(i => ({ ...i, amount: i.quantity * i.rate }));
                                const sub = items.reduce((a, i) => a + i.amount, 0);
                                const tx = invMeta.autoTax ? calcTax(sub) : { taxAmount: 0, total: sub };
                                const inv = createInvoice({ clientId: c.id, packageName: invMeta.packageName || undefined, items, subtotal: sub, taxRate: invMeta.autoTax ? TX_TAX_RATE : 0, taxAmount: tx.taxAmount, total: tx.total, status: 'sent', note: invMeta.note || undefined, dueDate: invMeta.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] });
                                emailInvoiceToClient(inv, settings.email);
                                setShowInvForm(false); setInvItems([{ description: '', quantity: 1, rate: 0, amount: 0, type: 'package' }]); setInvMeta({ clientId: '', note: '', dueDate: '', packageName: '', autoTax: true }); reload();
                              }} disabled={!invItems[0]?.description || !invItems[0]?.rate} className="flex-1 py-2 rounded-lg text-xs font-medium bg-cyan-glow text-midnight disabled:opacity-40">📧 Send Invoice</button>
                            </div>
                          </div>
                        )}

                        {ci.length > 0 && <p className="text-xs font-semibold text-white pt-2">Invoices</p>}
                        {ci.map(inv => (
                          <div key={inv.id} className="p-3 rounded-lg border" style={{ borderColor: borderLight, background: bgCard }}>
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <p className="text-[13px] text-white font-medium">{inv.invoiceNumber} — ${inv.total.toLocaleString()}</p>
                                <p className="text-[10px]" style={{ color: textMuted }}>{inv.packageName ? `📦 ${inv.packageName} • ` : ''}{inv.items.length} items • Tax: ${inv.taxRate || 0}%</p>
                              </div>
                              <select value={inv.status} onChange={e => { updateInvoiceStatus(inv.id, e.target.value as Invoice['status']); reload(); }} className="text-[10px] rounded px-1 py-0.5 border" style={{ background: 'transparent', borderColor: borderLight, color: textSecondary }}>
                                {['draft','sent','paid','overdue'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            {editInvId === inv.id ? (
                              <div className="mt-2 space-y-2 pt-2 border-t" style={{ borderColor: borderLight }}>
                                <textarea defaultValue={inv.note || ''} onBlur={e => { updateInvoice(inv.id, { note: e.target.value }); reload(); }} placeholder="Edit notes..." rows={2} className="w-full px-2 py-1.5 rounded text-xs text-white resize-none" style={{ background: bgInput, border: `1px solid ${borderLight}` }} />
                                <button onClick={() => setEditInvId(null)} className="text-[10px] text-cyan-glow">Done editing</button>
                              </div>
                            ) : (
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => downloadInvoice(inv)} className="text-[10px] text-cyan-glow hover:underline">📥 Download</button>
                                <button onClick={() => { emailInvoiceToClient(inv, settings.email); alert('Invoice emailed to client!'); }} className="text-[10px] text-green-400 hover:underline">📧 Email</button>
                                <button onClick={() => setEditInvId(inv.id)} className="text-[10px] hover:underline" style={{ color: textSecondary }}>✏️ Edit</button>
                                <button onClick={() => { if (confirm('Delete invoice?')) { deleteInvoice(inv.id); reload(); } }} className="text-[10px] text-red-400 hover:underline ml-auto">Delete</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {clients.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: border, color: textMuted }}>No clients registered yet.</div>}
          </div>
        )}

        {/* ── Support Tickets (Admin) ── */}
        {tab === 'support' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-white">🎧 Support Tickets</h3>
              <span className="text-[11px]" style={{ color: textMuted }}>{allTickets.length} total • {allTickets.filter(t => t.status === 'open').length} open</span>
            </div>
            {allTickets.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: border, color: textMuted }}>No tickets yet. Tickets appear when clients submit support requests.</div>}
            {allTickets.map(t => {
              const isOpen = selTicketId === t.id;
              const client = clients.find(c => c.id === t.clientId);
              const pColors: Record<string, string> = { low: '#6b7094', medium: '#60a5fa', high: '#f59e0b', urgent: '#ef4444' };
              const sColors: Record<string, string> = { open: 'bg-amber-500/15 text-amber-400 border-amber-500/20', in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/20', waiting_client: 'bg-violet-500/15 text-violet-400 border-violet-500/20', resolved: 'bg-green-500/15 text-green-400 border-green-500/20', closed: 'bg-gray-500/15 text-gray-400 border-gray-500/20' };
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
        )}

        {/* ── Activity Log ── */}
        {tab === 'activity' && (
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
        )}

      </div>
    </motion.div>
  );
}
