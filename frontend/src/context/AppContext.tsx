import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { mockPreps as initialPreps, mockAgentEvents as initialAgentEvents, mockNotifications as initialNotifications } from '../data/mockData';
import type { Prep, AgentEvent, Notification } from '../data/mockData';

interface AppContextType {
  preps: Prep[];
  setPreps: React.Dispatch<React.SetStateAction<Prep[]>>;
  agentEvents: AgentEvent[];
  setAgentEvents: React.Dispatch<React.SetStateAction<AgentEvent[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [preps, setPreps] = useState<Prep[]>(initialPreps);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>(initialAgentEvents);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  return (
    <AppContext.Provider value={{ preps, setPreps, agentEvents, setAgentEvents, notifications, setNotifications }}>
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
