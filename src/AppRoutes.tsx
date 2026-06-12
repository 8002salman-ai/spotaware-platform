import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import App from './App';

const AdminPanel = lazy(() => import('./components/AdminPanel'));
const ClientPortal = lazy(() => import('./components/ClientPortal'));

function PortalLoader() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-glow border-t-transparent animate-spin" />
        <span className="text-sm text-gray-medium">Loading portal…</span>
      </div>
    </div>
  );
}

function AdminRoute() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<PortalLoader />}>
      <AdminPanel onClose={() => navigate('/')} />
    </Suspense>
  );
}

function ClientRoute() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<PortalLoader />}>
      <ClientPortal onClose={() => navigate('/')} />
    </Suspense>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/admin" element={<AdminRoute />} />
      <Route path="/client" element={<ClientRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
