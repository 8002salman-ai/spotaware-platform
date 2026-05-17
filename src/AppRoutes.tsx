import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import App from './App';
import AdminPanel from './components/AdminPanel';
import ClientPortal from './components/ClientPortal';

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
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/admin" element={<AdminRoute />} />
      <Route path="/client" element={<ClientRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
