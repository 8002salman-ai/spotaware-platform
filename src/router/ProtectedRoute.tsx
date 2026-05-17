import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSupabasePortalSession, type PortalSession } from '../utils/auth';
import { isSupabaseConfigured } from '../utils/supabase';

type ProtectedRouteProps = {
  allowedRoles: PortalSession['role'][];
  children: React.ReactNode;
};

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<PortalSession | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isSupabaseConfigured()) {
        setSession(null);
        setLoading(false);
        return;
      }
      const current = await getSupabasePortalSession();
      setSession(current);
      setLoading(false);
    };
    void checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-sm text-gray-medium">Checking access...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={`/?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!allowedRoles.includes(session.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
