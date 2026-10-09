import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { mockAgentEvents as initialAgentEvents } from '../data/mockData';
import type { Prep, AgentEvent, Notification } from '../data/mockData';
import { plansApi, apiPlanToPrep } from '../lib/api/plans';
import { apiNotificationToNotification, notificationsApi } from '../lib/api/notifications';
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
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [preps, setPreps] = useState<Prep[]>([]);
  const [activePrepId, setActivePrepId] = useState<string | null>(null);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>(initialAgentEvents);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingPreps, setLoadingPreps] = useState(false);

  const refreshNotifications = useCallback(async () => {
    if (featureFlags.enableAuth && !user) {
      setNotifications([]);
      return;
    }
    try {
      const res = await notificationsApi.list();
      setNotifications((res.data || []).map(apiNotificationToNotification));
    } catch (err) {
      console.warn('[AppContext] Could not fetch notifications from backend:', err);
    }
  }, [user]);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await notificationsApi.markRead(id);
    } catch (err) {
      console.warn('[AppContext] Could not mark notification read:', err);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.markAllRead();
    } catch (err) {
      console.warn('[AppContext] Could not mark all notifications read:', err);
    }
  }, []);

  const refreshPreps = useCallback(async () => {
    if (featureFlags.enableAuth && !user) {
      setPreps([]);
      setActivePrepId(null);
      return;
    }
    setLoadingPreps(true);
    try {
      const [res, progressRes] = await Promise.all([
        plansApi.list(),
        plansApi.getUserProgress().catch(() => null)
      ]);
      if (res.data) {
        const globalProgress = progressRes?.data || null;
        const mapped = res.data.map((plan) => {
          const prep = apiPlanToPrep(plan);
          if (globalProgress) {
            prep.learningContext.progress = {
              xp: globalProgress.xp_points || 0,
              ai_credits: globalProgress.ai_credits ?? 30,
              streak: globalProgress.current_streak || globalProgress.streak_count || 0,
              level: Math.floor((globalProgress.xp_points || 0) / 1000) + 1,
              badges: (globalProgress.trophies || []).map((t: any) => ({
                id: t.key, name: t.key.replace(/_/g, ' '), description: 'Earned trophy', date: t.awarded_at
              })),
              titles: [{ id: "t-1", name: "Candidate" }],
              milestones: [],
              skillLevels: [],
              learningVelocity: "1.0x",
            };
          }
          return prep;
        });
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
    void refreshNotifications();
  }, [user, authLoading, refreshPreps, refreshNotifications]);

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
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
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
