import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { featureFlags } from '../../config/featureFlags';

export function AuthLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // If already authenticated and auth is active, redirect away from login/signup
  if (featureFlags.enableAuth && !loading && user) {
    const from =
      (location.state as { from?: { pathname?: string } })?.from?.pathname ||
      '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
}
