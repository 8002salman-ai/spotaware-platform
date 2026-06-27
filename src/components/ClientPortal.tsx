import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  verifyClientLogin, registerClient, setClientAuth, getClientSession,
  getClientOrders, getClientInvoices, createOrder, addOrderUpdate, updateClientProfile,
  getClients, getSettings, logActivity,
  getClientTickets, createTicket, addTicketMessage,
  getNotifications, markAllNotifsRead,
  getOrderNotes, addOrderNote,
  type Order, type Invoice, type SupportTicket, type AppNotification, type OrderNote,
} from '../utils/storage';
import { downloadInvoice } from '../utils/invoice';
import { hydrateSupabasePortalSession, isSupabaseAuthEnabled, isOAuthReturnInProgress, waitForSupabasePortalSession, supabaseSignIn, supabaseSignOut, supabaseSignUp, supabaseSignInWithGoogle, supabaseSendPasswordReset } from '../utils/auth';
import {
  fetchClientOrders,
  fetchClientInvoices,
  createClientOrderInSupabase,
  addOrderUpdateInSupabase,
  updateProfileInSupabase,
  fetchClientSupport,
  createSupportTicketInSupabase,
  addSupportMessageInSupabase,
  markAllNotificationsReadInSupabase,
  notifyAdminInSupabase,
} from '../utils/supabaseData';
import { getSupabase } from '../utils/supabase';

const bg = 'var(--t-bg,#0f1923)'; const bgCard = 'var(--t-card,#152230)'; const bgEl = 'var(--t-el,#1a2d3d)'; const bgIn = 'var(--t-in,#1f3344)';
const bd = 'var(--t-bd,#264055)'; const bdL = 'var(--t-bdl,#1e3548)'; const tSec = 'var(--t-sec,#8ab4d0)'; const tMut = 'var(--t-mut,#4d7a96)';

type View = 'dashboard' | 'orders' | 'order-detail' | 'services' | 'invoices' | 'invoice-detail' | 'profile' | 'support' | 'ticket-detail' | 'notifications';

// Services catalog
const SERVICES = [
  { cat: 'Web Development', items: [
    { name: 'Landing Page', desc: 'Single page, conversion focused', price: 497, time: '5-7 days' },
    { name: 'Business Website', desc: 'Up to 10 pages, CMS, SEO', price: 1497, time: '10-14 days' },
    { name: 'Web Application', desc: 'Custom app, auth, database', price: 3997, time: '3-6 weeks' },
    { name: 'E-commerce Store', desc: 'Full store, payments, inventory', price: 2997, time: '2-4 weeks' },

    { name: 'Website Redesign', desc: 'Modern refresh, speed, mobile', price: 997, time: '1-3 weeks' },
  ]},
  { cat: 'Design & Branding', items: [
    { name: 'UI/UX Design', desc: 'Complete design system, prototypes', price: 1497, time: '1-2 weeks' },
    { name: 'Logo & Brand Kit', desc: 'Logo, colors, typography, guidelines', price: 297, time: '3-5 days' },
    { name: 'Custom Illustrations', desc: 'Brand illustrations pack', price: 397, time: '5-7 days' },
  ]},
  { cat: 'Add-on Services', items: [
    { name: 'SEO Optimization', desc: 'On-page, technical, speed audit', price: 497, time: '1 week' },
    { name: 'Analytics Setup', desc: 'GA4, heatmaps, conversion tracking', price: 197, time: '2-3 days' },
    { name: 'Monthly Maintenance', desc: 'Updates, backups, monitoring', price: 197, time: 'Monthly' },
    { name: 'Rush Delivery', desc: '50% faster delivery', price: 0, time: '+30% cost' },
    { name: 'API Integration', desc: '3rd party API connections', price: 497, time: '3-5 days' },
    { name: 'Email System', desc: 'Transactional + marketing emails', price: 397, time: '3-5 days' },
  ]},
];

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  review: { label: 'In Review', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  revision: { label: 'Revision', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  completed: { label: 'Completed', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  on_hold: { label: 'On Hold', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  draft: { label: 'Draft', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  sent: { label: 'Sent', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  paid: { label: 'Paid', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  overdue: { label: 'Overdue', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const fmt = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const canAccessClientPortal = (role?: string) => ['client', 'owner', 'admin', 'viewer'].includes(role || '');

export default function ClientPortal({ onClose }: { onClose: () => void }) {
  const [auth, setAuth] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(() => isOAuthReturnInProgress());
  const [oauthMessage, setOauthMessage] = useState('Signing in with Google...');
  const [authHydrating, setAuthHydrating] = useState(() => isSupabaseAuthEnabled() && isOAuthReturnInProgress());
  const oauthLoadingRef = useRef(oauthLoading);
  const authHydratingRef = useRef(authHydrating);
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [session, setSession] = useState<{ id: string; name: string; email: string } | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selOrder, setSelOrder] = useState<Order | null>(null);
  const [selInvoice, setSelInvoice] = useState<Invoice | null>(null);
  const [updateMsg, setUpdateMsg] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '', company: '', phone: '', password: '' });
  const [profileSaved, setProfileSaved] = useState(false);
  // Order form
  const [orderService, setOrderService] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  // Support
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selTicket, setSelTicket] = useState<SupportTicket | null>(null);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketReply, setTicketReply] = useState('');
  // Notifications
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  // Notes
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [liveNotice, setLiveNotice] = useState('');

  const loadPortalData = useCallback(async (clientId: string) => {
    if (isSupabaseAuthEnabled()) {
      const [sbOrders, sbInvoices, support] = await Promise.all([
        fetchClientOrders(clientId),
        fetchClientInvoices(clientId),
        fetchClientSupport(clientId),
      ]);
      setOrders(sbOrders);
      setInvoices(sbInvoices);
      setTickets(support.tickets);
      setNotifs(support.notifications);
      return;
    }

    setOrders(getClientOrders(clientId));
    setInvoices(getClientInvoices(clientId));
    setTickets(getClientTickets(clientId));
    setNotifs(getNotifications(clientId));
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (isSupabaseAuthEnabled()) {
        const oauthReturn = isOAuthReturnInProgress();
        setAuthHydrating(oauthReturn);
        setOauthLoading(oauthReturn);
        if (oauthReturn) setOauthMessage('Completing Google login...');
        const s = await waitForSupabasePortalSession();
        if (!s) {
          setOauthLoading(false);
          setAuthHydrating(false);
          return;
        }
        if (!canAccessClientPortal(s.role)) {
          await supabaseSignOut();
          setError('This account is not allowed to access the client portal.');
          setOauthLoading(false);
          setAuthHydrating(false);
          return;
        }
        setAuth(true);
        setSession({ id: s.id, name: s.name, email: s.email });
        setOauthLoading(false);
        setAuthHydrating(false);
        return;
      }

      const s = getClientSession();
      if (s) { setAuth(true); setSession(s); }
      setAuthHydrating(false);
    };
    void initAuth();
  }, []);

  useEffect(() => {
    oauthLoadingRef.current = oauthLoading;
  }, [oauthLoading]);

  useEffect(() => {
    authHydratingRef.current = authHydrating;
  }, [authHydrating]);

  useEffect(() => {
    if (!isSupabaseAuthEnabled()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (event === 'SIGNED_OUT' && (oauthLoadingRef.current || authHydratingRef.current)) {
        return;
      }
      if (event === 'SIGNED_OUT') {
        setAuth(false);
        setSession(null);
        setOauthLoading(false);
        setAuthHydrating(false);
        return;
      }
      if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') return;

      setAuthHydrating(true);
      const hydration = authSession
        ? hydrateSupabasePortalSession(authSession)
        : waitForSupabasePortalSession();
      const s = await Promise.race([
        hydration,
        new Promise<null>((resolve) => window.setTimeout(() => {
          resolve(null);
        }, 9000)),
      ]);
      if (!s) {
        setError('Signed in, but profile/session hydration timed out. Please refresh once or try again.');
        setOauthLoading(false);
        setAuthHydrating(false);
        return;
      }
      if (!canAccessClientPortal(s.role)) {
        await supabaseSignOut();
        setError('This account is not allowed to access the client portal.');
        setOauthLoading(false);
        setAuthHydrating(false);
        return;
      }
      setAuth(true);
      setSession({ id: s.id, name: s.name, email: s.email });
      setError('');
      setOauthLoading(false);
      setAuthHydrating(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      void loadPortalData(session.id);
      const c = getClients().find(x => x.id === session.id);
      if (c) setProfile({ name: c.name, email: c.email, company: c.company || '', phone: c.phone || '', password: '' });
    }
  }, [session, view, loadPortalData]);

  useEffect(() => {
    if (selOrder) { setNotes(getOrderNotes(selOrder.id)); }
  }, [selOrder]);

  useEffect(() => {
    if (!session || !isSupabaseAuthEnabled()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`client-live-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `client_id=eq.${session.id}` }, () => {
        setLiveNotice('New notification received');
        void loadPortalData(session.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `client_id=eq.${session.id}` }, () => {
        setLiveNotice('Support reply received');
        void loadPortalData(session.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `client_id=eq.${session.id}` }, () => {
        setLiveNotice('Project status updated');
        void loadPortalData(session.id);
      })
      .subscribe();

    const timer = setInterval(() => setLiveNotice(''), 5000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [session, loadPortalData]);

  const handleLogin = async () => {
    if (isSupabaseAuthEnabled()) {
      const { session: authSession, error: authError } = await supabaseSignIn(form.email, form.password);
      if (!authSession) {
        setError(authError || 'Invalid email or password');
        return;
      }
      if (!canAccessClientPortal(authSession.role)) {
        setError('This account is not allowed to access the client portal.');
        return;
      }
      setAuth(true);
      setSession({ id: authSession.id, name: authSession.name, email: authSession.email });
      setError('');
      return;
    }

    const u = verifyClientLogin(form.email, form.password);
    if (u) { setClientAuth(u); setAuth(true); setSession({ id: u.id, name: u.name, email: u.email }); setError(''); }
    else setError('Invalid email or password');
  };

  const handleSignup = async () => {
    if (!form.name || !form.email || !form.password) { setError('All fields required'); return; }

    if (isSupabaseAuthEnabled()) {
      const { session: authSession, error: authError } = await supabaseSignUp({
        email: form.email,
        password: form.password,
        name: form.name,
        company: form.company,
        role: 'client',
      });

      if (authError) {
        setError(authError);
        return;
      }
      if (!authSession) {
        setError('Signup created. Please verify email, then login.');
        return;
      }
      setAuth(true);
      setSession({ id: authSession.id, name: authSession.name, email: authSession.email });
      setError('');
      return;
    }

    const u = registerClient(form.name, form.email, form.password, form.company);
    if (!u) { setError('Email already registered'); return; }
    setClientAuth(u); setAuth(true); setSession({ id: u.id, name: u.name, email: u.email }); setError('');
  };

  const handleLogout = async () => {
    if (isSupabaseAuthEnabled()) {
      await supabaseSignOut();
    } else {
      setClientAuth(null);
    }
    setAuth(false);
    setSession(null);
    onClose();
  };

  const handleGoogleLogin = async () => {
    setError('');
    setOauthLoading(true);
    setOauthMessage(mode === 'signup' ? 'Creating your account with Google...' : 'Signing in with Google...');
    const { error: oauthError } = await supabaseSignInWithGoogle('client');
    if (oauthError) {
      setOauthLoading(false);
      setError(oauthError);
      return;
    }
    setOauthMessage('Opening Google sign-in...');
    window.setTimeout(() => {
      if (!isOAuthReturnInProgress()) {
        setOauthLoading(false);
        setError('Google sign-in did not continue. Please tap Continue with Google again.');
      }
    }, 5000);
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      setError('Please enter your email first.');
      return;
    }
    setResetState('sending');
    const { error: resetError } = await supabaseSendPasswordReset(form.email.trim(), 'client');
    if (resetError) {
      setResetState('error');
      setError(resetError);
      return;
    }
    setResetState('sent');
    setError('');
  };

  const handlePlaceOrder = async () => {
    if (!orderService || !session) return;
    const svc = SERVICES.flatMap(c => c.items).find(i => i.name === orderService);
    if (!svc) return;
    if (isSupabaseAuthEnabled()) {
      const order = await createClientOrderInSupabase({
        clientId: session.id,
        service: svc.name,
        package: svc.desc,
        price: svc.price,
        notes: orderNotes,
      });
      await notifyAdminInSupabase({
        type: 'order',
        title: 'New Client Order',
        message: `${session.name} (${session.email}) ordered ${svc.name} for $${svc.price}. Notes: ${orderNotes || 'None'}`,
        entityId: order?.id,
      });
    } else {
      createOrder({ clientId: session.id, service: svc.name, package: svc.desc, price: svc.price, status: 'pending', notes: orderNotes, adminNotes: '' });
    }
    // Try email notification to admin
    const s = getSettings();
    if (s.email.enabled && s.email.serviceId && s.email.publicKey && s.email.templateIdLead) {
      try {
        const ejs = await import('@emailjs/browser');
        await ejs.send(s.email.serviceId, s.email.templateIdLead, {
          to_email: s.email.adminEmail,
          from_email: session.email,
          message: `New order from ${session.name} (${session.email})!\n\nService: ${svc.name}\nPrice: $${svc.price}\nNotes: ${orderNotes || 'None'}\n\nLogin to Admin Panel to manage.`,
          client_email: session.email,
        }, s.email.publicKey);
      } catch (e) { console.error('Email failed:', e); }
    }
    logActivity('order', 'New Order', `${svc.name} — $${svc.price}`, undefined, session.email);
    setOrderService(''); setOrderNotes('');
    await loadPortalData(session.id);
    setView('orders');
  };

  const handleSendUpdate = async () => {
    if (!updateMsg.trim() || !selOrder) return;
    if (isSupabaseAuthEnabled()) {
      await addOrderUpdateInSupabase(selOrder.id, updateMsg, 'client');
      await notifyAdminInSupabase({
        type: 'order',
        title: 'Client Project Message',
        message: `${session?.name} (${session?.email}) sent a message on ${selOrder.service}: ${updateMsg}`,
        entityId: selOrder.id,
      });
    } else {
      addOrderUpdate(selOrder.id, updateMsg, 'client');
    }
    setUpdateMsg('');
    await loadPortalData(session!.id);
    const refreshedOrders = isSupabaseAuthEnabled() ? await fetchClientOrders(session!.id) : getClientOrders(session!.id);
    setSelOrder(refreshedOrders.find(o => o.id === selOrder.id) || null);
  };

  const handleSaveProfile = async () => {
    if (!session) return;
    const updates: Record<string, string> = {};
    if (profile.name) updates.name = profile.name;
    if (profile.email) updates.email = profile.email;
    if (profile.company) updates.company = profile.company;
    if (profile.phone) updates.phone = profile.phone;
    if (isSupabaseAuthEnabled()) {
      await updateProfileInSupabase(session.id, {
        name: updates.name,
        email: updates.email,
        company: updates.company,
        phone: updates.phone,
      });
    } else {
      if (profile.password) updates.password = profile.password;
      updateClientProfile(session.id, updates);
    }
    setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000);
  };

  const Input = ({ label, value, onChange, type = 'text', ph = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; ph?: string }) => (
    <div><label className="text-xs font-medium mb-1.5 block" style={{ color: tSec }}>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={ph} className="w-full px-4 py-3 rounded-xl text-[14px] text-white focus:outline-none focus:border-cyan-glow/50 placeholder:text-[#4a4f6a] transition-colors" style={{ background: bgIn, border: `1px solid ${bd}` }} /></div>
  );

  // ── Auth Screen ──
  if (!auth && authHydrating) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(4,5,10,0.95)' }}>
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-md rounded-2xl p-8 border text-center" style={{ background: bgCard, borderColor: bd }}>
          <div className="w-12 h-12 rounded-full border-2 border-cyan-glow/40 border-t-cyan-glow animate-spin mx-auto mb-4" />
          <h2 className="font-display text-lg font-bold text-white">Preparing your portal</h2>
          <p className="text-xs mt-2" style={{ color: tSec }}>{oauthMessage}</p>
        </motion.div>
      </motion.div>
    );
  }

  if (!auth) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(4,5,10,0.95)' }}>
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-md rounded-2xl p-8 border" style={{ background: bgCard, borderColor: bd }}>
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-cyan-glow/10 border border-cyan-glow/20 flex items-center justify-center mx-auto mb-4"><span className="text-2xl">🚀</span></div>
            <h2 className="font-display text-xl font-bold text-white">Client Portal</h2>
            <p className="text-[14px] mt-1" style={{ color: tSec }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</p>
          </div>
          <div className="flex mb-6 rounded-xl p-1" style={{ background: bgEl }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === m ? 'bg-cyan-glow text-midnight' : ''}`} style={mode !== m ? { color: tSec } : undefined}>{m === 'login' ? 'Login' : 'Sign Up'}</button>
            ))}
          </div>
          <div className="space-y-3">
            {oauthLoading && (
              <div className="rounded-xl border px-4 py-3 text-xs text-cyan-glow bg-cyan-glow/10 border-cyan-glow/20">
                {oauthMessage}
              </div>
            )}
            {mode === 'signup' && <Input label="Full Name" value={form.name} onChange={v => setForm({ ...form, name: v })} ph="John Doe" />}
            <Input label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" ph="you@company.com" />
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: tSec }}>Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="w-full px-4 py-3 pr-16 rounded-xl text-[14px] text-white focus:outline-none focus:border-cyan-glow/50 placeholder:text-[#4a4f6a] transition-colors" style={{ background: bgIn, border: `1px solid ${bd}` }} />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs hover:text-white transition-colors" style={{ color: tSec }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {mode === 'signup' && <Input label="Company (optional)" value={form.company} onChange={v => setForm({ ...form, company: v })} ph="Acme Inc." />}
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button disabled={oauthLoading} onClick={mode === 'login' ? handleLogin : handleSignup} className="w-full py-3.5 rounded-xl bg-cyan-glow text-midnight font-display font-semibold text-sm hover:bg-cyan-soft transition-colors disabled:opacity-60">{mode === 'login' ? 'Login →' : 'Create Account →'}</button>
            <button disabled={oauthLoading} onClick={handleGoogleLogin} className="w-full py-3.5 rounded-xl border text-sm font-medium transition-colors hover:bg-white/5 text-white flex items-center justify-center gap-2.5 disabled:opacity-60" style={{ borderColor: bd }}>
              <svg className="w-4.5 h-4.5" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.657 29.193 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.053 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.053 6.053 29.27 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.193l-6.19-5.238C29.143 35.091 26.715 36 24 36c-5.173 0-9.628-3.327-11.286-7.946l-6.522 5.025C9.507 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.058 2.994-3.115 5.347-5.894 6.87l.003-.002 6.19 5.238C35.164 40.38 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              <span>Continue with Google</span>
            </button>
            {isSupabaseAuthEnabled() && mode === 'login' && (
              <button onClick={handleForgotPassword} disabled={resetState === 'sending'} className="w-full py-2 text-xs transition-colors hover:text-white disabled:opacity-50" style={{ color: tSec }}>
                {resetState === 'sending' ? 'Sending reset email...' : 'Forgot password?'}
              </button>
            )}
            {isSupabaseAuthEnabled() && resetState === 'sent' && (
              <p className="text-green-400 text-xs text-center">Reset password email sent. Check your inbox.</p>
            )}
            <button onClick={onClose} className="w-full py-2 text-sm hover:text-white transition-colors" style={{ color: tSec }}>Back to site</button>
          </div>
          <div className="mt-4 p-3 rounded-xl border" style={{ background: bgEl, borderColor: '#1e2035' }}>
            <p className="text-[11px]" style={{ color: tMut }}>
              Create a real client account or sign in using your existing Supabase credentials.
            </p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Portal ──
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: bg }}>
      {/* Header */}
      <header className="px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0 border-b" style={{ background: bgCard, borderColor: bdL }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-glow/10 border border-cyan-glow/20 flex items-center justify-center"><span className="text-cyan-glow text-sm font-bold">S</span></div>
          <div><h1 className="font-display font-bold text-white text-base">Client Portal</h1><p className="text-[11px]" style={{ color: tMut }}>{session?.name} • {session?.email}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('profile')} className="px-3 py-2 rounded-lg text-xs font-medium hover:text-white transition-colors" style={{ color: tSec }}>Profile</button>
          <button onClick={handleLogout} className="px-3 py-2 rounded-lg text-xs font-medium bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20 hover:bg-cyan-glow/20">Logout</button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: tSec }}>✕</button>
        </div>
      </header>

      {/* Nav */}
      <div className="px-4 md:px-6 flex gap-1 overflow-x-auto flex-shrink-0 border-b" style={{ background: bgCard, borderColor: bdL }}>
        {[{ id: 'dashboard', label: '📊 Dashboard' }, { id: 'orders', label: `📦 Orders (${orders.length})` }, { id: 'services', label: '🛒 Services' }, { id: 'invoices', label: `📄 Invoices (${invoices.length})` }, { id: 'support', label: `🎧 Support${tickets.filter(t=>t.status!=='closed').length > 0 ? ` (${tickets.filter(t=>t.status!=='closed').length})` : ''}` }, { id: 'notifications', label: `🔔${notifs.filter(n=>!n.read).length > 0 ? ` ${notifs.filter(n=>!n.read).length}` : ''}` }].map(t => (
          <button key={t.id} onClick={() => { setView(t.id as View); setSelOrder(null); setSelInvoice(null); }} className={`px-4 py-3 text-[13px] font-medium border-b-2 whitespace-nowrap transition-colors ${view === t.id || (view === 'order-detail' && t.id === 'orders') || (view === 'invoice-detail' && t.id === 'invoices') ? 'border-cyan-glow text-white' : 'border-transparent'}`} style={!(view === t.id || (view === 'order-detail' && t.id === 'orders') || (view === 'invoice-detail' && t.id === 'invoices')) ? { color: tSec } : undefined}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {liveNotice && (
          <div className="mb-4 rounded-xl border px-4 py-2 text-[12px] bg-cyan-glow/10 text-cyan-glow border-cyan-glow/20">
            {liveNotice}
          </div>
        )}
        {/* Dashboard — Premium */}
        {view === 'dashboard' && (() => {
          const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
          const completedOrders = orders.filter(o => o.status === 'completed');
          const holdOrders = orders.filter(o => o.onHold);
          const paidTotal = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.total, 0);
          const pendingInvs = invoices.filter(i => i.status !== 'paid');
          const nextPayment = orders.flatMap(o => (o.installments || []).filter(i => i.status === 'pending')).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
          return (
            <div className="max-w-4xl space-y-5">
              {/* Welcome */}
              <div className="rounded-xl p-5 border" style={{ background: bgCard, borderColor: bd }}>
                <h2 className="font-display text-xl font-bold text-white">Welcome back, {session?.name?.split(' ')[0]} 👋</h2>
                <p className="text-[13px] mt-1" style={{ color: tSec }}>Here's your project overview</p>
              </div>

              {/* Alert banners */}
              {holdOrders.length > 0 && (
                <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/20">
                  <p className="text-[13px] text-red-400 font-medium">⚠️ {holdOrders.length} project{holdOrders.length > 1 ? 's' : ''} on hold — <button onClick={() => { setSelOrder(holdOrders[0]); setView('order-detail'); }} className="underline">View details</button></p>
                </div>
              )}
              {nextPayment && (
                <div className="rounded-xl p-4 border" style={{ background: '#2a2d44', borderColor: '#f59e0b30' }}>
                  <p className="text-[13px] text-amber-400 font-medium">💳 Next payment: <span className="text-white">${nextPayment.amount}</span> due <span className="text-white">{nextPayment.dueDate}</span> — {nextPayment.label}</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { l: 'Active Projects', v: activeOrders.length, icon: '📦', color: '#00e5ff', click: () => setView('orders') },
                  { l: 'Completed', v: completedOrders.length, icon: '✅', color: '#34d399', click: () => setView('orders') },
                  { l: 'Pending Invoices', v: pendingInvs.length, icon: '📄', color: '#f59e0b', click: () => setView('invoices') },
                  { l: 'Total Invested', v: `$${paidTotal.toLocaleString()}`, icon: '💰', color: '#a78bfa', click: () => setView('invoices') },
                ].map(s => (
                  <button key={s.l} onClick={s.click} className="rounded-xl p-4 border text-left hover:border-cyan-glow/20 transition-all" style={{ background: bgCard, borderColor: bd }}>
                    <div className="flex items-center justify-between mb-2"><span className="text-lg">{s.icon}</span><span className="w-2 h-2 rounded-full" style={{ background: s.color, opacity: 0.6 }} /></div>
                    <p className="font-display text-2xl font-bold text-white">{s.v}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: tMut }}>{s.l}</p>
                  </button>
                ))}
              </div>

              {/* Active orders with progress */}
              {activeOrders.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: bdL }}>
                    <span className="text-[13px] font-semibold text-white">🚀 Active Projects</span>
                    <button onClick={() => setView('orders')} className="text-[11px] text-cyan-glow hover:underline">View all →</button>
                  </div>
                  {activeOrders.map(o => (
                    <div key={o.id} className={`px-4 py-3 flex items-center justify-between border-b cursor-pointer hover:bg-white/[0.02] ${o.onHold ? 'bg-red-500/5' : ''}`} style={{ borderColor: bdL }} onClick={() => { setSelOrder(o); setView('order-detail'); }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-medium text-white truncate">{o.service}</p>
                          {o.onHold && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">HOLD</span>}
                        </div>
                        <p className="text-[11px]" style={{ color: tMut }}>${o.totalPaid || 0} / ${o.price} paid</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: bdL }}><div className="h-full rounded-full bg-cyan-glow transition-all" style={{ width: `${o.progress}%` }} /></div>
                        <span className="text-[12px] font-semibold text-cyan-glow w-8 text-right">{o.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setView('services')} className="py-4 rounded-xl bg-cyan-glow/8 border border-cyan-glow/15 text-cyan-glow font-medium text-[14px] hover:bg-cyan-glow/12 transition-colors">🛒 Order New Service</button>
                <button onClick={() => setView('invoices')} className="py-4 rounded-xl border font-medium text-[14px] hover:bg-white/[0.02] transition-colors" style={{ borderColor: bd, color: tSec }}>📄 View Invoices</button>
              </div>
            </div>
          );
        })()}

        {/* Orders List */}
        {view === 'orders' && (
          <div className="max-w-4xl space-y-4">
            {orders.map(o => (
              <div key={o.id} className="rounded-xl p-5 border cursor-pointer hover:border-cyan-glow/30 transition-colors" style={{ background: bgCard, borderColor: bd }} onClick={() => { setSelOrder(o); setView('order-detail'); }}>
                <div className="flex items-center justify-between mb-3">
                  <div><p className="font-semibold text-white">{o.service}</p><p className="text-[13px]" style={{ color: tSec }}>{o.package} • ${o.price.toLocaleString()}</p></div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${statusMap[o.status]?.color}`}>{statusMap[o.status]?.label}</span>
                </div>
                <div className="flex items-center gap-3"><div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: bdL }}><div className="h-full rounded-full bg-cyan-glow transition-all" style={{ width: `${o.progress}%` }} /></div><span className="text-xs text-cyan-glow font-medium">{o.progress}%</span></div>
                <p className="text-xs mt-2" style={{ color: tMut }}>{fmt(o.createdAt)}{o.dueDate ? ` • Due: ${o.dueDate}` : ''}</p>
              </div>
            ))}
            {orders.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: bd, color: tMut }}>No orders yet. <button onClick={() => setView('services')} className="text-cyan-glow underline ml-1">Browse services</button></div>}
          </div>
        )}

        {/* Order Detail */}
        {view === 'order-detail' && selOrder && (
          <div className="max-w-2xl space-y-6">
            <button onClick={() => setView('orders')} className="text-xs hover:text-white transition-colors" style={{ color: tSec }}>← Back to orders</button>
            <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }}>
              <div className="p-5 border-b" style={{ borderColor: bdL }}>
                <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-white text-lg">{selOrder.service}</h3><span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusMap[selOrder.status]?.color}`}>{statusMap[selOrder.status]?.label}</span></div>
                <p className="text-[14px]" style={{ color: tSec }}>{selOrder.package}</p>
                <div className="flex items-center gap-4 mt-3"><span className="text-cyan-glow font-bold text-lg">${selOrder.price.toLocaleString()}</span>{selOrder.dueDate && <span className="text-xs" style={{ color: tMut }}>Due: {selOrder.dueDate}</span>}</div>
              </div>
              <div className="p-5 space-y-4">
                {/* Progress */}
                <div className="flex items-center gap-3"><span className="text-xs font-medium" style={{ color: tSec }}>Progress</span><div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: bdL }}><div className="h-full rounded-full bg-cyan-glow transition-all" style={{ width: `${selOrder.progress}%` }} /></div><span className="text-sm text-cyan-glow font-bold">{selOrder.progress}%</span></div>
                
                {/* Hold Banner */}
                {selOrder.onHold && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-[14px] font-semibold text-red-400">⚠️ Project On Hold</p>
                    <p className="text-[13px] text-red-400/80 mt-1">{selOrder.holdMessage}</p>
                    {selOrder.holdReason === 'payment_overdue' && <p className="text-[12px] text-red-400/60 mt-2">Please complete your pending payment to resume work.</p>}
                    {selOrder.holdReason === 'client_delay' && <p className="text-[12px] text-red-400/60 mt-2">Note: Your payment schedule remains unchanged regardless of project delays.</p>}
                  </div>
                )}

                {/* Payment Status */}
                <div className="p-4 rounded-xl border" style={{ background: bgEl, borderColor: bdL }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white">💰 Payment Status</span>
                    <span className="text-xs text-cyan-glow font-semibold">${selOrder.totalPaid || 0} / ${selOrder.price} paid</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: bdL }}><div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${selOrder.price > 0 ? (selOrder.totalPaid || 0) / selOrder.price * 100 : 0}%` }} /></div>
                  {selOrder.paymentPlan === 'installment' && selOrder.installments.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium" style={{ color: tMut }}>Flexible Payment Plan:</p>
                      {selOrder.installments.map(inst => (
                        <div key={inst.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg border" style={{ borderColor: bdL, background: bgCard }}>
                          <div>
                            <span className="text-[13px] text-white">{inst.label}</span>
                            <span className="text-[11px] ml-2" style={{ color: tMut }}>Due: {inst.dueDate}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-white">${inst.amount}</span>
                            {inst.status === 'paid' ? <span className="text-[10px] text-green-400 font-medium">✓ Paid</span> : 
                             inst.status === 'overdue' ? <span className="text-[10px] text-red-400 font-medium">⚠ Overdue</span> :
                             <span className="text-[10px] font-medium" style={{ color: tMut }}>Pending</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Client Deadlines */}
                {(selOrder.clientDeadlines || []).length > 0 && (
                  <div className="p-4 rounded-xl border" style={{ background: bgEl, borderColor: bdL }}>
                    <p className="text-xs font-medium text-white mb-2">📋 Items Requested From You</p>
                    {selOrder.clientDeadlines.map(dl => (
                      <div key={dl.id} className={`flex items-center justify-between py-2 border-t ${dl.status === 'overdue' ? 'bg-red-500/5' : ''}`} style={{ borderColor: bdL }}>
                        <div>
                          <p className={`text-[13px] ${dl.status === 'overdue' ? 'text-red-400' : dl.status === 'received' ? 'text-green-400' : 'text-white'}`}>{dl.item}</p>
                          <p className="text-[11px]" style={{ color: tMut }}>Due: {dl.dueDate}</p>
                        </div>
                        {dl.status === 'received' ? <span className="text-[11px] text-green-400">✓ Received</span> :
                         dl.status === 'overdue' ? <span className="text-[11px] text-red-400">⚠ Overdue — Project paused</span> :
                         <span className="text-[11px]" style={{ color: tMut }}>Waiting</span>}
                      </div>
                    ))}
                    <p className="text-[10px] mt-2" style={{ color: tMut }}>⚠ Late submissions may pause your project. Payment schedule remains unchanged.</p>
                  </div>
                )}

                {selOrder.notes && <div className="p-4 rounded-xl border" style={{ background: bgEl, borderColor: bdL }}><p className="text-xs uppercase mb-1" style={{ color: tMut }}>Your Notes</p><p className="text-[14px]" style={{ color: tSec }}>{selOrder.notes}</p></div>}
              </div>
            </div>
            {/* Updates */}
            <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: bdL }}><h4 className="font-semibold text-white">Updates & Messages</h4></div>
              <div className="p-5 space-y-3 max-h-64 overflow-y-auto">
                {selOrder.updates.length === 0 && <p className="text-center text-[13px] py-4" style={{ color: tMut }}>No updates yet</p>}
                {selOrder.updates.map(u => (
                  <div key={u.id} className={`p-3 rounded-xl border ${u.by === 'system' ? 'mx-4' : u.by === 'admin' ? 'ml-0 mr-8' : 'ml-8 mr-0'}`}
                    style={{ 
                      background: u.by === 'system' ? 'rgba(251,191,36,0.05)' : u.by === 'admin' ? bgEl : 'rgba(0,229,255,0.05)', 
                      borderColor: u.by === 'system' ? 'rgba(251,191,36,0.15)' : u.by === 'admin' ? bdL : 'rgba(0,229,255,0.15)' 
                    }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium" style={{ color: u.by === 'system' ? '#fbbf24' : u.by === 'admin' ? tSec : '#67f0ff' }}>
                        {u.by === 'system' ? '🔔 System' : u.by === 'admin' ? '🛡 SpotAware Team' : '👤 You'}
                      </span>
                      <span className="text-[10px]" style={{ color: tMut }}>{fmt(u.timestamp)}</span>
                    </div>
                    <p className="text-[13px]" style={{ color: u.by === 'system' ? '#fbbf24' : tSec }}>{u.message}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t flex gap-2" style={{ borderColor: bdL }}>
                <input value={updateMsg} onChange={e => setUpdateMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendUpdate()} placeholder="Send a message..." className="flex-1 px-4 py-2.5 rounded-xl text-[13px] text-white focus:outline-none placeholder:text-[#4a4f6a]" style={{ background: bgIn, border: `1px solid ${bd}` }} />
                <button onClick={handleSendUpdate} disabled={!updateMsg.trim()} className="px-4 py-2.5 rounded-xl text-xs font-medium bg-cyan-glow text-midnight disabled:opacity-40">Send</button>
              </div>
            </div>
          </div>
        )}

        {/* Services Catalog */}
        {view === 'services' && (
          <div className="max-w-4xl space-y-8">
            <div className="text-center"><h2 className="font-display text-2xl font-bold text-white">Our Services</h2><p className="text-[15px] mt-2" style={{ color: tSec }}>Select a service to place an order</p></div>
            {SERVICES.map(cat => (
              <div key={cat.cat}>
                <h3 className="font-display font-semibold text-white text-lg mb-4">{cat.cat}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cat.items.map(svc => (
                    <div key={svc.name} className={`rounded-xl p-5 border cursor-pointer transition-all ${orderService === svc.name ? 'border-cyan-glow/50 ring-1 ring-cyan-glow/20' : 'hover:border-cyan-glow/20'}`} style={{ background: bgCard, borderColor: orderService === svc.name ? undefined : bd }} onClick={() => setOrderService(svc.name)}>
                      <div className="flex items-start justify-between"><div><p className="font-semibold text-white text-[15px]">{svc.name}</p><p className="text-[13px] mt-1" style={{ color: tSec }}>{svc.desc}</p></div>{orderService === svc.name && <span className="w-6 h-6 rounded-full bg-cyan-glow flex items-center justify-center text-midnight text-xs">✓</span>}</div>
                      <div className="flex items-center gap-3 mt-3"><span className="text-cyan-glow font-bold text-lg">{svc.price > 0 ? `$${svc.price.toLocaleString()}` : 'Addon'}</span><span className="text-xs" style={{ color: tMut }}>⏱ {svc.time}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {/* Order form */}
            <AnimatePresence>
              {orderService && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border p-5 sticky bottom-4" style={{ background: bgCard, borderColor: bd }}>
                  <h4 className="font-semibold text-white mb-3">Place Order: {orderService}</h4>
                  <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Add project notes, requirements, references..." rows={3} className="w-full px-4 py-3 rounded-xl text-[13px] text-white focus:outline-none resize-none mb-3 placeholder:text-[#4a4f6a]" style={{ background: bgIn, border: `1px solid ${bd}` }} />
                  <div className="flex gap-3">
                    <button onClick={() => setOrderService('')} className="px-4 py-2.5 rounded-xl text-xs font-medium border transition-colors hover:text-white" style={{ borderColor: bd, color: tSec }}>Cancel</button>
                    <button onClick={handlePlaceOrder} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-cyan-glow text-midnight hover:bg-cyan-soft transition-colors">Place Order →</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Invoices */}
        {view === 'invoices' && (
          <div className="max-w-4xl space-y-4">
            {invoices.map(inv => (
              <div key={inv.id} className="rounded-xl p-5 border cursor-pointer hover:border-cyan-glow/30 transition-colors" style={{ background: bgCard, borderColor: bd }} onClick={() => { setSelInvoice(inv); setView('invoice-detail'); }}>
                <div className="flex items-center justify-between mb-2">
                  <div><p className="font-semibold text-white">{inv.invoiceNumber}</p><p className="text-xs" style={{ color: tMut }}>{fmt(inv.createdAt)} • Due: {inv.dueDate}</p></div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${statusMap[inv.status]?.color}`}>{statusMap[inv.status]?.label}</span>
                </div>
                <p className="text-cyan-glow font-bold text-lg">${inv.total.toLocaleString()}</p>
              </div>
            ))}
            {invoices.length === 0 && <div className="rounded-xl p-12 text-center border" style={{ background: bgCard, borderColor: bd, color: tMut }}>No invoices yet</div>}
          </div>
        )}

        {/* Invoice Detail */}
        {view === 'invoice-detail' && selInvoice && (
          <div className="max-w-2xl space-y-6">
            <button onClick={() => setView('invoices')} className="text-xs hover:text-white transition-colors" style={{ color: tSec }}>← Back to invoices</button>
            <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }} id="invoice-print">
              <div className="p-6 border-b" style={{ borderColor: bdL }}>
                <div className="flex items-center justify-between mb-6">
                  <div><p className="font-display font-bold text-white text-xl">SpotAware.dev</p><p className="text-xs" style={{ color: tMut }}>Premium Digital Studio</p></div>
                  <div className="text-right"><p className="font-display font-bold text-white text-lg">{selInvoice.invoiceNumber}</p><span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${statusMap[selInvoice.status]?.color}`}>{statusMap[selInvoice.status]?.label}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div><p className="text-xs uppercase" style={{ color: tMut }}>Date</p><p className="text-white">{fmt(selInvoice.createdAt)}</p></div>
                  <div><p className="text-xs uppercase" style={{ color: tMut }}>Due Date</p><p className="text-white">{selInvoice.dueDate}</p></div>
                </div>
              </div>
              <div className="p-6">
                <table className="w-full mb-6">
                  <thead><tr className="border-b" style={{ borderColor: bdL }}>
                    {['Item', 'Qty', 'Rate', 'Amount'].map(h => <th key={h} className="py-2 text-left text-xs uppercase" style={{ color: tMut }}>{h}</th>)}
                  </tr></thead>
                  <tbody>{selInvoice.items.map((it, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: bdL }}>
                      <td className="py-3 text-[14px] text-white">{it.description}</td>
                      <td className="py-3 text-[14px]" style={{ color: tSec }}>{it.quantity}</td>
                      <td className="py-3 text-[14px]" style={{ color: tSec }}>${it.rate.toLocaleString()}</td>
                      <td className="py-3 text-[14px] text-white font-medium">${it.amount.toLocaleString()}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <div className="flex justify-end">
                  <div className="w-48 space-y-2">
                    <div className="flex justify-between text-[13px]"><span style={{ color: tSec }}>Subtotal</span><span className="text-white">${selInvoice.subtotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-[13px]"><span style={{ color: tSec }}>Tax ({selInvoice.taxRate || 0}% TX)</span><span className="text-white">${selInvoice.taxAmount?.toFixed(2) || '0.00'}</span></div>
                    <div className="flex justify-between text-[15px] font-bold pt-2 border-t" style={{ borderColor: bdL }}><span className="text-white">Total</span><span className="text-cyan-glow">${selInvoice.total.toLocaleString()}</span></div>
                  </div>
                </div>
                {selInvoice.note && <div className="mt-6 p-4 rounded-xl border" style={{ background: bgEl, borderColor: bdL }}><p className="text-xs uppercase mb-1" style={{ color: tMut }}>Note</p><p className="text-[14px]" style={{ color: tSec }}>{selInvoice.note}</p></div>}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => downloadInvoice(selInvoice)} className="flex-1 py-3 rounded-xl bg-cyan-glow/10 border border-cyan-glow/20 text-cyan-glow font-medium text-[14px] hover:bg-cyan-glow/15 transition-colors">📥 Download PDF</button>
              <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl border font-medium text-[14px] hover:bg-white/[0.02] transition-colors" style={{ borderColor: bd, color: tSec }}>🖨 Print</button>
            </div>
          </div>
        )}

        {/* Profile */}
        {view === 'profile' && (
          <div className="max-w-lg space-y-6">
            <h2 className="font-display text-xl font-bold text-white">My Profile</h2>
            <div className="rounded-xl border p-5 space-y-4" style={{ background: bgCard, borderColor: bd }}>
              <Input label="Full Name" value={profile.name} onChange={v => setProfile({ ...profile, name: v })} />
              <Input label="Email" value={profile.email} onChange={v => setProfile({ ...profile, email: v })} type="email" />
              <Input label="Company" value={profile.company} onChange={v => setProfile({ ...profile, company: v })} />
              <Input label="Phone" value={profile.phone} onChange={v => setProfile({ ...profile, phone: v })} />
              <Input label="New Password (leave blank to keep)" value={profile.password} onChange={v => setProfile({ ...profile, password: v })} type="password" ph="••••••••" />
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs" style={{ color: profileSaved ? '#34d399' : tMut }}>{profileSaved ? '✓ Saved!' : ''}</p>
                <button onClick={handleSaveProfile} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-cyan-glow text-midnight hover:bg-cyan-soft transition-colors">Save Profile</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Support Tickets ── */}
        {view === 'support' && (
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
              const pColors: Record<string, string> = { low: 'text-gray-400', medium: 'text-blue-400', high: 'text-amber-400', urgent: 'text-red-400' };
              const sColors: Record<string, string> = { open: 'bg-amber-500/15 text-amber-400 border-amber-500/20', in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/20', waiting_client: 'bg-violet-500/15 text-violet-400 border-violet-500/20', resolved: 'bg-green-500/15 text-green-400 border-green-500/20', closed: 'bg-gray-500/15 text-gray-400 border-gray-500/20' };
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
        )}

        {/* ── Notifications ── */}
        {view === 'notifications' && (
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
            {notifs.map(n => {
              const icons: Record<string, string> = { info: 'ℹ️', warning: '⚠️', success: '✅', error: '❌' };
              return (
                <div key={n.id} className={`rounded-xl p-4 border flex items-start gap-3 ${!n.read ? 'border-cyan-glow/20' : ''}`} style={{ background: !n.read ? '#262940' : bgCard, borderColor: n.read ? bd : undefined }}>
                  <span className="text-lg mt-0.5">{icons[n.type]}</span>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-white">{n.title}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: tSec }}>{n.message}</p>
                    <p className="text-[10px] mt-1" style={{ color: tMut }}>{fmt(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-cyan-glow flex-shrink-0 mt-2" />}
                </div>
              );
            })}
            {notifs.length === 0 && <div className="rounded-xl p-10 text-center border" style={{ background: bgCard, borderColor: bd, color: tMut }}>No notifications yet.</div>}
          </div>
        )}

        {/* ── Notes in Order Detail ── */}
        {view === 'order-detail' && selOrder && notes.length >= 0 && (
          <div className="max-w-2xl mt-6">
            <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: bd }}>
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: bdL }}>
                <span className="text-xs font-semibold text-white">📌 Project Notes</span>
              </div>
              <div className="p-4 space-y-2">
                {notes.filter(n => n.pinned).map(n => (
                  <div key={n.id} className="p-3 rounded-lg border-l-2 border-amber-400" style={{ background: bgEl }}>
                    <p className="text-[12px] text-white">{n.content}</p>
                    <p className="text-[10px] mt-1" style={{ color: tMut }}>📌 {n.by === 'client' ? 'You' : 'Team'} • {fmt(n.timestamp)}</p>
                  </div>
                ))}
                {notes.filter(n => !n.pinned).map(n => (
                  <div key={n.id} className="p-3 rounded-lg border" style={{ borderColor: bdL, background: bgEl }}>
                    <p className="text-[12px]" style={{ color: tSec }}>{n.content}</p>
                    <p className="text-[10px] mt-1" style={{ color: tMut }}>{n.by === 'client' ? 'You' : 'Team'} • {fmt(n.timestamp)}</p>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 px-3 py-2 rounded-lg text-[12px] text-white focus:outline-none placeholder:text-[#4a4f6a]" style={{ background: bgIn, border: `1px solid ${bdL}` }} />
                  <button onClick={() => { if (!newNote.trim() || !selOrder) return; addOrderNote(selOrder.id, newNote, 'client'); setNewNote(''); setNotes(getOrderNotes(selOrder.id)); }} className="px-3 py-2 rounded-lg text-xs font-medium bg-cyan-glow text-midnight">Add</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
