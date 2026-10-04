import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { mockPreps as initialPreps, mockAgentEvents as initialAgentEvents, mockNotifications as initialNotifications } from '../data/mockData';
import type { Prep, AgentEvent, Notification } from '../data/mockData';
import { plansApi, apiPlanToPrep } from '../lib/api/plans';

interface AppContextType {
  preps: Prep[];
  setPreps: React.Dispatch<React.SetStateAction<Prep[]>>;
  agentEvents: AgentEvent[];
  setAgentEvents: React.Dispatch<React.SetStateAction<AgentEvent[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  refreshPreps: () => Promise<void>;
  loadingPreps: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [preps, setPreps] = useState<Prep[]>(initialPreps);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>(initialAgentEvents);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [loadingPreps, setLoadingPreps] = useState(false);

  const refreshPreps = useCallback(async () => {
    setLoadingPreps(true);
    try {
      const res = await plansApi.list();
      if (res.data && res.data.length > 0) {
        setPreps(res.data.map(apiPlanToPrep));
      }
    } catch (err) {
      console.warn('[AppContext] Could not fetch plans from backend, falling back to cached/mock preps:', err);
    } finally {
      setLoadingPreps(false);
    }
  }, []);

  useEffect(() => {
    refreshPreps();
  }, [refreshPreps]);

  return (
    <AppContext.Provider
      value={{
        preps,
        setPreps,
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
