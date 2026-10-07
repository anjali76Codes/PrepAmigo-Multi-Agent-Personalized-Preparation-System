import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { featureFlags } from "../../config/featureFlags";
import { useAppContext } from "../../context/AppContext";
import { OnboardingDialog } from "../auth/OnboardingDialog";

export function PlanSetupLayout() {
  const { user, loading } = useAuth();
  const { preps, loadingPreps } = useAppContext();
  const location = useLocation();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  if (featureFlags.enableAuth && loading) {
    return <div className="flex h-screen items-center justify-center bg-bg text-carbon-500">Loading session…</div>;
  }

  if (featureFlags.enableAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (loadingPreps) {
    return <div className="flex h-screen items-center justify-center bg-bg text-carbon-500">Loading your plan…</div>;
  }

  if (preps.length > 0) {
    return <Navigate to="/dashboard" replace />;
  }

  const needsOnboarding = Boolean(
    user && !user.profile?.target_role?.trim() && !onboardingComplete,
  );

  return (
    <div className="h-screen w-full overflow-hidden">
      {needsOnboarding && (
        <OnboardingDialog
          isOpen
          onClose={() => setOnboardingComplete(true)}
        />
      )}
      {!needsOnboarding && <Outlet />}
    </div>
  );
}
