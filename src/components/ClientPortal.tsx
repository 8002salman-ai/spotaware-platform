import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  verifyClientLogin, registerClient, setClientAuth, getClientSession,
  getClientOrders, getClientInvoices, createOrder, updateClientProfile,
  getClients, getSettings, logActivity,
  getClientTickets,
  getNotifications,
  type Order, type Invoice, type SupportTicket, type AppNotification,
} from '../utils/storage';
import { hydrateSupabasePortalSession, isSupabaseAuthEnabled, isOAuthReturnInProgress, waitForSupabasePortalSession, supabaseSignIn, supabaseSignOut, supabaseSignUp, supabaseSignInWithGoogle, supabaseSendPasswordReset } from '../utils/auth';
import {
  fetchClientOrders,
  fetchClientInvoices,
  createClientOrderInSupabase,
  updateProfileInSupabase,
  fetchClientSupport,
  notifyAdminInSupabase,
} from '../utils/supabaseData';
import { getSupabase } from '../utils/supabase';

import { type View, bg, bgCard, bgEl, bgIn, bd, bdL, tSec, tMut, SERVICES } from './client/types';
import ClientDashboardView from './client/ClientDashboardView';
import ClientOrdersView from './client/ClientOrdersView';
import ClientServicesView from './client/ClientServicesView';
import ClientInvoicesView from './client/ClientInvoicesView';
import ClientProfileView from './client/ClientProfileView';
import ClientSupportView from './client/ClientSupportView';
import ClientNotificationsView from './client/ClientNotificationsView';

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
  // Notifications
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
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
      } catch (e) { console.log('Email failed:', e); }
    }
    logActivity('order', 'New Order', `${svc.name} — $${svc.price}`, undefined, session.email);
    setOrderService(''); setOrderNotes('');
    await loadPortalData(session.id);
    setView('orders');
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
            {mode === 'signup' && <div><label className="text-xs font-medium mb-1.5 block" style={{ color: tSec }}>Full Name</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" className="w-full px-4 py-3 rounded-xl text-[14px] text-white focus:outline-none focus:border-cyan-glow/50 placeholder:text-[#4a4f6a] transition-colors" style={{ background: bgIn, border: `1px solid ${bd}` }} /></div>}
            <div><label className="text-xs font-medium mb-1.5 block" style={{ color: tSec }}>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" className="w-full px-4 py-3 rounded-xl text-[14px] text-white focus:outline-none focus:border-cyan-glow/50 placeholder:text-[#4a4f6a] transition-colors" style={{ background: bgIn, border: `1px solid ${bd}` }} /></div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: tSec }}>Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="w-full px-4 py-3 pr-16 rounded-xl text-[14px] text-white focus:outline-none focus:border-cyan-glow/50 placeholder:text-[#4a4f6a] transition-colors" style={{ background: bgIn, border: `1px solid ${bd}` }} />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs hover:text-white transition-colors" style={{ color: tSec }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {mode === 'signup' && <div><label className="text-xs font-medium mb-1.5 block" style={{ color: tSec }}>Company (optional)</label><input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Acme Inc." className="w-full px-4 py-3 rounded-xl text-[14px] text-white focus:outline-none focus:border-cyan-glow/50 placeholder:text-[#4a4f6a] transition-colors" style={{ background: bgIn, border: `1px solid ${bd}` }} /></div>}
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
        {view === 'dashboard' && (
          <ClientDashboardView
            session={session}
            orders={orders}
            invoices={invoices}
            setView={setView}
            setSelOrder={setSelOrder}
          />
        )}
        {(view === 'orders' || view === 'order-detail') && (
          <ClientOrdersView
            view={view}
            orders={orders}
            selOrder={selOrder}
            setSelOrder={setSelOrder}
            setView={setView}
            updateMsg={updateMsg}
            setUpdateMsg={setUpdateMsg}
            session={session}
            loadPortalData={loadPortalData}
          />
        )}
        {view === 'services' && (
          <ClientServicesView
            orderService={orderService}
            setOrderService={setOrderService}
            orderNotes={orderNotes}
            setOrderNotes={setOrderNotes}
            handlePlaceOrder={handlePlaceOrder}
          />
        )}
        {(view === 'invoices' || view === 'invoice-detail') && (
          <ClientInvoicesView
            view={view}
            invoices={invoices}
            selInvoice={selInvoice}
            setSelInvoice={setSelInvoice}
            setView={setView}
          />
        )}
        {view === 'profile' && (
          <ClientProfileView
            profile={profile}
            setProfile={setProfile}
            profileSaved={profileSaved}
            handleSaveProfile={handleSaveProfile}
          />
        )}
        {view === 'support' && (
          <ClientSupportView
            tickets={tickets}
            setTickets={setTickets}
            session={session}
            loadPortalData={loadPortalData}
          />
        )}
        {view === 'notifications' && (
          <ClientNotificationsView
            notifs={notifs}
            setNotifs={setNotifs}
            session={session}
            loadPortalData={loadPortalData}
          />
        )}
      </div>
    </motion.div>
  );
}