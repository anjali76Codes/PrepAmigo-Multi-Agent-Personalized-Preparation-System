import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { mockAgentEvents as initialAgentEvents, mockNotifications as initialNotifications } from '../data/mockData';
import type { Prep, AgentEvent, Notification } from '../data/mockData';
import { plansApi, apiPlanToPrep } from '../lib/api/plans';
import { useAuth } from '../hooks/useAuth';
import { featureFlags } from '../config/featureFlags';

interface AppContextType {
  preps: Prep[];
  setPreps: React.Dispatch<React.SetStateAction<Prep[]>>;
  activePrepId: string | null;
  setActivePrepId: (id: string | null) => void;
  activePrep: Prep | null;
  agentEvents: AgentEvent[];
  setAgentEvents: React.Dispatch<React.SetStateAction<AgentEvent[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  refreshPreps: () => Promise<void>;
  loadingPreps: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [preps, setPreps] = useState<Prep[]>([]);
  const [activePrepId, setActivePrepId] = useState<string | null>(null);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>(initialAgentEvents);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [loadingPreps, setLoadingPreps] = useState(false);

  const refreshPreps = useCallback(async () => {
    if (featureFlags.enableAuth && !user) {
      setPreps([]);
      setActivePrepId(null);
      return;
    }
    setLoadingPreps(true);
    try {
      const res = await plansApi.list();
      if (res.data) {
        const mapped = res.data.map(apiPlanToPrep);
        setPreps(mapped);
        if (mapped.length > 0) {
          setActivePrepId((prev) => (prev && mapped.some((p) => p.id === prev) ? prev : mapped[0].id));
        } else {
          setActivePrepId(null);
        }
      }
    } catch (err) {
      console.warn('[AppContext] Could not fetch plans from backend:', err);
    } finally {
      setLoadingPreps(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (featureFlags.enableAuth && !user) {
      setPreps([]);
      setActivePrepId(null);
      return;
    }
    void refreshPreps();
  }, [user, authLoading, refreshPreps]);

  const activePrep = preps.find((p) => p.id === activePrepId) || preps[0] || null;

  return (
    <AppContext.Provider
      value={{
        preps,
        setPreps,
        activePrepId,
        setActivePrepId,
        activePrep,
        agentEvents,
        setAgentEvents,
        notifications,
        setNotifications,
        refreshPreps,
        loadingPreps,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
