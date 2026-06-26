import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import App from './App';

const AdminPanel    = lazy(() => import('./components/AdminPanel'));
const ClientPortal  = lazy(() => import('./components/ClientPortal'));
const FinancialEngine = lazy(() => import('./components/financial/FinancialEngine'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00e5ff', borderTopColor: 'transparent' }} />
    </div>
  );
}

function AdminRoute() {
  const navigate = useNavigate();
  return <AdminPanel onClose={() => navigate('/')} />;
}

function ClientRoute() {
  const navigate = useNavigate();
  return <ClientPortal onClose={() => navigate('/')} />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/client" element={<ClientRoute />} />
        {/* Enterprise Financial Engine — all /financial/* routes */}
        <Route path="/financial/*" element={<FinancialEngine />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
