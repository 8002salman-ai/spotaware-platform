// Enterprise Financial Engine — Root wrapper with auth guard and navigation
import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { getAdminSession, verifyAdminLogin, setAdminAuth } from '../../utils/storage';
import { isSupabaseAuthEnabled, waitForSupabasePortalSession, supabaseSignIn, isOAuthReturnInProgress } from '../../utils/auth';

const InvestorManagement     = lazy(() => import('./InvestorManagement'));
const CapitalLedger          = lazy(() => import('./CapitalLedger'));
const ProfitLedger           = lazy(() => import('./ProfitLedger'));
const WithdrawalEngine       = lazy(() => import('./WithdrawalEngine'));
const MarketplacePayoutEngine = lazy(() => import('./MarketplacePayoutEngine'));
const InvestorDashboard      = lazy(() => import('./InvestorDashboard'));
const CompanyWallet          = lazy(() => import('./CompanyWallet'));
const FinancialDashboard     = lazy(() => import('./FinancialDashboard'));
const FinancialReports       = lazy(() => import('./FinancialReports'));

const bg = 'var(--t-bg,#0f1923)';
const bgCard = 'var(--t-card,#152230)';
const bgInput = 'var(--t-in,#1f3344)';
const border = 'var(--t-bd,#264055)';
const borderLight = 'var(--t-bdl,#1e3548)';
const textSecondary = 'var(--t-sec,#8ab4d0)';
const textMuted = 'var(--t-mut,#4d7a96)';

const NAV_ITEMS = [
  { path: '/financial', label: 'Dashboard', icon: '📊', exact: true },
  { path: '/financial/investors', label: 'Investors & Companies', icon: '👥' },
  { path: '/financial/capital', label: 'Capital Ledger', icon: '💰' },
  { path: '/financial/profit', label: 'Profit Ledger', icon: '📈' },
  { path: '/financial/withdrawals', label: 'Withdrawal Engine', icon: '💸' },
  { path: '/financial/marketplace', label: 'Marketplace Payouts', icon: '🛒' },
  { path: '/financial/investor-dashboard', label: 'Investor Dashboard', icon: '👤' },
  { path: '/financial/company-wallet', label: 'Company Wallets', icon: '🏦' },
  { path: '/financial/reports', label: 'Reports', icon: '📋' },
];

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00e5ff', borderTopColor: 'transparent' }} />
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    if (isSupabaseAuthEnabled()) {
      const result = await supabaseSignIn(email, pass);
      if ('error' in result) {
        setError('Invalid credentials');
        setLoading(false);
        return;
      }
      const session = await waitForSupabasePortalSession();
      if (session && ['owner', 'admin', 'viewer'].includes(session.role)) {
        onLogin();
      } else {
        setError('Access denied: admin role required.');
      }
    } else {
      const user = verifyAdminLogin(email, pass);
      if (user) { setAdminAuth(user); onLogin(); }
      else setError('Invalid credentials');
    }
    setLoading(false);
  };

  const inputCls = `w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none border focus:border-cyan-glow/50 transition-colors`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
      <div className="w-full max-w-sm rounded-2xl border p-8 space-y-5" style={{ background: bgCard, borderColor: border }}>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-1">Financial Engine</h1>
          <p className="text-sm" style={{ color: textMuted }}>Admin access required</p>
        </div>
        {error && <p className="text-sm text-center rounded-lg px-3 py-2" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>{error}</p>}
        <div className="space-y-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin email"
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }} />
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password"
            className={inputCls} style={{ background: bgInput, borderColor: borderLight }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>
        <button onClick={handleLogin} disabled={loading || !email || !pass}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #00e5ff22, #00e5ff33)', border: '1px solid #00e5ff55', color: '#00e5ff' }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
        <button onClick={() => { window.location.href = '/admin'; }} className="w-full text-xs text-center" style={{ color: textMuted }}>
          ← Back to Admin Panel
        </button>
      </div>
    </div>
  );
}

export default function FinancialEngine() {
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const init = async () => {
      if (isSupabaseAuthEnabled()) {
        if (isOAuthReturnInProgress()) { setChecking(false); return; }
        const session = await waitForSupabasePortalSession();
        if (session && ['owner', 'admin', 'viewer'].includes(session.role)) setIsAuth(true);
      } else {
        const s = getAdminSession();
        if (s) setIsAuth(true);
      }
      setChecking(false);
    };
    void init();
  }, []);

  if (checking) return <PageLoader />;
  if (!isAuth) return <LoginScreen onLogin={() => setIsAuth(true)} />;

  const activeItem = NAV_ITEMS.slice().reverse().find(n => n.exact ? location.pathname === n.path : location.pathname.startsWith(n.path));

  return (
    <div className="flex min-h-screen" style={{ background: bg }}>
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static z-50 top-0 left-0 h-full w-64 border-r flex flex-col transition-transform md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: bgCard, borderColor: borderLight }}>
        <div className="p-5 border-b" style={{ borderColor: borderLight }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <div>
              <p className="text-sm font-bold text-white">Financial Engine</p>
              <p className="text-[10px]" style={{ color: textMuted }}>Enterprise ERP</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path) && !location.pathname.startsWith('/financial/') === (item.path === '/financial');
            const active = activeItem?.path === item.path;
            return (
              <button key={item.path}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
                style={active
                  ? { background: '#00e5ff15', color: '#00e5ff', border: '1px solid #00e5ff25' }
                  : { color: textSecondary, border: '1px solid transparent' }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: borderLight }}>
          <button onClick={() => { window.location.href = '/admin'; }}
            className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors"
            style={{ color: textMuted }}>
            ← Admin Panel
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ background: bgCard, borderColor: borderLight }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded" style={{ color: textSecondary }}>☰</button>
            <h2 className="text-sm font-medium text-white">{activeItem?.label ?? 'Financial Engine'}</h2>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<FinancialDashboard />} />
              <Route path="/investors" element={<InvestorManagement />} />
              <Route path="/capital" element={<CapitalLedger />} />
              <Route path="/profit" element={<ProfitLedger />} />
              <Route path="/withdrawals" element={<WithdrawalEngine />} />
              <Route path="/marketplace" element={<MarketplacePayoutEngine />} />
              <Route path="/investor-dashboard" element={<InvestorDashboard />} />
              <Route path="/company-wallet" element={<CompanyWallet />} />
              <Route path="/reports" element={<FinancialReports />} />
              <Route path="*" element={<Navigate to="/financial" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
